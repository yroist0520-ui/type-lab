/** AI 字形位图在画布上的渲染节点：等比缩放居中放进字符的排版盒子里。 */

import { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import { loadGlyphBitmap, type GlyphBitmap } from '../../lib/glyphImage';

interface GlyphBitmapNodeProps {
  src: string;
  color: string;
  /** 盒子左上角（与字体渲染的字符坐标一致） */
  x: number;
  y: number;
  /** 该字符的排版宽度 */
  boxWidth: number;
  /** 字号，决定字高 */
  size: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
}

export default function GlyphBitmapNode({
  src,
  color,
  x,
  y,
  boxWidth,
  size,
  rotation = 0,
  scaleX = 1,
  scaleY = 1,
  opacity = 1,
}: GlyphBitmapNodeProps) {
  const [bitmap, setBitmap] = useState<GlyphBitmap | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBitmap(null);
    loadGlyphBitmap(src, color).then((result) => {
      if (!cancelled) setBitmap(result);
    });
    return () => {
      cancelled = true;
    };
  }, [src, color]);

  if (!bitmap) return null;

  const naturalWidth = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
  const naturalHeight = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
  if (!naturalWidth || !naturalHeight) return null;

  const fit = Math.min(size / naturalWidth, size / naturalHeight);
  const width = naturalWidth * fit;
  const height = naturalHeight * fit;
  const box = Math.max(boxWidth, size * 0.6);

  return (
    <KonvaImage
      image={bitmap as unknown as HTMLImageElement}
      x={x + (box - width) / 2}
      y={y + (size - height) / 2}
      width={width}
      height={height}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      opacity={opacity}
    />
  );
}
