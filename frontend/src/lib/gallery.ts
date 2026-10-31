import type { Face } from '../types';

/**
 * Registered faces, kept in the browser's IndexedDB. Nothing leaves the device.
 * Each record holds the 128-number face descriptor and a small JPEG thumbnail.
 */

const DB_NAME = 'facematcher';
const STORE = 'faces';

export interface StoredFace extends Face {
  descriptor: number[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the local face database.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Local face database error.'));
      tx.onabort = () => reject(tx.error ?? new Error('Local face database error.'));
    });
  } finally {
    db.close();
  }
}

export async function addFace(name: string, descriptor: ArrayLike<number>, thumbnail: string): Promise<Face> {
  const record = {
    name,
    descriptor: Array.from(descriptor),
    image_path: thumbnail,
    created_at: new Date().toISOString(),
  };
  const id = await run('readwrite', (s) => s.add(record));
  return { id: Number(id), name, image_path: thumbnail, created_at: record.created_at };
}

export async function getAllFaces(): Promise<StoredFace[]> {
  const all = await run('readonly', (s) => s.getAll() as IDBRequest<StoredFace[]>);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
}

export async function removeFace(id: number): Promise<boolean> {
  const existing = await run('readonly', (s) => s.get(id));
  if (!existing) return false;
  await run('readwrite', (s) => s.delete(id));
  return true;
}
