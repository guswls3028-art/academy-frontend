/** Temporary homework files only. Never stores tokens or signed media URLs. */
import { readBlobArrayBuffer } from "@/shared/utils/readBlobArrayBuffer";
const DATABASE = "academy-homework-drafts-v1";
const STORE = "drafts";
const CHUNKS = "chunks";
const TTL = 24 * 60 * 60_000;
const MAX_BYTES = 500 * 1024 * 1024;
const CHUNK_BYTES = 4 * 1024 * 1024;

export type HomeworkDraftFile = {
  clientFileId: string;
  uploadBatchId: string;
  file: File;
  position: number;
};
type FileDescriptor = Omit<HomeworkDraftFile, "file"> & {
  name: string; type: string; size: number; lastModified: number;
};
type Draft = { key: string; generation: string; expires: number; files: FileDescriptor[] };
type Chunk = { key: string; draftKey: string; generation: string; clientFileId: string; createdAt: number; data: ArrayBuffer };
const memory = new Map<string, { generation: string; expires: number; files: HomeworkDraftFile[]; persisted: boolean }>();
const revoked = new Set<string>();
let queue: Promise<unknown> = Promise.resolve();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Temporary storage unavailable")); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "key" });
      request.result.createObjectStore(CHUNKS, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Temporary storage busy"));
  });
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.catch(() => undefined).then(operation);
  queue = result.catch(() => undefined);
  return result;
}

function readAll<T>(db: IDBDatabase, store: string, range?: IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readonly");
    const request = transaction.objectStore(store).getAll(range);
    transaction.oncomplete = () => resolve(request.result as T[]);
    transaction.onabort = () => reject(transaction.error);
  });
}

function usable(draft: { generation: string; expires: number }, generation: string): boolean {
  return !revoked.has(generation) && draft.generation === generation && draft.expires > Date.now();
}

function chunkPrefix(key: string, clientFileId: string): string {
  return JSON.stringify([key, clientFileId]) + ":";
}

function write(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

/** One atomic metadata/pruning transaction also removes incomplete crash leftovers. */
function prune(db: IDBDatabase, generation: string, replacement?: Draft, removedIds: string[] = [], isCurrent: () => boolean = () => true, addedIds: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, CHUNKS], "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      if (!isCurrent()) { transaction.abort(); return; }
      const kept = new Map<string, Set<string>>();
      const previousRefs = new Set<string>();
      let bytes = 0;
      if (replacement) {
        const stored = (request.result as Draft[]).find((draft) => draft.key === replacement.key && usable(draft, generation));
        const allowed = new Set([...(stored?.files.map((file) => file.clientFileId) ?? []), ...addedIds]);
        // A stale tab cannot resurrect a file explicitly removed by another tab.
        replacement.files = replacement.files.filter((file) => allowed.has(file.clientFileId));
      }
      for (const draft of request.result as Draft[]) {
        for (const file of draft.files) previousRefs.add(chunkPrefix(draft.key, file.clientFileId));
        if (draft.key === replacement?.key) {
          // Preserve files selected in another tab; remove only IDs this caller removed.
          const incoming = new Set(replacement.files.map((file) => file.clientFileId));
          replacement.files = [...(usable(draft, generation) ? draft.files.filter((file) => !incoming.has(file.clientFileId) && !removedIds.includes(file.clientFileId)) : []), ...replacement.files];
          continue;
        }
        if (!usable(draft, generation)) { store.delete(draft.key); memory.delete(draft.key); }
        else {
          kept.set(draft.key, new Set(draft.files.map((file) => file.clientFileId)));
          bytes += draft.files.reduce((sum, file) => sum + file.size, 0);
        }
      }
      if (replacement) {
        bytes += replacement.files.reduce((sum, file) => sum + file.size, 0);
        if (bytes > MAX_BYTES) { transaction.abort(); return; }
        if (replacement.files.length && usable(replacement, generation)) {
          store.put(replacement);
          kept.set(replacement.key, new Set(replacement.files.map((file) => file.clientFileId)));
        } else store.delete(replacement.key);
      }
      const cursorRequest = transaction.objectStore(CHUNKS).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const chunk = cursor.value as Chunk;
        // A concurrent tab may still be writing new chunks before its commit.
        if (!kept.get(chunk.draftKey)?.has(chunk.clientFileId)
          && (previousRefs.has(chunkPrefix(chunk.draftKey, chunk.clientFileId)) || chunk.generation !== generation || chunk.createdAt < Date.now() - 5 * 60_000)) cursor.delete();
        cursor.continue();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

export function loadHomeworkDraft(key: string, generation: string, isCurrent: () => boolean = () => true): Promise<{ files: HomeworkDraftFile[]; persisted: boolean }> {
  return serialize(async () => {
    if (!isCurrent()) throw new Error("Session ended");
    const cached = memory.get(key);
    if (cached && !cached.persisted && usable(cached, generation)) return { files: cached.files, persisted: false };
    const db = await open();
    try {
      await prune(db, generation, undefined, [], isCurrent);
      const draft = (await readAll<Draft>(db, STORE)).find((item) => item.key === key);
      const files: HomeworkDraftFile[] = [];
      if (draft && usable(draft, generation)) {
        for (const descriptor of draft.files) {
          const prefix = chunkPrefix(key, descriptor.clientFileId);
          const chunks = await readAll<Chunk>(db, CHUNKS, IDBKeyRange.bound(prefix, prefix + "\uffff"));
          if (chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0) !== descriptor.size) {
            throw new Error("Temporary file incomplete");
          }
          const file = new File(chunks.map((chunk) => chunk.data), descriptor.name, { type: descriptor.type, lastModified: descriptor.lastModified });
          files.push({ file, clientFileId: descriptor.clientFileId, uploadBatchId: descriptor.uploadBatchId, position: descriptor.position });
        }
        memory.set(key, { generation, expires: draft.expires, files, persisted: true });
      }
      return { files, persisted: true };
    } finally { db.close(); }
  });
}

