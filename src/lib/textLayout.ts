/** 统一的文字排版引擎：把 TextLayer 计算为逐字位置，供画布渲染与命中检测使用。 */

import type { CharOverride, TextLayer } from '../types/project';

/**
 * Konva Text 单行以行框中线定位（textBaseline = middle）。
 * 因此 glyph 的节点 y = 行视觉中线 - fontSize * 0.5，
 * 同一行内不同字号的字符会围绕同一条中线对齐。
 */
const HALF = 0.5;

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

/** 画布渲染与测量共用的字体样式，保证量出来的宽度和画出来的宽度一致 */
export function fontStyleOf(weight: number, italic: boolean): string {
  const bold = weight >= 600;
  if (italic) return bold ? 'italic bold' : 'italic';
  return bold ? 'bold' : 'normal';
}

export function fontString(family: string, size: number, weight: number, italic: boolean): string {
  return `${fontStyleOf(weight, italic)} ${size}px ${family}`;
}

export function measureText(text: string, family: string, size: number, weight: number, italic: boolean): number {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  if (!measureCtx) return text.length * size * 0.6;
  const font = fontString(family, size, weight, italic);
  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  measureCtx.font = font;
  const width = measureCtx.measureText(text).width;
  if (widthCache.size > 6000) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

export interface GlyphBox {
  char: string;
  /** 在原始文本中的码点索引 */
  index: number;
  line: number;
  /** 相对文字层原点的位置（含单字偏移） */
  x: number;
  y: number;
  /** 单字排版宽度 */
  width: number;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  hidden: boolean;
  overrideId?: string;
}

export interface TextLayoutResult {
  glyphs: GlyphBox[];
  width: number;
  height: number;
  lineCount: number;
  lineHeightPx: number;
}

interface GlyphDraft {
  char: string;
  index: number;
  override?: CharOverride;
  fontSize: number;
  color: string;
  opacity: number;
  advance: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  spacingBefore: number;
  spacingAfter: number;
}

function pickOverride(overrides: CharOverride[], index: number): CharOverride | undefined {
  return overrides.find((item) => item.index === index);
}

/** 依据换行符与自动换行把字符切成行 */
function buildLines(
  drafts: GlyphDraft[],
  letterSpacing: number,
  wrap: boolean,
  wrapWidth: number,
): GlyphDraft[][] {
  const rawLines: GlyphDraft[][] = [[]];
  for (const draft of drafts) {
    if (draft.char === '\n') {
      rawLines.push([]);
      continue;
    }
    rawLines[rawLines.length - 1].push(draft);
  }

  if (!wrap || wrapWidth <= 0) return rawLines;

  const wrapped: GlyphDraft[][] = [];
  for (const line of rawLines) {
    let current: GlyphDraft[] = [];
    let currentWidth = 0;
    for (const draft of line) {
      const extra = draft.spacingBefore + draft.advance + draft.spacingAfter + letterSpacing;
      if (current.length > 0 && currentWidth + extra > wrapWidth) {
        wrapped.push(current);
        current = [];
        currentWidth = 0;
      }
      current.push(draft);
      currentWidth += extra;
    }
    wrapped.push(current);
  }
  return wrapped;
}

/** 一行（竖排时为一列）在主线方向上的总长度 */
function extentOf(line: GlyphDraft[], letterSpacing: number, vertical: boolean): number {
  return line.reduce(
    (sum, draft) =>
      sum +
      draft.spacingBefore +
      (vertical ? draft.fontSize : draft.advance) +
      draft.spacingAfter +
      letterSpacing,
    0,
  );
}

export function layoutText(layer: TextLayer): TextLayoutResult {
  const chars = Array.from(layer.text);
  const drafts: GlyphDraft[] = chars.map((char, index) => {
    const override = pickOverride(layer.chars, index);
    const fontSize = override?.fontSize ?? layer.fontSize;
    const measured = measureText(char, layer.fontFamily, fontSize, layer.fontWeight, layer.italic);
    const scaleX = override?.scaleX ?? 1;
    return {
      char,
      index,
      override,
      fontSize,
      color: override?.color ?? layer.color,
      opacity: override?.opacity ?? 1,
      advance: measured * scaleX,
      rotation: override?.rotation ?? 0,
      scaleX,
      scaleY: override?.scaleY ?? 1,
      spacingBefore: override?.spacingBefore ?? 0,
      spacingAfter: override?.spacingAfter ?? 0,
    };
  });

  const lineHeightPx = layer.fontSize * layer.lineHeight;
  const lines = buildLines(drafts, layer.letterSpacing, layer.wrap, layer.wrapWidth);
  const isVertical = layer.direction === 'vertical';

  const extents = lines.map((line) => extentOf(line, layer.letterSpacing, isVertical));
  const maxExtent = extents.reduce((max, value) => Math.max(max, value), 0);
  const boxExtent = layer.wrap && layer.wrapWidth > 0 ? layer.wrapWidth : maxExtent;

  const glyphs: GlyphBox[] = [];

  lines.forEach((line, lineIndex) => {
    const offset = alignOffset(layer, extents[lineIndex], boxExtent);

    if (isVertical) {
      const columnX = lineIndex * lineHeightPx;
      let cursor = offset;
      for (const draft of line) {
        const offsetX = draft.override?.offsetX ?? 0;
        const offsetY = draft.override?.offsetY ?? 0;
        cursor += draft.spacingBefore;
        glyphs.push({
          char: draft.char,
          index: draft.index,
          line: lineIndex,
          x: columnX + (lineHeightPx - draft.fontSize) / 2 + offsetX,
          y: cursor + offsetY,
          width: draft.fontSize,
          fontSize: draft.fontSize,
          color: draft.color,
          opacity: draft.opacity,
          rotation: draft.rotation,
          scaleX: draft.scaleX,
          scaleY: draft.scaleY,
          offsetX,
          offsetY,
          hidden: draft.override?.hidden ?? false,
          overrideId: draft.override?.id,
        });
        cursor += draft.fontSize + draft.spacingAfter + layer.letterSpacing;
      }
      return;
    }

    // Konva Text 单行以行框中线为基线：节点 y = 行中线 - fontSize / 2
    const lineCenter = lineIndex * lineHeightPx + lineHeightPx / 2;
    let cursor = offset;

    for (const draft of line) {
      const offsetX = draft.override?.offsetX ?? 0;
      const offsetY = draft.override?.offsetY ?? 0;
      cursor += draft.spacingBefore;
      glyphs.push({
        char: draft.char,
        index: draft.index,
        line: lineIndex,
        x: cursor + offsetX,
        y: lineCenter - draft.fontSize * HALF + offsetY,
        width: draft.advance,
        fontSize: draft.fontSize,
        color: draft.color,
        opacity: draft.opacity,
        rotation: draft.rotation,
        scaleX: draft.scaleX,
        scaleY: draft.scaleY,
        offsetX,
        offsetY,
        hidden: draft.override?.hidden ?? false,
        overrideId: draft.override?.id,
      });
      cursor += draft.advance + draft.spacingAfter + layer.letterSpacing;
    }
  });

  const totalLines = Math.max(lines.length, 1);
  const crossExtent = totalLines * lineHeightPx;
  const mainExtent = Math.max(maxExtent, layer.fontSize * 0.5);

  return {
    glyphs,
    width: isVertical ? crossExtent : mainExtent,
    height: isVertical ? mainExtent : crossExtent,
    lineCount: totalLines,
    lineHeightPx,
  };
}

function alignOffset(layer: TextLayer, lineWidth: number, boxWidth: number): number {
  if (layer.align === 'center') return Math.max((boxWidth - lineWidth) / 2, 0);
  if (layer.align === 'right') return Math.max(boxWidth - lineWidth, 0);
  return 0;
}
