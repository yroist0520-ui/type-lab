/** 图片图层属性面板。 */

import { useEditorStore } from '../../../store/editorStore';
import type { ImageLayer } from '../../../types/project';
import { NumberField, RangeField } from './fields';

export default function ImageProps({ layer }: { layer: ImageLayer }) {
  const updateImageLayer = useEditorStore((state) => state.updateImageLayer);
  const removeLayers = useEditorStore((state) => state.removeLayers);

  const begin = () => useEditorStore.getState().pushHistory();
  const apply = (patch: Partial<ImageLayer>) => updateImageLayer(layer.id, patch, false);

  const ratio = layer.height > 0 ? layer.width / layer.height : 1;

  return (
    <>
      <div className="props-head">
        <span className="props-head__kind">图片</span>
        <div className="props-head__title">{layer.name}</div>
      </div>

      <section className="section">
        <div className="section__title">尺寸</div>
        <div className="grid-2">
          <NumberField
            label="宽度"
            value={layer.width}
            min={1}
            step={1}
            onStart={begin}
            onChange={(width) =>
              apply({ width: Math.max(1, width), height: Math.max(1, Math.round(width / (ratio || 1))) })
            }
          />
          <NumberField
            label="高度"
            value={layer.height}
            min={1}
            step={1}
            onStart={begin}
            onChange={(height) =>
              apply({ height: Math.max(1, height), width: Math.max(1, Math.round(height * ratio)) })
            }
          />
        </div>
        <p className="hint">宽高按原始像素比例联动。</p>
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
        <button type="button" className="btn btn--danger btn--sm" onClick={() => removeLayers([layer.id])}>
          删除图片
        </button>
      </section>
    </>
  );
}
