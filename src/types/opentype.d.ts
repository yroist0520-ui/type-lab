/** opentype.js 2.x 未随包提供类型声明，这里只声明本项目实际用到的轮廓解析 API。 */
declare module 'opentype.js' {
  export interface OpenTypePath {
    commands?: unknown[];
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }

  export interface OpenTypeGlyph {
    advanceWidth: number;
    path: OpenTypePath;
    getPath(x?: number, y?: number, fontSize?: number): OpenTypePath;
  }

  export interface OpenTypeFont {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    numGlyphs: number;
    charToGlyph(char: string): OpenTypeGlyph;
  }

  export function parse(buffer: ArrayBuffer): OpenTypeFont;

  const opentype: {
    parse: typeof parse;
  };

  export default opentype;
}
