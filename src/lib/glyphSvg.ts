/** 从导入的字体文件中提取真实字形轮廓，生成独立 SVG。opentype.js 按需懒加载。 */

import type { OpenTypeFont } from 'opentype.js';
import { dataUrlToArrayBuffer } from './fontLoader';

type ParseFn = (buffer: ArrayBuffer) => OpenTypeFont;

/** opentype.js 2.x 未提供 ESM 具名导出，这里兼容 default / 具名两种形态 */
let parserPromise: Promise<ParseFn | null> | null = null;

function loadParser(): Promise<ParseFn | null> {
  if (!parserPromise) {
    parserPromise = import('opentype.js')
      .then((mod) => {
        const candidate = mod as unknown as { parse?: unknown; default?: { parse?: unknown } };
        const parse = typeof candidate.parse === 'function' ? candidate.parse : candidate.default?.parse;
        return typeof parse === 'function' ? (parse as ParseFn) : null;
      })
      .catch(() => null);
  }
  return parserPromise;
}

const parsedFonts = new Map<string, OpenTypeFont | null>();

async function loadFont(fontSrc: string): Promise<OpenTypeFont | null> {
  const cached = parsedFonts.get(fontSrc);
  if (cached !== undefined) return cached;
  const parse = await loadParser();
  if (!parse) {
    parsedFonts.set(fontSrc, null);
    return null;
  }
  try {
    const font = parse(dataUrlToArrayBuffer(fontSrc));
    parsedFonts.set(fontSrc, font);
    return font;
  } catch {
    parsedFonts.set(fontSrc, null);
    return null;
  }
}

export interface GlyphSvgResult {
  svg: string;
  path: string;
  width: number;
  height: number;
}

/**
 * 返回字符的真实轮廓 SVG；字体文件无法解析或不含该字符时返回 null，
 * 由调用方明确提示用户，而不是伪造结果。
 */
export async function extractGlyphSvg(
  fontSrc: string,
  char: string,
  fontSize = 200,
): Promise<GlyphSvgResult | null> {
  const font = await loadFont(fontSrc);
  if (!font) return null;
  try {
    const glyph = font.charToGlyph(char);
    if (!glyph || !glyph.getPath) return null;
    const path = glyph.getPath(0, 0, fontSize);
    const data = path.toPathData(2);
    if (!data) return null;
    const box = path.getBoundingBox();
    const width = Math.max(1, Math.ceil(box.x2 - box.x1));
    const height = Math.max(1, Math.ceil(box.y2 - box.y1));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="${box.x1} ${box.y1} ${width} ${height}">` +
      `<path d="${data}" fill="#111111"/></svg>`;
    return { svg, path: data, width, height };
  } catch {
    return null;
  }
}

/** 该字体是否包含指定字符的真实轮廓（.notdef 会被判定为缺失） */
export async function glyphCoverage(fontSrc: string, char: string): Promise<boolean> {
  const font = await loadFont(fontSrc);
  if (!font) return false;
  try {
    const glyph = font.charToGlyph(char);
    return Boolean(glyph && glyph.getPath && glyph.getPath(0, 0, 100).commands?.length);
  } catch {
    return false;
  }
}

/** 统计一组字符中有多少个能在该字体里找到真实轮廓 */
export async function glyphCoverageCount(fontSrc: string, chars: string[]): Promise<number> {
  const font = await loadFont(fontSrc);
  if (!font) return 0;
  let count = 0;
  chars.forEach((char) => {
    try {
      const glyph = font.charToGlyph(char);
      if (glyph && glyph.getPath && glyph.getPath(0, 0, 100).commands?.length) count += 1;
    } catch {
      /* 单个字符解析失败不影响整体统计 */
    }
  });
  return count;
}
