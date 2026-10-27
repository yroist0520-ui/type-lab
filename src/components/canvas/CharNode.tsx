/** 独立字符图层的画布渲染。 */

import Konva from 'konva';
import { Group, Text } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { fontStyleOf } from '../../lib/textLayout';
import type { CharLayer } from '../../types/project';
import GlyphBitmapNode from './GlyphBitmapNode';

export default function CharNode({ layer }: { layer: CharLayer }) {
  const selectLayer = useEditorStore((state) => state.selectLayer);

  const handleDragStart = () => {
    useEditorStore.getState().pushHistory();
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    useEditorStore.getState().updateLayer(layer.id, { x: node.x(), y: node.y() }, false);
  };

  const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    selectLayer(layer.id, event.evt.shiftKey || event.evt.metaKey);
    event.cancelBubble = true;
  };

  if (layer.glyphSrc) {
    return (
      <Group
        id={layer.id}
        x={layer.x}
        y={layer.y}
        rotation={layer.rotation}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        skewX={layer.skewX}
        opacity={layer.opacity}
        visible={layer.visible}
        draggable={!layer.locked}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
      >
        <GlyphBitmapNode
          src={layer.glyphSrc}
          color={layer.color}
          x={0}
          y={0}
          boxWidth={Math.max(layer.width, layer.fontSize * 0.6)}
          size={layer.fontSize}
        />
      </Group>
    );
  }

  return (
    <Text
      id={layer.id}
      x={layer.x}
      y={layer.y}
      text={layer.char}
      fontSize={layer.fontSize}
      fontFamily={layer.fontFamily}
      fontStyle={fontStyleOf(layer.fontWeight, layer.italic)}
      fill={layer.color}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      skewX={layer.skewX}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      stroke={layer.stroke.enabled ? layer.stroke.color : undefined}
      strokeWidth={layer.stroke.enabled ? layer.stroke.width : 0}
      shadowEnabled={layer.shadow.enabled}
      shadowColor={layer.shadow.enabled ? layer.shadow.color : undefined}
      shadowBlur={layer.shadow.enabled ? layer.shadow.blur : 0}
      shadowOffsetX={layer.shadow.enabled ? layer.shadow.offsetX : 0}
      shadowOffsetY={layer.shadow.enabled ? layer.shadow.offsetY : 0}
      shadowOpacity={layer.shadow.enabled ? layer.shadow.opacity : 0}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    />
  );
}
