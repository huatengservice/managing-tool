"use client";

/**
 * Lightweight offline queue (spec §13): photo/note capture in poor-signal
 * areas is queued in IndexedDB and flushed when connectivity returns.
 * Deliberately minimal — one store, FIFO flush, no background-sync API.
 */

const DB_NAME = "huateng-offline";
const STORE = "queue";

export interface QueuedUpload {
  id?: number;
  kind: "job-photo";
  jobId: string;
  companyId: string;
  photoType: "before" | "after";
  fileName: string;
  blob: Blob;
  takenAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  queuedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: QueuedUpload): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function pendingCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Drain the queue through the provided uploader; stops at first failure. */
export async function flush(
  upload: (item: QueuedUpload) => Promise<void>
): Promise<{ flushed: number; remaining: number }> {
  const db = await openDb();
  const items: QueuedUpload[] = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedUpload[]);
    req.onerror = () => reject(req.error);
  });

  let flushed = 0;
  for (const item of items) {
    try {
      await upload(item);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(item.id!);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      flushed++;
    } catch {
      break; // still offline or server error — retry on next flush
    }
  }
  return { flushed, remaining: items.length - flushed };
}
