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

type SheetTab = 'assets' | 'fonts' | 'ai' | 'layers' | 'props';

const MOBILE_NAV: Array<{ id: SheetTab; label: string }> = [
  { id: 'assets', label: '素材' },
  { id: 'fonts', label: '字体' },
  { id: 'ai', label: 'AI' },
  { id: 'layers', label: '图层' },
  { id: 'props', label: '属性' },
];

export default function Workspace({ onExit }: { onExit: () => void }) {
  const activePanel = useEditorStore((state) => state.activePanel);
  const setActivePanel = useEditorStore((state) => state.setActivePanel);
  const [modal, setModal] = useState<ModalKind>('none');
  const [sheet, setSheet] = useState<SheetTab | null>(null);

  useAutoSave();

  const closeSheet = () => setSheet(null);

  const handleNav = (tab: SheetTab) => {
    if (tab === 'props') {
      setSheet((current) => (current === 'props' ? null : 'props'));
      return;
    }
    setActivePanel(tab);
    setSheet((current) => (current === tab ? null : tab));
  };

  const bodyClass =
    sheet === 'props' ? 'studio__body is-props-sheet' : sheet ? 'studio__body is-left-sheet' : 'studio__body';

  return (
    <div className="studio">
      <TopBar
        onExit={onExit}
        onOpenProjects={() => setModal('projects')}
        onOpenExport={() => setModal('export')}
      />

      <div className={bodyClass}>
        <aside className="panel panel--left">
          <button type="button" className="sheet__grip" aria-label="收起面板" onClick={closeSheet}>
            <span />
          </button>
          <div className="panel__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`panel__tab ${activePanel === tab.id ? 'is-active' : ''}`}
                onClick={() => {
                  setActivePanel(tab.id);
                  setSheet(tab.id);
                }}
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
          <button type="button" className="sheet__grip" aria-label="收起面板" onClick={closeSheet}>
            <span />
          </button>
          <div className="panel__head">属性</div>
          <PropertiesPanel />
        </aside>
      </div>

      <nav className="mobile-nav" aria-label="移动端面板">
        {MOBILE_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav__item ${sheet === item.id ? 'is-active' : ''}`}
            aria-pressed={sheet === item.id}
            onClick={() => handleNav(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {modal === 'projects' && <ProjectModal onClose={() => setModal('none')} />}
      {modal === 'export' && <ExportModal onClose={() => setModal('none')} />}
    </div>
  );
}
