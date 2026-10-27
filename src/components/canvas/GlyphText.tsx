/** 整体文字层的画布渲染：按排版引擎计算出的逐字坐标绘制，单个字符可直接点选。 */

import { useMemo } from 'react';
import Konva from 'konva';
import { Group, Rect, Text } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { fontStyleOf, layoutText } from '../../lib/textLayout';
import type { AiGlyph, TextLayer } from '../../types/project';
import GlyphBitmapNode from './GlyphBitmapNode';

interface GlyphTextProps {
  layer: TextLayer;
  selectedChars: number[];
}

export default function GlyphText({ layer, selectedChars }: GlyphTextProps) {
  const layout = useMemo(() => layoutText(layer), [layer]);
  const glyphs = useEditorStore((state) => state.doc.glyphs);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const selectChars = useEditorStore((state) => state.selectChars);

  const aiGlyphMap = useMemo(() => {
    const map = new Map<string, AiGlyph>();
    for (const glyph of glyphs) map.set(glyph.id, glyph);
    return map;
  }, [glyphs]);

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
      {/* 透明命中区：让字符之间的空白也能拖动整段文字 */}
      <Rect
        name="export-hide"
        width={Math.max(layout.width, 8)}
        height={Math.max(layout.height, 8)}
        fill="rgba(0,0,0,0.001)"
      />

      {layout.glyphs.map((glyph) => {
        if (glyph.char === '\n' || glyph.hidden) return null;
        const override = layer.chars.find((item) => item.index === glyph.index);
        const stroke = override?.stroke ?? layer.stroke;
        const shadow = override?.shadow ?? layer.shadow;
        const selected = selectedChars.includes(glyph.index);
        const aiGlyph =
          layer.glyphMode !== 'font' && override?.glyphId
            ? aiGlyphMap.get(override.glyphId)
            : undefined;

        return (
          <Group
            key={glyph.index}
            onClick={(event) => {
              event.cancelBubble = true;
              selectChars(layer.id, [glyph.index]);
            }}
          >
            {aiGlyph ? (
              <GlyphBitmapNode
                src={aiGlyph.src}
                color={glyph.color}
                x={glyph.x}
                y={glyph.y}
                boxWidth={glyph.width}
                size={glyph.fontSize}
                rotation={glyph.rotation}
                scaleX={glyph.scaleX}
                scaleY={glyph.scaleY}
                opacity={glyph.opacity}
              />
            ) : (
              <Text
                x={glyph.x}
                y={glyph.y}
                text={glyph.char}
                fontSize={glyph.fontSize}
                fontFamily={layer.fontFamily}
                fontStyle={fontStyleOf(layer.fontWeight, layer.italic)}
                fill={glyph.color}
                opacity={glyph.opacity}
                rotation={glyph.rotation}
                scaleX={glyph.scaleX}
                scaleY={glyph.scaleY}
                stroke={stroke.enabled ? stroke.color : undefined}
                strokeWidth={stroke.enabled ? stroke.width : 0}
                shadowEnabled={shadow.enabled}
                shadowColor={shadow.enabled ? shadow.color : undefined}
                shadowBlur={shadow.enabled ? shadow.blur : 0}
                shadowOffsetX={shadow.enabled ? shadow.offsetX : 0}
                shadowOffsetY={shadow.enabled ? shadow.offsetY : 0}
                shadowOpacity={shadow.enabled ? shadow.opacity : 0}
              />
            )}
            {selected && (
              <Rect
                name="export-hide"
                x={glyph.x}
                y={glyph.y}
                width={glyph.width}
                height={glyph.fontSize}
                stroke="#ff3b00"
                strokeWidth={1}
                strokeScaleEnabled={false}
                dash={[3, 3]}
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
