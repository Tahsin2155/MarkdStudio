import { SvelteSet } from 'svelte/reactivity';
import { getAllDocs, getWorkspace, putDoc, putWorkspace, deleteDoc as dbDeleteDoc } from '$lib/db/client';
import type { DocRecord } from '$lib/db/schema';
import { extractH1Title } from '$lib/markdown/title';

const AUTOSAVE_DEBOUNCE_MS = 400;

function uuid(): string {
	return crypto.randomUUID();
}

function makeBlankDoc(order: number): DocRecord {
	const now = Date.now();
	return {
		id: uuid(),
		title: 'Untitled', // matches the seed content's H1 below, since title
		// derivation is on by default (titleIsManual: false)
		titleIsManual: false,
		content: '# Untitled\n\nStart writing…\n',
		createdAt: now,
		updatedAt: now,
		order
	};
}

class WorkspaceStore {
	docs = $state<DocRecord[]>([]);
	activeDocId = $state<string | null>(null);
	// tracks which doc ids have unsaved edits not yet flushed to IndexedDB
	dirty = $state<SvelteSet<string>>(new SvelteSet());
	ready = $state(false);

	private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

	get activeDoc(): DocRecord | undefined {
		return this.docs.find((d) => d.id === this.activeDocId);
	}

	async init() {
		const [docs, ws] = await Promise.all([getAllDocs(), getWorkspace()]);

		if (docs.length === 0) {
			// first run: seed with one blank document
			const doc = makeBlankDoc(0);
			await putDoc(doc);
			this.docs = [doc];
			this.activeDocId = doc.id;
			await this.persistWorkspace();
		} else {
			this.docs = docs;
			const openIds = ws?.openDocIds?.filter((id) => docs.some((d) => d.id === id));
			this.activeDocId =
				ws?.activeDocId && docs.some((d) => d.id === ws.activeDocId)
					? ws.activeDocId
					: (openIds?.[0] ?? docs[0].id);
		}

		this.ready = true;
	}

	private async persistWorkspace() {
		await putWorkspace({
			openDocIds: this.docs.map((d) => d.id),
			activeDocId: this.activeDocId
		});
	}

	selectTab(id: string) {
		if (!this.docs.some((d) => d.id === id)) return;
		this.activeDocId = id;
		void this.persistWorkspace();
	}

	async newTab() {
		const doc = makeBlankDoc(this.docs.length);
		this.docs = [...this.docs, doc];
		this.activeDocId = doc.id;
		await putDoc(doc);
		await this.persistWorkspace();
	}

	async closeTab(id: string) {
		const idx = this.docs.findIndex((d) => d.id === id);
		if (idx === -1) return;

		// Cancel any in-flight debounced save first — otherwise a timer that
		// fires after deletion will silently resurrect this doc in IndexedDB.
		const pendingTimer = this.saveTimers.get(id);
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			this.saveTimers.delete(id);
		}

		this.docs = this.docs.filter((d) => d.id !== id);
		await dbDeleteDoc(id);
		this.dirty.delete(id);

		if (this.activeDocId === id) {
			// `idx` was found in the array BEFORE the filter above, but
			// `this.docs` here is the array AFTER it — so `this.docs[idx]` is
			// not "the same slot," it's actually the tab that was one-to-
			// the-right of the one just closed (everything after idx shifted
			// down by one). That happens to be the desired UX: closing a tab
			// focuses whatever's now in its place. The `?? docs[idx - 1]`
			// only matters when the closed tab was last in the list, where
			// `docs[idx]` is out of bounds (undefined) and falling back to
			// the new last tab is correct. Both branches are intentional;
			// don't re-derive idx after the filter or "simplify" this to
			// `docs[idx]` alone — the two behaviors depend on each other.
			const fallback = this.docs[idx] ?? this.docs[idx - 1];
			this.activeDocId = fallback?.id ?? null;
		}

		if (this.docs.length === 0) {
			await this.newTab();
			return;
		}

		await this.persistWorkspace();
	}

	renameTab(id: string, title: string) {
		const doc = this.docs.find((d) => d.id === id);
		if (!doc) return;
		const trimmed = title.trim();
		if (trimmed) {
			// Deliberate override — pin it so future edits stop re-deriving
			// the title from the H1.
			doc.title = trimmed;
			doc.titleIsManual = true;
		} else {
			// Blank rename reads as "clear the override," not "pin to
			// untitled" — otherwise clearing the field would permanently
			// stick the tab on 'untitled.md' even as the user keeps typing
			// headings.
			doc.titleIsManual = false;
			doc.title = extractH1Title(doc.content) ?? 'untitled.md';
		}
		doc.updatedAt = Date.now();
		this.scheduleSave(id);
	}

	updateContent(id: string, content: string) {
		const doc = this.docs.find((d) => d.id === id);
		if (!doc) return;
		doc.content = content;
		if (!doc.titleIsManual) {
			doc.title = extractH1Title(content) ?? 'untitled.md';
		}
		doc.updatedAt = Date.now();
		this.dirty.add(id);
		this.scheduleSave(id);
	}

	private scheduleSave(id: string) {
		const existing = this.saveTimers.get(id);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(async () => {
			const doc = this.docs.find((d) => d.id === id);
			if (doc) {
				await putDoc(doc);
				this.dirty.delete(id);
			}
			this.saveTimers.delete(id);
		}, AUTOSAVE_DEBOUNCE_MS);

		this.saveTimers.set(id, timer);
	}

	/** Force-flush a pending save immediately (e.g. before closing a tab or the page). */
	async flush(id: string) {
		const timer = this.saveTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.saveTimers.delete(id);
		}
		const doc = this.docs.find((d) => d.id === id);
		if (doc) {
			await putDoc(doc);
			this.dirty.delete(id);
		}
	}
}

export const workspace = new WorkspaceStore();
