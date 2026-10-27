/** 本地项目存储：项目本体写入 IndexedDB，轻量设置写入 localStorage。 */

import { nanoid } from 'nanoid';
import type { ProjectDoc } from '../types/project';

const DB_NAME = 'type-lab';
const DB_VERSION = 1;
const STORE = 'projects';
const LAST_PROJECT_KEY = 'typelab:last-project';

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  layerCount: number;
  width: number;
  height: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本地数据库'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地数据库，浏览器可能禁用了存储'));
  });
  return dbPromise;
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地数据库操作失败'));
  });
}

function summarise(doc: ProjectDoc): ProjectSummary {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    layerCount: Array.isArray(doc.layers) ? doc.layers.length : 0,
    width: doc.canvas.width,
    height: doc.canvas.height,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const docs = await toPromise(store.getAll() as IDBRequest<ProjectDoc[]>);
  return docs
    .filter((doc) => doc && typeof doc.id === 'string')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(summarise);
}

export async function getProject(id: string): Promise<ProjectDoc | null> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const doc = await toPromise(store.get(id) as IDBRequest<ProjectDoc | undefined>);
  return doc ?? null;
}

export async function putProject(doc: ProjectDoc): Promise<void> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await toPromise(store.put(doc));
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await toPromise(store.delete(id));
}

export async function duplicateProject(id: string): Promise<ProjectDoc | null> {
  const doc = await getProject(id);
  if (!doc) return null;
  const now = Date.now();
  const copy: ProjectDoc = {
    ...doc,
    id: nanoid(10),
    name: `${doc.name || '未命名项目'} 副本`,
    createdAt: now,
    updatedAt: now,
  };
  await putProject(copy);
  return copy;
}

export function getLastProjectId(): string | null {
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(LAST_PROJECT_KEY, id);
    else window.localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* localStorage 不可用时忽略，IndexedDB 中的项目仍然可用 */
  }
}
