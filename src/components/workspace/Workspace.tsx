/** 工作区外壳：顶栏 + 三栏布局（素材/图层 · 画布 · 属性）。 */

import { useState } from 'react';
import { useAutoSave } from '../../lib/autoSave';
import { useEditorStore } from '../../store/editorStore';
import CanvasStage from '../canvas/CanvasStage';
import AssetsPanel from '../panels/AssetsPanel';
import FontsPanel from '../panels/FontsPanel';
import GlyphPanel from '../panels/GlyphPanel';
import LayersPanel from '../panels/LayersPanel';
import PropertiesPanel from '../panels/PropertiesPanel';
import ExportModal from './ExportModal';
import ProjectModal from './ProjectModal';
import TopBar from './TopBar';

const TABS: Array<{ id: 'assets' | 'fonts' | 'ai' | 'layers'; label: string }> = [
  { id: 'assets', label: '素材' },
  { id: 'fonts', label: '字体' },
  { id: 'ai', label: 'AI 字形' },
  { id: 'layers', label: '图层' },
];

type ModalKind = 'none' | 'projects' | 'export';

export default function Workspace({ onExit }: { onExit: () => void }) {
  const activePanel = useEditorStore((state) => state.activePanel);
  const setActivePanel = useEditorStore((state) => state.setActivePanel);
  const [modal, setModal] = useState<ModalKind>('none');

  useAutoSave();

  return (
    <div className="studio">
      <TopBar
        onExit={onExit}
        onOpenProjects={() => setModal('projects')}
        onOpenExport={() => setModal('export')}
      />

      <div className="studio__body">
        <aside className="panel panel--left">
          <div className="panel__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`panel__tab ${activePanel === tab.id ? 'is-active' : ''}`}
                onClick={() => setActivePanel(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activePanel === 'assets' && <AssetsPanel />}
          {activePanel === 'fonts' && <FontsPanel />}
          {activePanel === 'ai' && <GlyphPanel />}
          {activePanel === 'layers' && <LayersPanel />}
        </aside>

        <CanvasStage />

        <aside className="panel panel--right">
          <div className="panel__head">属性</div>
          <PropertiesPanel />
        </aside>
      </div>

      {modal === 'projects' && <ProjectModal onClose={() => setModal('none')} />}
      {modal === 'export' && <ExportModal onClose={() => setModal('none')} />}
    </div>
  );
}
