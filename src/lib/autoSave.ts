/** 自动保存：首次进入时恢复上次项目，之后对文档改动做防抖写库。 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { useEditorStore } from '../store/editorStore';
import { ensureFonts } from './fontLoader';
import { getLastProjectId, getProject, listProjects, putProject, setLastProjectId } from './storage';

const DEBOUNCE_MS = 700;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStore {
  status: SaveStatus;
  savedAt: number | null;
  message: string | null;
}

export const useSaveStore = create<SaveStore>()(() => ({
  status: 'idle',
  savedAt: null,
  message: null,
}));

function setSaveState(patch: Partial<SaveStore>): void {
  useSaveStore.setState(patch);
}

/** 立即把当前文档写入本地数据库（切换/导入项目前调用，避免丢失未落盘的改动） */
export async function saveDocNow(): Promise<void> {
  const doc = useEditorStore.getState().doc;
  setSaveState({ status: 'saving', message: null });
  try {
    await putProject(doc);
    setLastProjectId(doc.id);
    setSaveState({ status: 'saved', savedAt: Date.now(), message: null });
  } catch (error) {
    setSaveState({
      status: 'error',
      message: error instanceof Error ? error.message : '保存到本地失败',
    });
    throw error;
  }
}

let restorePromise: Promise<void> | null = null;

async function restoreProject(): Promise<void> {
  try {
    const lastId = getLastProjectId();
    const last = lastId ? await getProject(lastId) : null;
    let doc = last;
    if (!doc) {
      const projects = await listProjects();
      doc = projects.length > 0 ? await getProject(projects[0].id) : null;
    }
    if (!doc) return;
    await ensureFonts(doc.fonts);
    useEditorStore.getState().loadDoc(doc);
    setLastProjectId(doc.id);
    setSaveState({ status: 'saved', savedAt: doc.updatedAt, message: null });
  } catch {
    /* 本地存储不可用时继续使用内存中的项目 */
    setSaveState({ status: 'idle', message: '本地存储不可用，本次改动不会被保存' });
  }
}

function ensureRestored(): Promise<void> {
  if (!restorePromise) restorePromise = restoreProject();
  return restorePromise;
}

let timer: number | undefined;

function scheduleSave(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void saveDocNow().catch(() => undefined);
  }, DEBOUNCE_MS);
}

/** 挂载在工作区：恢复项目并开启自动保存 */
export function useAutoSave(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    void ensureRestored().then(() => {
      if (disposed) return;
      unsubscribe = useEditorStore.subscribe((state, prev) => {
        if (state.doc !== prev.doc) scheduleSave();
      });
    });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);
}
