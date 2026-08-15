import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type MarkdStudioDB, type DocRecord, type WorkspaceRecord } from './schema';

let dbPromise: Promise<IDBPDatabase<MarkdStudioDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MarkdStudioDB>> {
	if (!dbPromise) {
		dbPromise = openDB<MarkdStudioDB>(DB_NAME, DB_VERSION, {
			async upgrade(db, oldVersion, _newVersion, tx) {
				if (oldVersion < 1) {
					const docsStore = db.createObjectStore('docs', { keyPath: 'id' });
					docsStore.createIndex('by-updatedAt', 'updatedAt');
					db.createObjectStore('workspace', { keyPath: 'id' });
				}
				if (oldVersion < 2) {
					// v2 adds titleIsManual (auto-title-from-H1 feature). Existing
					// docs predate this field entirely — default them to `true`
					// (manual) rather than `false`, so a title the user already
					// set/kept from before this feature doesn't silently get
					// overwritten by H1-derivation the next time they type.
					const docsStore = tx.objectStore('docs');
					let cursor = await docsStore.openCursor();
					while (cursor) {
						if (cursor.value.titleIsManual === undefined) {
							await cursor.update({ ...cursor.value, titleIsManual: true });
						}
						cursor = await cursor.continue();
					}
				}
			}
		});
	}
	return dbPromise;
}

// ---------- Docs ----------

export async function getAllDocs(): Promise<DocRecord[]> {
	const db = await getDB();
	const docs = await db.getAll('docs');
	return docs.sort((a, b) => a.order - b.order);
}

export async function getDoc(id: string): Promise<DocRecord | undefined> {
	const db = await getDB();
	return db.get('docs', id);
}

export async function putDoc(doc: DocRecord): Promise<void> {
	const db = await getDB();
	// Callers generally pass a DocRecord pulled out of a Svelte 5 $state
	// array, which makes `doc` a reactive Proxy, not a plain object.
	// IndexedDB's put() uses the structured clone algorithm, which cannot
	// clone a Proxy — it throws "could not be cloned" at runtime. That used
	// to happen inside a fire-and-forget async timer with nothing awaiting
	// or catching it, so the error had nowhere to surface and writes
	// silently no-op'd.
	//
	// This file is plain .ts (not .svelte.ts), so Svelte's $state.snapshot
	// rune isn't compiled here — reaching for it would crash at runtime
	// with "$state is not defined". A plain JSON round-trip unwraps the
	// proxy just as well and works in any context; DocRecord is plain
	// string/number/array data, so it round-trips losslessly.
	await db.put('docs', JSON.parse(JSON.stringify(doc)));
}

export async function deleteDoc(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('docs', id);
}

// ---------- Workspace (open tabs + active tab) ----------

const WORKSPACE_ID = 'workspace' as const;

export async function getWorkspace(): Promise<WorkspaceRecord | undefined> {
	const db = await getDB();
	return db.get('workspace', WORKSPACE_ID);
}

export async function putWorkspace(state: Omit<WorkspaceRecord, 'id'>): Promise<void> {
	const db = await getDB();
	await db.put('workspace', { id: WORKSPACE_ID, ...state });
}
