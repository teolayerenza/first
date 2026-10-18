"use client";

// Cola sin señal: si el envío falla por red, el aporte (y su foto ya comprimida) queda en IndexedDB
// y se manda solo cuando vuelve la conexión.

import type { SubmitInput } from "../domain/schemas";

const DB = "pocitos";
const STORE = "outbox";

export interface QueuedItem {
  id?: number;
  payload: SubmitInput;
  photo?: { blob: Blob; type: string } | null;
  queuedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const enqueue = (item: QueuedItem) => tx("readwrite", (s) => s.add(item));
export const pending = () => tx<QueuedItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedItem[]>);
export const remove = (id: number) => tx("readwrite", (s) => s.delete(id));
