import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type MarkdStudioDB, type DocRecord, type WorkspaceRecord } from './schema';

let dbPromise: Promise<IDBPDatabase<MarkdStudioDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MarkdStudioDB>> {
	if (!dbPromise) {
		dbPromise = openDB<MarkdStudioDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				const docsStore = db.createObjectStore('docs', { keyPath: 'id' });
				docsStore.createIndex('by-updatedAt', 'updatedAt');
				db.createObjectStore('workspace', { keyPath: 'id' });
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
	await db.put('docs', doc);
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
