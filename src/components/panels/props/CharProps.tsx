/** 独立字符图层属性面板。 */

import { useEditorStore } from '../../../store/editorStore';
import type { CharLayer } from '../../../types/project';
import { NumberField, RangeField, SwatchRow, ToggleLine } from './fields';

export default function CharProps({ layer }: { layer: CharLayer }) {
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const removeLayers = useEditorStore((state) => state.removeLayers);

  const begin = () => useEditorStore.getState().pushHistory();
  const apply = (patch: Partial<CharLayer>) => updateLayer(layer.id, patch, false);

  return (
    <>
      <div className="props-head">
        <span className="props-head__kind">独立字符</span>
        <div className="props-head__title">{layer.char === ' ' ? '空格' : layer.char}</div>
      </div>

      <section className="section">
        <div className="section__title">文字</div>
        <RangeField
          label="字号"
          value={layer.fontSize}
          min={8}
          max={400}
          onStart={begin}
          onChange={(fontSize) => apply({ fontSize })}
        />
        <SwatchRow value={layer.color} onChange={(color) => updateLayer(layer.id, { color })} />
        <RangeField
          label="不透明度"
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onStart={begin}
          onChange={(opacity) => apply({ opacity })}
        />
      </section>

      <section className="section">
        <ToggleLine
          label="文字描边"
          checked={layer.stroke.enabled}
          onChange={(enabled) => updateLayer(layer.id, { stroke: { ...layer.stroke, enabled } })}
        />
        {layer.stroke.enabled && (
          <>
            <SwatchRow
              value={layer.stroke.color}
              onChange={(color) => updateLayer(layer.id, { stroke: { ...layer.stroke, color } })}
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
          onChange={(enabled) => updateLayer(layer.id, { shadow: { ...layer.shadow, enabled } })}
        />
        {layer.shadow.enabled && (
          <>
            <SwatchRow
              value={layer.shadow.color}
              onChange={(color) => updateLayer(layer.id, { shadow: { ...layer.shadow, color } })}
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
            label="倾斜"
            value={layer.skewX}
            step={1}
            onStart={begin}
            onChange={(skewX) => apply({ skewX })}
          />
          <NumberField
            label="缩放 X"
            value={layer.scaleX}
            step={0.05}
            onStart={begin}
            onChange={(scaleX) => apply({ scaleX })}
          />
          <NumberField
            label="缩放 Y"
            value={layer.scaleY}
            step={0.05}
            onStart={begin}
            onChange={(scaleY) => apply({ scaleY })}
          />
        </div>
      </section>

      <section className="section">
        <button type="button" className="btn btn--danger btn--sm" onClick={() => removeLayers([layer.id])}>
          删除字符
        </button>
      </section>
    </>
  );
}
