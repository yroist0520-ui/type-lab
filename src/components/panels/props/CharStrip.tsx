/** 逐字编辑：字符条 + 单字 / 多字属性。 */

import { useState } from 'react';
import { extractGlyphSvg } from '../../../lib/glyphSvg';
import { useEditorStore } from '../../../store/editorStore';
import type { CharOverride, TextLayer } from '../../../types/project';
import { NumberField, RangeField, SwatchRow, ToggleLine } from './fields';

function blankOverride(layer: TextLayer, index: number): CharOverride {
  const chars = Array.from(layer.text);
  return {
    id: '',
    char: chars[index] ?? '',
    index,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontSize: null,
    color: null,
    opacity: null,
    stroke: null,
    shadow: null,
    spacingBefore: 0,
    spacingAfter: 0,
    hidden: false,
    glyphId: null,
  };
}

function isModified(override: CharOverride | undefined): boolean {
  if (!override) return false;
  return (
    override.offsetX !== 0 ||
    override.offsetY !== 0 ||
    override.rotation !== 0 ||
    override.scaleX !== 1 ||
    override.scaleY !== 1 ||
    override.fontSize !== null ||
    override.color !== null ||
    override.opacity !== null ||
    override.stroke !== null ||
    override.shadow !== null ||
    override.spacingBefore !== 0 ||
    override.spacingAfter !== 0 ||
    override.hidden ||
    Boolean(override.glyphId)
  );
}

interface EditorProps {
  layer: TextLayer;
  index: number;
  override: CharOverride;
}

