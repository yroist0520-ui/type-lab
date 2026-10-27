/** 图片图层的画布渲染，异步加载 dataURL。 */

import { useEffect, useState } from 'react';
import Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import type { ImageLayer } from '../../types/project';

export default function ImageNode({ layer }: { layer: ImageLayer }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const selectLayer = useEditorStore((state) => state.selectLayer);

  useEffect(() => {
    if (!layer.src) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      if (!cancelled) setImage(element);
    };
    element.onerror = () => {
      if (!cancelled) setImage(null);
    };
    element.src = layer.src;
    return () => {
      cancelled = true;
    };
  }, [layer.src]);

  const handleDragStart = () => {
    useEditorStore.getState().pushHistory();
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    useEditorStore.getState().updateLayer(layer.id, { x: node.x(), y: node.y() }, false);
  };

  const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    selectLayer(layer.id, event.evt.shiftKey || event.evt.metaKey);
  };

  return (
    <KonvaImage
      id={layer.id}
      image={image ?? undefined}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    />
  );
}
