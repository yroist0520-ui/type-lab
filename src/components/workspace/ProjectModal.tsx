/** 项目弹层：本地项目列表、新建/打开/重命名/复制/删除、.typelab 导入导出。 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDocNow } from '../../lib/autoSave';
import { ensureFonts } from '../../lib/fontLoader';
import { downloadProjectArchive, readProjectFile } from '../../lib/projectFile';
import {
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  putProject,
  setLastProjectId,
  type ProjectSummary,
} from '../../lib/storage';
import { useEditorStore } from '../../store/editorStore';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

async function flushCurrentDoc(): Promise<void> {
  const doc = useEditorStore.getState().doc;
  if (doc.updatedAt === doc.createdAt) return;
  await saveDocNow().catch(() => undefined);
}

export default function ProjectModal({ onClose }: { onClose: () => void }) {
  const currentId = useEditorStore((state) => state.doc.id);
  const currentName = useEditorStore((state) => state.doc.name);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const cancelRenameRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
      setError(null);
    } catch (err) {
      setError(messageOf(err, '读取本地项目失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const openProject = async (id: string) => {
    if (id === currentId) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await flushCurrentDoc();
      const doc = await getProject(id);
      if (!doc) {
        setError('项目不存在，可能已被删除');
        await refresh();
        return;
      }
      await ensureFonts(doc.fonts);
      useEditorStore.getState().loadDoc(doc);
      useEditorStore.getState().fitViewport();
      setLastProjectId(doc.id);
      onClose();
    } catch (err) {
      setError(messageOf(err, '打开项目失败'));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const createProject = async () => {
    if (!window.confirm('新建项目会清空当前画布，确定继续？建议先导出 .typelab 备份。')) return;
    setBusy(true);
    try {
      await flushCurrentDoc();
      useEditorStore.getState().newDoc();
      useEditorStore.getState().fitViewport();
      setLastProjectId(null);
      onClose();
    } catch (err) {
      setError(messageOf(err, '新建项目失败'));
    } finally {
      setBusy(false);
    }
  };

  const startRename = (project: ProjectSummary) => {
    cancelRenameRef.current = false;
    setRenamingId(project.id);
    setRenameValue(project.name);
  };

  const commitRename = async (id: string) => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    setBusy(true);
    try {
      const doc = await getProject(id);
      if (doc) await putProject({ ...doc, name, updatedAt: Date.now() });
      if (id === currentId) useEditorStore.getState().setProjectName(name);
      await refresh();
    } catch (err) {
      setError(messageOf(err, '重命名失败'));
    } finally {
      setBusy(false);
    }
  };

  const copyProject = async (project: ProjectSummary) => {
    setBusy(true);
    try {
      await duplicateProject(project.id);
      setNotice(`已复制「${project.name}」`);
      await refresh();
    } catch (err) {
      setError(messageOf(err, '复制项目失败'));
    } finally {
      setBusy(false);
    }
  };

  const removeProject = async (project: ProjectSummary) => {
    if (!window.confirm(`删除「${project.name}」？该操作不可撤销。`)) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      if (project.id === currentId) {
        useEditorStore.getState().newDoc();
        useEditorStore.getState().fitViewport();
        setLastProjectId(null);
      }
      setNotice(`已删除「${project.name}」`);
      await refresh();
    } catch (err) {
      setError(messageOf(err, '删除项目失败'));
    } finally {
      setBusy(false);
    }
  };

  const exportCurrent = async () => {
    setBusy(true);
    try {
      downloadProjectArchive(useEditorStore.getState().doc);
      await saveDocNow().catch(() => undefined);
      setNotice('已导出当前项目，请保存好 .typelab 文件');
      await refresh();
    } catch (err) {
      setError(messageOf(err, '导出项目失败'));
    } finally {
      setBusy(false);
    }
  };

  const importProject = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { doc, warnings } = await readProjectFile(file);
      await flushCurrentDoc();
      await ensureFonts(doc.fonts);
      await putProject(doc);
      useEditorStore.getState().loadDoc(doc);
      useEditorStore.getState().fitViewport();
      setLastProjectId(doc.id);
      await refresh();
      if (warnings.length > 0) {
        setNotice(`已导入「${doc.name}」，但有 ${warnings.length} 处素材缺失：${warnings[0]}`);
      } else {
        setNotice(`已导入「${doc.name}」`);
        onClose();
      }
    } catch (err) {
      setError(messageOf(err, '导入失败，请确认文件是有效的 .typelab 项目'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="项目"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <span>项目 · 当前「{currentName || '未命名项目'}」</span>
          <button type="button" className="btn btn--icon" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal__body">
          <p className="hint">
            项目保存在当前浏览器本地。清理浏览器缓存或更换浏览器可能导致项目丢失，重要项目请导出
            .typelab 备份。
          </p>

          {loading ? (
            <p className="hint">读取本地项目…</p>
          ) : projects.length === 0 ? (
            <p className="hint">还没有本地项目。新建项目后会自动保存到本浏览器。</p>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`project-row ${project.id === currentId ? 'is-current' : ''}`}
                >
                  <div className="project-row__main">
                    {renamingId === project.id ? (
                      <input
                        className="input"
                        autoFocus
                        value={renameValue}
                        aria-label="项目名称"
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => void commitRename(project.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') {
                            cancelRenameRef.current = true;
                            setRenamingId(null);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <div className="project-row__name">{project.name || '未命名项目'}</div>
                        <div className="project-row__meta">
                          {formatTime(project.updatedAt)} · {project.layerCount} 个图层 ·{' '}
                          {project.width}×{project.height}
                          {project.id === currentId ? ' · 当前' : ''}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="project-row__tools">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => void openProject(project.id)}
                    >
                      {project.id === currentId ? '编辑中' : '打开'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => startRename(project)}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => void copyProject(project)}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => void removeProject(project)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notice && <p className="hint">{notice}</p>}
          {error && <p className="hint hint--danger">{error}</p>}
        </div>

        <div className="modal__foot">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => importRef.current?.click()}
          >
            导入 .typelab
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void exportCurrent()}>
            导出当前 .typelab
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void createProject()}>
            新建项目
          </button>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".typelab"
          hidden
          onChange={(event) => {
            void importProject(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