function CharOverrideEditor({ layer, index, override }: EditorProps) {
  const updateChar = useEditorStore((state) => state.updateChar);
  const resetChar = useEditorStore((state) => state.resetChar);
  const deleteChar = useEditorStore((state) => state.deleteChar);
  const duplicateChar = useEditorStore((state) => state.duplicateChar);
  const moveChar = useEditorStore((state) => state.moveChar);
  const splitLineAt = useEditorStore((state) => state.splitLineAt);
  const importedFonts = useEditorStore((state) => state.doc.fonts);

  const [glyphError, setGlyphError] = useState<string | null>(null);

  const begin = () => useEditorStore.getState().pushHistory();
  const apply = (patch: Partial<CharOverride>) => updateChar(layer.id, index, patch, false);

  const importedFont = importedFonts.find((font) => font.id === layer.fontId);

  const handleExtractGlyph = async () => {
    if (!importedFont) return;
    const result = await extractGlyphSvg(
      importedFont.src,
      override.char,
      Math.max(120, Math.round(layer.fontSize * 3)),
    );
    if (!result) {
      setGlyphError(`「${importedFont.label}」中找不到该字符的轮廓，无法提取。`);
      return;
    }
    setGlyphError(null);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`;
    useEditorStore.getState().addImageLayer(src, { width: result.width, height: result.height });
  };

  return (
    <>
      <div className="section__title">
        单字 · {override.char === '\n' ? '换行' : override.char || '空格'}
      </div>
      <RangeField
        label="字号"
        value={override.fontSize ?? layer.fontSize}
        min={8}
        max={400}
        onStart={begin}
        onChange={(fontSize) => apply({ fontSize })}
      />
      <SwatchRow
        value={override.color ?? layer.color}
        onChange={(color) => updateChar(layer.id, index, { color })}
      />
      <RangeField
        label="不透明度"
        value={override.opacity ?? 1}
        min={0}
        max={1}
        step={0.01}
        onStart={begin}
        onChange={(opacity) => apply({ opacity })}
      />
      <RangeField
        label="旋转"
        value={override.rotation}
        min={-180}
        max={180}
        unit="°"
        onStart={begin}
        onChange={(rotation) => apply({ rotation })}
      />
      <div className="grid-2">
        <NumberField
          label="偏移 X"
          value={override.offsetX}
          step={1}
          onStart={begin}
          onChange={(offsetX) => apply({ offsetX })}
        />
        <NumberField
          label="偏移 Y"
          value={override.offsetY}
          step={1}
          onStart={begin}
          onChange={(offsetY) => apply({ offsetY })}
        />
        <NumberField
          label="宽度"
          value={override.scaleX}
          step={0.05}
          onStart={begin}
          onChange={(scaleX) => apply({ scaleX })}
        />
        <NumberField
          label="高度"
          value={override.scaleY}
          step={0.05}
          onStart={begin}
          onChange={(scaleY) => apply({ scaleY })}
        />
        <NumberField
          label="前间距"
          value={override.spacingBefore}
          step={1}
          onStart={begin}
          onChange={(spacingBefore) => apply({ spacingBefore })}
        />
        <NumberField
          label="后间距"
          value={override.spacingAfter}
          step={1}
          onStart={begin}
          onChange={(spacingAfter) => apply({ spacingAfter })}
        />
      </div>
      <ToggleLine
        label="隐藏该字"
        checked={override.hidden}
        onChange={(hidden) => updateChar(layer.id, index, { hidden })}
      />
      <div className="row row--wrap">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => duplicateChar(layer.id, index)}>
          复制字符
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => deleteChar(layer.id, index)}>
          删除字符
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => resetChar(layer.id, index)}>
          重置样式
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => moveChar(layer.id, index, 'prev')}>
          左移
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => moveChar(layer.id, index, 'next')}>
          右移
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => splitLineAt(layer.id, index)}>
          此后换行
        </button>
        {importedFont && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleExtractGlyph}>
            提取字形 SVG
          </button>
        )}
        {override.glyphId && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => useEditorStore.getState().assignGlyph(layer.id, index, null)}
          >
            转回字体渲染
          </button>
        )}
      </div>
      {glyphError && <p className="hint">{glyphError}</p>}
    </>
  );
}

function BatchEditor({ layer, indices }: { layer: TextLayer; indices: number[] }) {
  const updateChar = useEditorStore((state) => state.updateChar);
  const begin = () => useEditorStore.getState().pushHistory();

  const applyAll = (patch: Partial<CharOverride>) => {
    indices.forEach((index) => updateChar(layer.id, index, patch, false));
  };

  return (
    <>
      <div className="section__title">批量 · 已选 {indices.length} 个字符</div>
      <RangeField
        label="统一字号"
        value={layer.fontSize}
        min={8}
        max={400}
        onStart={begin}
        onChange={(fontSize) => applyAll({ fontSize })}
      />
      <SwatchRow value={layer.color} onChange={(color) => applyAll({ color })} />
      <div className="row row--wrap">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => applyAll({ fontSize: null, color: null, opacity: null, stroke: null, shadow: null })}>
          清除颜色与字号
        </button>
      </div>
    </>
  );
}

export default function CharStrip({ layer }: { layer: TextLayer }) {
  const charIndices = useEditorStore((state) => state.selection.charIndices);
  const selectChars = useEditorStore((state) => state.selectChars);

  const chars = Array.from(layer.text);

  const toggle = (index: number) => {
    const next = charIndices.includes(index)
      ? charIndices.filter((item) => item !== index)
      : [...charIndices, index].sort((a, b) => a - b);
    selectChars(layer.id, next);
  };

  const activeIndex = charIndices.length === 1 ? charIndices[0] : null;
  const override =
    activeIndex === null
      ? null
      : layer.chars.find((item) => item.index === activeIndex) ?? blankOverride(layer, activeIndex);

  return (
    <section className="section">
      <div className="section__title">逐字编辑</div>
      <div className="char-strip">
        {chars.map((char, index) => (
          <button
            key={`${index}-${char}`}
            type="button"
            className={`char-chip ${charIndices.includes(index) ? 'is-active' : ''} ${
              isModified(layer.chars.find((item) => item.index === index)) ? 'is-modified' : ''
            }`}
            title={char === '\n' ? '换行' : char}
            onClick={() => toggle(index)}
          >
            {char === '\n' ? '⏎' : char === ' ' ? '␣' : char}
          </button>
        ))}
      </div>

      {activeIndex !== null && override && (
        <CharOverrideEditor layer={layer} index={activeIndex} override={override} />
      )}

      {charIndices.length > 1 && <BatchEditor layer={layer} indices={charIndices} />}

      {charIndices.length === 0 && <p className="hint">点击上方字符进行操作，仅修改被选中的字符。</p>}
    </section>
  );
}
