import type { DBSchema } from 'idb';

/**
 * A single document/tab persisted to IndexedDB.
 */
export interface DocRecord {
	id: string; // uuid
	title: string; // filename shown in the tab, e.g. "untitled.md"
	titleIsManual: boolean; // true once the user renames the tab by hand —
	// pins `title` so it stops tracking the document's first H1
	content: string; // raw markdown source
	createdAt: number; // epoch ms
	updatedAt: number; // epoch ms
	order: number; // tab position, lower = earlier in the tab bar
}

/**
 * Workspace-level state: which docs are open as tabs, and which is active.
 * Kept as a single record so it's one read/write instead of scanning docs.
 */
export interface WorkspaceRecord {
	id: 'workspace'; // singleton key
	openDocIds: string[]; // ordered list of open tab ids
	activeDocId: string | null;
}

export interface MarkdStudioDB extends DBSchema {
	docs: {
		key: string;
		value: DocRecord;
		indexes: { 'by-updatedAt': number };
	};
	workspace: {
		key: string;
		value: WorkspaceRecord;
	};
}

export const DB_NAME = 'markdstudio';
export const DB_VERSION = 2;
