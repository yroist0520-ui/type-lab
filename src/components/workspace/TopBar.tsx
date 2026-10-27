/** 工作区顶栏：返回首页、项目命名、保存状态、项目与导出入口、撤销重做、视图缩放。 */

import { useSaveStore } from '../../lib/autoSave';
import { useEditorStore } from '../../store/editorStore';

function clockText(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TopBar({
  onExit,
  onOpenProjects,
  onOpenExport,
}: {
  onExit: () => void;
  onOpenProjects: () => void;
  onOpenExport: () => void;
}) {
  const name = useEditorStore((state) => state.doc.name);
  const setProjectName = useEditorStore((state) => state.setProjectName);
  const pastLength = useEditorStore((state) => state.past.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const viewport = useEditorStore((state) => state.viewport);
  const zoomBy = useEditorStore((state) => state.zoomBy);
  const fitViewport = useEditorStore((state) => state.fitViewport);
  const centerViewport = useEditorStore((state) => state.centerViewport);

  const saveStatus = useSaveStore((state) => state.status);
  const savedAt = useSaveStore((state) => state.savedAt);
  const saveMessage = useSaveStore((state) => state.message);

  const saveText =
    saveStatus === 'saving'
      ? '保存中…'
      : saveStatus === 'saved' && savedAt
        ? `已保存 ${clockText(savedAt)}`
        : saveStatus === 'error'
          ? '保存失败'
          : '未保存';

  return (
    <header className="topbar">
      <button type="button" className="topbar__brand" onClick={onExit} title="返回首页">
        <span className="mono">TYPE LAB</span>
      </button>

      <span className="topbar__sep" />

      <input
        className="topbar__name"
        value={name}
        aria-label="项目名称"
        onChange={(event) => setProjectName(event.target.value)}
      />

      <span className="topbar__sep" />

      <button
        type="button"
        className="btn btn--icon"
        title="撤销 (⌘Z)"
        disabled={pastLength === 0}
        onClick={undo}
      >
        ↺
      </button>
      <button
        type="button"
        className="btn btn--icon"
        title="恢复 (⇧⌘Z)"
        disabled={futureLength === 0}
        onClick={redo}
      >
        ↻
      </button>

      <span className="topbar__spacer" />

      <span
        className={`topbar__save mono ${saveStatus === 'error' ? 'is-error' : ''}`}
        title={saveMessage ?? '自动保存到当前浏览器'}
      >
        {saveText}
      </span>

      <button type="button" className="btn btn--sm btn--ghost" onClick={onOpenProjects}>
        项目
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onOpenExport}>
        导出 PNG
      </button>

      <span className="topbar__sep" />

      <div className="topbar__zoom">
        <button type="button" className="btn btn--icon" title="缩小" onClick={() => zoomBy(1 / 1.2)}>
          −
        </button>
        <span className="mono">{Math.round(viewport.scale * 100)}%</span>
        <button type="button" className="btn btn--icon" title="放大" onClick={() => zoomBy(1.2)}>
          +
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={fitViewport}>
          适应
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={centerViewport}>
          居中
        </button>
      </div>
    </header>
  );
}
