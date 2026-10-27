/** 左栏「图层」：查看、选择、隐藏、锁定、排序、复制与删除。 */

import { useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { AnyLayer } from '../../types/project';

const KIND_LABEL: Record<AnyLayer['type'], string> = {
  text: 'TXT',
  char: 'CHR',
  image: 'IMG',
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-on' : ''}`}
      title={title}
      aria-label={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {children}
    </button>
  );
}

export default function LayersPanel() {
  const layers = useEditorStore((state) => state.doc.layers);
  const selectedIds = useEditorStore((state) => state.selection.layerIds);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const toggleVisible = useEditorStore((state) => state.toggleVisible);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const reorderLayer = useEditorStore((state) => state.reorderLayer);
  const duplicateLayers = useEditorStore((state) => state.duplicateLayers);
  const removeLayers = useEditorStore((state) => state.removeLayers);
  const renameLayer = useEditorStore((state) => state.renameLayer);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const ordered = useMemo(() => [...layers].reverse(), [layers]);

  const commitName = () => {
    if (editingId) {
      const next = draftName.trim();
      if (next) renameLayer(editingId, next);
    }
    setEditingId(null);
  };

  return (
    <div className="panel__scroll">
      <div className="panel__head">
        图层 {layers.length}
      </div>
      {ordered.length === 0 ? (
        <div className="section">
          <p className="hint">画布还没有对象。先在「素材」里添加文字。</p>
        </div>
      ) : (
        <div className="layer-list">
          {ordered.map((layer) => {
            const selected = selectedIds.includes(layer.id);
            return (
              <div
                key={layer.id}
                className={`layer-row ${selected ? 'is-selected' : ''} ${layer.visible ? '' : 'is-hidden'}`}
                onClick={(event) => selectLayer(layer.id, event.shiftKey || event.metaKey)}
                onDoubleClick={() => {
                  setEditingId(layer.id);
                  setDraftName(layer.name);
                }}
              >
                <span className="layer-row__kind">{KIND_LABEL[layer.type]}</span>
                {editingId === layer.id ? (
                  <input
                    className="input"
                    style={{ height: 22 }}
                    value={draftName}
                    autoFocus
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={commitName}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitName();
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="layer-row__name" title={layer.name}>
                    {layer.name}
                  </span>
                )}
                <div className="layer-row__tools">
                  <IconButton
                    title={layer.visible ? '隐藏图层' : '显示图层'}
                    active={!layer.visible}
                    onClick={() => toggleVisible(layer.id)}
                  >
                    {layer.visible ? (
                      <Icon>
                        <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" />
                        <circle cx="8" cy="8" r="1.8" />
                      </Icon>
                    ) : (
                      <Icon>
                        <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" />
                        <path d="M2.5 13.5 13.5 2.5" />
                      </Icon>
                    )}
                  </IconButton>
                  <IconButton
                    title={layer.locked ? '解锁图层' : '锁定图层'}
                    active={layer.locked}
                    onClick={() => toggleLock(layer.id)}
                  >
                    {layer.locked ? (
                      <Icon>
                        <rect x="3.5" y="7" width="9" height="7" rx="1" />
                        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
                      </Icon>
                    ) : (
                      <Icon>
                        <rect x="3.5" y="7" width="9" height="7" rx="1" />
                        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 4.6-1.2" />
                      </Icon>
                    )}
                  </IconButton>
                  <IconButton title="上移一层" onClick={() => reorderLayer(layer.id, 'up')}>
                    <Icon>
                      <path d="M8 12.5v-9" />
                      <path d="m4 7 4-4 4 4" />
                    </Icon>
                  </IconButton>
                  <IconButton title="下移一层" onClick={() => reorderLayer(layer.id, 'down')}>
                    <Icon>
                      <path d="M8 3.5v9" />
                      <path d="m4 9 4 4 4-4" />
                    </Icon>
                  </IconButton>
                  <IconButton title="复制图层" onClick={() => duplicateLayers([layer.id])}>
                    <Icon>
                      <rect x="5" y="5" width="8" height="8" rx="1" />
                      <path d="M3 10.5V3h7.5" />
                    </Icon>
                  </IconButton>
                  <IconButton title="删除图层" onClick={() => removeLayers([layer.id])}>
                    <Icon>
                      <path d="M3 4.5h10" />
                      <path d="M6.2 4.5V3h3.6v1.5" />
                      <path d="M4.6 4.5 5.3 13h5.4l.7-8.5" />
                    </Icon>
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
