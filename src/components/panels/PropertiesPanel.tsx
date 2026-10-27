/** 右栏属性面板：按当前选择动态切换画布 / 文字 / 独立字符 / 图片。 */

import { useActiveLayer, useEditorStore } from '../../store/editorStore';
import CharProps from './props/CharProps';
import ImageProps from './props/ImageProps';
import TextProps from './props/TextProps';
import { ChipGroup, NumberField, SwatchRow } from './props/fields';

type BackgroundMode = 'white' | 'black' | 'transparent' | 'custom';

function CanvasProps() {
  const canvas = useEditorStore((state) => state.doc.canvas);
  const setCanvas = useEditorStore((state) => state.setCanvas);
  const fitViewport = useEditorStore((state) => state.fitViewport);
  const centerViewport = useEditorStore((state) => state.centerViewport);

  const background = canvas.background;
  const mode: BackgroundMode =
    background.type === 'transparent'
      ? 'transparent'
      : background.color.toLowerCase() === '#ffffff'
        ? 'white'
        : background.color.toLowerCase() === '#111111'
          ? 'black'
          : 'custom';

  const applySize = (patch: { width?: number; height?: number }) => setCanvas(patch, true);

  return (
    <>
      <div className="props-head">
        <span className="props-head__kind">画布</span>
        <div className="props-head__title">未选择对象</div>
      </div>

      <section className="section">
        <div className="section__title">尺寸</div>
        <div className="grid-2">
          <NumberField
            label="宽度"
            value={canvas.width}
            min={64}
            max={8000}
            step={10}
            onChange={(width) => applySize({ width: Math.max(64, Math.round(width)) })}
          />
          <NumberField
            label="高度"
            value={canvas.height}
            min={64}
            max={8000}
            step={10}
            onChange={(height) => applySize({ height: Math.max(64, Math.round(height)) })}
          />
        </div>
        <div className="row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={fitViewport}>
            适应屏幕
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={centerViewport}>
            居中画布
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section__title">背景</div>
        <ChipGroup<BackgroundMode>
          options={[
            { value: 'white', label: '白色' },
            { value: 'black', label: '黑色' },
            { value: 'transparent', label: '透明' },
            { value: 'custom', label: '自定义' },
          ]}
          value={mode}
          onChange={(next) => {
            if (next === 'white') setCanvas({ background: { type: 'color', color: '#ffffff' } }, true);
            else if (next === 'black') setCanvas({ background: { type: 'color', color: '#111111' } }, true);
            else if (next === 'transparent') setCanvas({ background: { type: 'transparent', color: '#ffffff' } }, true);
            else setCanvas({ background: { type: 'color', color: background.color || '#ff3b00' } }, true);
          }}
        />
        {mode === 'custom' && (
          <SwatchRow
            value={background.color}
            onChange={(color) => setCanvas({ background: { type: 'color', color } }, true)}
          />
        )}
        <p className="hint">选择透明背景时画布以棋盘格显示，导出可保留透明通道。</p>
      </section>
    </>
  );
}

export default function PropertiesPanel() {
  const layer = useActiveLayer();

  return (
    <div className="panel__scroll">
      {!layer && <CanvasProps />}
      {layer && layer.type === 'text' && <TextProps layer={layer} />}
      {layer && layer.type === 'char' && <CharProps layer={layer} />}
      {layer && layer.type === 'image' && <ImageProps layer={layer} />}
    </div>
  );
}
