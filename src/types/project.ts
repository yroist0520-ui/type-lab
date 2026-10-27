/**
 * TYPE LAB 统一数据结构。
 * 画布上的每个对象（整体文字 / 独立字符 / 图片）都是 Layer，拥有独立 id。
 */

export type LayerType = 'text' | 'char' | 'image';

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  width: number;
}

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  /** 文字层为布局计算后的尺寸，图片层为原始尺寸，字符层为字形尺寸 */
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
}

/** 单个字符的覆盖样式，index 对应原始文本中的码点位置 */
export interface CharOverride {
  id: string;
  char: string;
  index: number;
  /** 相对自动排版位置的偏移 */
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** null 表示继承整体文字 */
  fontSize: number | null;
  color: string | null;
  opacity: number | null;
  stroke: StrokeStyle | null;
  shadow: ShadowStyle | null;
  /** 相对前后字符的额外间距 */
  spacingBefore: number;
  spacingAfter: number;
  hidden: boolean;
  /** 绑定的 AI 字形 id（见 ProjectDoc.glyphs）；null 表示用字体渲染 */
  glyphId: string | null;
}

/** 字符渲染来源：font 用字体轮廓，ai 用生成的位图字形 */
export type GlyphMode = 'auto' | 'font' | 'ai';

export type TextAlign = 'left' | 'center' | 'right';
export type TextDirection = 'horizontal' | 'vertical';

export interface TextLayer extends BaseLayer {
  type: 'text';
  /** 原始文本，唯一数据源 */
  text: string;
  fontId: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  fontSize: number;
  letterSpacing: number;
  /** 行高倍数 */
  lineHeight: number;
  color: string;
  align: TextAlign;
  direction: TextDirection;
  wrap: boolean;
  wrapWidth: number;
  stroke: StrokeStyle;
  shadow: ShadowStyle;
  skewX: number;
  chars: CharOverride[];
  /** 生效中的字体风格档案 id，用于 AI 字形生成 */
  styleId?: string;
  /** 渲染引擎：auto 有 AI 字形则用 AI，否则字体；font 只用字体；ai 优先 AI */
  glyphMode: GlyphMode;
}

/** 由整体文字拆分出来的独立字符图层 */
export interface CharLayer extends BaseLayer {
  type: 'char';
  char: string;
  fontId: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  fontSize: number;
  color: string;
  stroke: StrokeStyle;
  shadow: ShadowStyle;
  skewX: number;
  sourceLayerId?: string;
  sourceIndex?: number;
  /** 拆分时若该字符已使用 AI 字形，这里保留字形位图，避免拆分后回退成字体 */
  glyphSrc?: string;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  assetId?: string;
}

export type AnyLayer = TextLayer | CharLayer | ImageLayer;

export interface CanvasBackground {
  type: 'color' | 'transparent';
  color: string;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background: CanvasBackground;
}

/** 用户上传的字体参考图片（第三阶段用于 AI 风格分析） */
export interface ReferenceAsset {
  id: string;
  name: string;
  /** dataURL，便于随项目一起保存 */
  src: string;
  width: number;
  height: number;
}

/** 用户导入的字体文件（模式 A：字体重建与真实字体渲染） */
export interface ImportedFont {
  id: string;
  label: string;
  /** 注册到 document.fonts 的 family 名称，同时用作 TextLayer.fontFamily */
  family: string;
  /** base64 dataURL，随项目一起保存与恢复 */
  src: string;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
}

/** AI 风格分析的结构化结果，字段与服务端 /api/ai/analyze 返回一致 */
export interface FontAnalysis {
  fontCategory: string;
  weight: string;
  strokeStructure: string;
  proportion: string;
  serifAndTerminals: string;
  decoration: string;
  spacing: string;
  overallStyle: string;
  creativeDirections: string[];
  generationPrompt: string;
  confidence: string;
}

/** 字体风格档案：始终携带生成它的参考图片快照 */
export interface StyleProfile {
  id: string;
  name: string;
  referenceId: string | null;
  referenceName: string;
  referenceSrc: string;
  createdAt: number;
  analysis: FontAnalysis;
}

/** AI 生成的字形位图，缓存于项目内，可重复使用 */
export interface AiGlyph {
  id: string;
  char: string;
  /** 透明背景 PNG 的 dataURL */
  src: string;
  styleId: string | null;
  styleName: string;
  /** 生成时实际使用的风格描述 */
  prompt: string;
  createdAt: number;
}

export interface ProjectDoc {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvas: CanvasConfig;
  /** 数组顺序即叠放顺序，靠后的在上层 */
  layers: AnyLayer[];
  reference: ReferenceAsset | null;
  fonts: ImportedFont[];
  styles: StyleProfile[];
  /** AI 字形缓存，按 char + 风格复用 */
  glyphs: AiGlyph[];
}

/** 选择状态：layerIds 支持多选；charIndices 为当前单选文字层内部被选中的字符索引 */
export interface SelectionState {
  layerIds: string[];
  charIndices: number[];
}

export function isTextLayer(layer: AnyLayer): layer is TextLayer {
  return layer.type === 'text';
}

export function isCharLayer(layer: AnyLayer): layer is CharLayer {
  return layer.type === 'char';
}

export function isImageLayer(layer: AnyLayer): layer is ImageLayer {
  return layer.type === 'image';
}
