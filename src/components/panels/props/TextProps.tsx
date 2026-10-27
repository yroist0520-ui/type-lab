/** 整体文字层属性面板。 */

import { FONT_OPTIONS } from '../../../lib/fonts';
import { useEditorStore } from '../../../store/editorStore';
import type { TextAlign, TextDirection, TextLayer } from '../../../types/project';
import CharStrip from './CharStrip';
import { ChipGroup, NumberField, RangeField, SwatchRow, ToggleLine } from './fields';

const ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
];

const DIRECTION_OPTIONS: Array<{ value: TextDirection; label: string }> = [
  { value: 'horizontal', label: '横排' },
  { value: 'vertical', label: '竖排' },
];

export default function TextProps({ layer }: { layer: TextLayer }) {
  const updateTextLayer = useEditorStore((state) => state.updateTextLayer);
  const splitTextToCharLayers = useEditorStore((state) => state.splitTextToCharLayers);
  const removeLayers = useEditorStore((state) => state.removeLayers);

  const begin = () => useEditorStore.getState().pushHistory();
  const apply = (patch: Partial<TextLayer>) => updateTextLayer(layer.id, patch, false);

  return (
    <>
      <div className="props-head">
        <span className="props-head__kind">文字层</span>
        <div className="props-head__title">{layer.name}</div>
      </div>

      <section className="section">
        <div className="section__title">内容</div>
        <textarea
          className="textarea"
          value={layer.text}
          onFocus={begin}
          onChange={(event) => apply({ text: event.target.value })}
        />
      </section>

      <section className="section">
        <div className="section__title">字体</div>
        <select
          className="select"
          value={layer.fontId}
          onChange={(event) => {
            const font = FONT_OPTIONS.find((item) => item.id === event.target.value) ?? FONT_OPTIONS[0];
            updateTextLayer(layer.id, {
              fontId: font.id,
              fontFamily: font.family,
              fontWeight: font.defaultWeight,
            });
          }}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
        <p className="hint">当前字体族：{layer.fontFamily}</p>
      </section>

      <section className="section">
        <div className="section__title">排版</div>
        <RangeField
          label="字号"
          value={layer.fontSize}
          min={8}
          max={400}
          onStart={begin}
          onChange={(fontSize) => apply({ fontSize })}
        />
        <RangeField
          label="字间距"
          value={layer.letterSpacing}
          min={-40}
          max={120}
          onStart={begin}
          onChange={(letterSpacing) => apply({ letterSpacing })}
        />
        <RangeField
          label="行间距"
          value={layer.lineHeight}
          min={0.6}
          max={3}
          step={0.05}
          onStart={begin}
          onChange={(lineHeight) => apply({ lineHeight })}
        />
        <div className="section__title">对齐</div>
        <ChipGroup
          options={ALIGN_OPTIONS}
          value={layer.align}
          onChange={(align) => updateTextLayer(layer.id, { align })}
        />
        <div className="section__title">方向</div>
        <ChipGroup
          options={DIRECTION_OPTIONS}
          value={layer.direction}
          onChange={(direction) => updateTextLayer(layer.id, { direction })}
        />
        <ToggleLine
          label="自动换行"
          checked={layer.wrap}
          onChange={(wrap) => updateTextLayer(layer.id, { wrap })}
        />
        {layer.wrap && (
          <NumberField
            label="换行宽度"
            value={layer.wrapWidth}
            min={40}
            step={10}
            onStart={begin}
            onChange={(value) => apply({ wrapWidth: Math.max(40, Math.round(value)) })}
          />
        )}
      </section>

      <section className="section">
        <div className="section__title">外观</div>
        <SwatchRow value={layer.color} onChange={(color) => updateTextLayer(layer.id, { color })} />
        <RangeField
          label="不透明度"
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onStart={begin}
          onChange={(opacity) => apply({ opacity })}
        />
        <RangeField
          label="倾斜"
          value={layer.skewX}
          min={-45}
          max={45}
          unit="°"
          onStart={begin}
          onChange={(skewX) => apply({ skewX })}
        />
      </section>

      <section className="section">
        <ToggleLine
          label="文字描边"
          checked={layer.stroke.enabled}
          onChange={(enabled) => updateTextLayer(layer.id, { stroke: { ...layer.stroke, enabled } })}
        />
        {layer.stroke.enabled && (
          <>
            <SwatchRow
              value={layer.stroke.color}
              onChange={(color) => updateTextLayer(layer.id, { stroke: { ...layer.stroke, color } })}
            />
            <RangeField
              label="描边宽度"
              value={layer.stroke.width}
              min={0.5}
              max={24}
              step={0.5}
              onStart={begin}
              onChange={(width) => apply({ stroke: { ...layer.stroke, width } })}
            />
          </>
        )}
      </section>

      <section className="section">
        <ToggleLine
          label="文字阴影"
          checked={layer.shadow.enabled}
          onChange={(enabled) => updateTextLayer(layer.id, { shadow: { ...layer.shadow, enabled } })}
        />
        {layer.shadow.enabled && (
          <>
            <SwatchRow
              value={layer.shadow.color}
              onChange={(color) => updateTextLayer(layer.id, { shadow: { ...layer.shadow, color } })}
            />
            <RangeField
              label="模糊"
              value={layer.shadow.blur}
              min={0}
              max={80}
              onStart={begin}
              onChange={(blur) => apply({ shadow: { ...layer.shadow, blur } })}
            />
            <div className="grid-2">
              <NumberField
                label="偏移 X"
                value={layer.shadow.offsetX}
                step={1}
                onStart={begin}
                onChange={(offsetX) => apply({ shadow: { ...layer.shadow, offsetX } })}
              />
              <NumberField
                label="偏移 Y"
                value={layer.shadow.offsetY}
                step={1}
                onStart={begin}
                onChange={(offsetY) => apply({ shadow: { ...layer.shadow, offsetY } })}
              />
            </div>
            <RangeField
              label="阴影浓度"
              value={layer.shadow.opacity}
              min={0}
              max={1}
              step={0.01}
              onStart={begin}
              onChange={(opacity) => apply({ shadow: { ...layer.shadow, opacity } })}
            />
          </>
        )}
      </section>

      <section className="section">
        <div className="section__title">变换</div>
        <div className="grid-2">
          <NumberField label="X" value={layer.x} step={1} onStart={begin} onChange={(x) => apply({ x })} />
          <NumberField label="Y" value={layer.y} step={1} onStart={begin} onChange={(y) => apply({ y })} />
          <NumberField
            label="旋转"
            value={layer.rotation}
            step={1}
            onStart={begin}
            onChange={(rotation) => apply({ rotation })}
          />
          <NumberField
            label="缩放"
            value={layer.scaleX}
            step={0.05}
            onStart={begin}
            onChange={(scale) => apply({ scaleX: scale, scaleY: scale })}
          />
        </div>
      </section>

      <CharStrip layer={layer} />

      <section className="section">
        <div className="section__title">结构</div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => splitTextToCharLayers(layer.id)}
        >
          拆分为独立字符图层
        </button>
        <p className="hint">拆分后每个字符都是可单独移动、旋转、缩放的图层，原文字层将被替换。</p>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => removeLayers([layer.id])}>
          删除图层
        </button>
      </section>
    </>
  );
}