export function saveHomeworkDraft(key: string, generation: string, files: HomeworkDraftFile[], removedIds: string[] = [], isCurrent: () => boolean = () => true, addedIds: string[] = files.map((file) => file.clientFileId)): Promise<void> {
  if (revoked.has(generation)) return Promise.reject(new Error("Session ended"));
  const expires = Date.now() + TTL;
  // Route/assignment switches can recover selection even if disk is full.
  if (files.length) memory.set(key, { generation, expires, files, persisted: false });
  else memory.delete(key);
  return serialize(async () => {
    if (revoked.has(generation) || !isCurrent()) throw new Error("Session ended");
    const db = await open();
    try {
      const existing = (await readAll<Draft>(db, STORE)).filter((draft) => usable(draft, generation));
      const bytes = files.reduce((sum, item) => sum + item.file.size, 0)
        + existing.filter((draft) => draft.key !== key).reduce((sum, draft) => sum + draft.files.reduce((total, file) => total + file.size, 0), 0);
      if (bytes > MAX_BYTES) throw new Error("Temporary storage full");
      const previousIds = new Set(existing.find((draft) => draft.key === key)?.files.map((file) => file.clientFileId) ?? []);
      for (const item of files) {
        if (previousIds.has(item.clientFileId)) continue;
        // ArrayBuffer chunks avoid WebKit Blob persistence failures and full-file
        // conversion/copying. Only newly selected files are written.
        for (let offset = 0, index = 0; offset < item.file.size; offset += CHUNK_BYTES, index++) {
          if (revoked.has(generation) || !isCurrent()) throw new Error("Session ended");
          const data = await readBlobArrayBuffer(item.file.slice(offset, offset + CHUNK_BYTES));
          await write(db, CHUNKS, { key: chunkPrefix(key, item.clientFileId) + String(index).padStart(4, "0"),
            draftKey: key, generation, clientFileId: item.clientFileId, createdAt: Date.now(), data } satisfies Chunk);
        }
      }
      if (revoked.has(generation) || !isCurrent()) throw new Error("Session ended");
      const draft: Draft = { key, generation, expires, files: files.map(({ file, ...item }) => ({
        ...item, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified,
      })) };
      await prune(db, generation, draft, removedIds, isCurrent, addedIds);
      const cached = memory.get(key);
      if (cached?.files === files) cached.persisted = true;
    } catch (error) {
      await prune(db, generation, undefined, [], isCurrent).catch(() => undefined);
      throw error;
    } finally { db.close(); }
  });
}

/** Called on logout/account replacement; errors must never block logout. */
export function clearHomeworkDraftGeneration(generation: string): Promise<void> {
  revoked.add(generation);
  for (const [key, draft] of memory) if (draft.generation === generation) memory.delete(key);
  return serialize(async () => {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE, CHUNKS], "readwrite");
        for (const name of [STORE, CHUNKS]) {
          const request = transaction.objectStore(name).openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            if ((cursor.value as { generation: string }).generation === generation) cursor.delete();
            cursor.continue();
          };
        }
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
}
