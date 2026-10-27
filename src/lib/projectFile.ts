/**
 * .typelab 项目文件：ZIP 内包含 project.json 与拆分的素材文件。
 * 导出时把 dataURL 落成文件路径，导入时再还原为 dataURL，并做结构校验与修复。
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { nanoid } from 'nanoid';
import { getFont } from './fonts';
import type {
  AiGlyph,
  AnyLayer,
  BaseLayer,
  CanvasBackground,
  CharOverride,
  CharLayer,
  FontAnalysis,
  ImageLayer,
  ImportedFont,
  ProjectDoc,
  ReferenceAsset,
  ShadowStyle,
  StrokeStyle,
  StyleProfile,
  TextLayer,
} from '../types/project';

const FORMAT = 'type-lab-project';
const VERSION = 1;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'application/font-woff': 'woff',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function safeName(id: string): string {
  return String(id).replace(/[^\w-]/g, '_') || nanoid(6);
}

function dataUrlParts(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(src);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  if (match[2]) {
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(match[3])) };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function fileExtension(mime: string, fallback: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? fallback;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function projectFileName(name: string): string {
  const base = (name || '未命名项目').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '未命名项目';
  return `${base}.typelab`;
}

/** 打包项目，返回 ZIP 字节 */
export function buildProjectArchive(doc: ProjectDoc): Uint8Array {
  const exported = JSON.parse(JSON.stringify(doc)) as ProjectDoc;
  const files: Record<string, Uint8Array> = {};

  const store = (src: string, path: string, fallbackExt: string): string => {
    const parts = dataUrlParts(src);
    if (!parts) return src;
    files[path.replace(/\.[^./]+$/, `.${fileExtension(parts.mime, fallbackExt)}`)] = parts.bytes;
    return path.replace(/\.[^./]+$/, `.${fileExtension(parts.mime, fallbackExt)}`);
  };

  if (exported.reference) {
    const base = `assets/reference/${safeName(exported.reference.id)}.png`;
    exported.reference.src = store(exported.reference.src, base, 'png');
  }

  exported.glyphs = exported.glyphs.map((glyph) => {
    if (!glyph.src) return glyph;
    return { ...glyph, src: store(glyph.src, `assets/glyphs/${safeName(glyph.id)}.png`, 'png') };
  });

  exported.layers = exported.layers.map((layer) => {
    if (layer.type === 'image' && layer.src) {
      return { ...layer, src: store(layer.src, `assets/images/${safeName(layer.id)}.png`, 'png') };
    }
    if (layer.type === 'char' && layer.glyphSrc) {
      return {
        ...layer,
        glyphSrc: store(layer.glyphSrc, `assets/glyphs/${safeName(layer.id)}.png`, 'png'),
      };
    }
    return layer;
  });

  exported.styles = exported.styles.map((style) => {
    if (!style.referenceSrc) return style;
    return {
      ...style,
      referenceSrc: store(style.referenceSrc, `assets/reference/${safeName(style.id)}.png`, 'png'),
    };
  });

  exported.fonts = exported.fonts.map((font) => {
    if (!font.src) return font;
    const fallback = font.format === 'opentype' ? 'otf' : font.format;
    return { ...font, src: store(font.src, `fonts/imported/${safeName(font.id)}.${fallback}`, fallback) };
  });

  files['project.json'] = strToU8(
    JSON.stringify({ format: FORMAT, version: VERSION, savedAt: Date.now(), doc: exported }),
  );
  return zipSync(files, { level: 6 });
}

export function downloadProjectArchive(doc: ProjectDoc): void {
  const bytes = buildProjectArchive(doc);
  downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }), projectFileName(doc.name));
}

/* ------------------------------ 导入与校验 ------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function strokeOf(value: unknown): StrokeStyle {
  const raw = isRecord(value) ? value : {};
  return {
    enabled: bool(raw.enabled, false),
    color: str(raw.color, '#000000'),
    width: Math.max(0, num(raw.width, 2)),
  };
}

function shadowOf(value: unknown): ShadowStyle {
  const raw = isRecord(value) ? value : {};
  return {
    enabled: bool(raw.enabled, false),
    color: str(raw.color, '#000000'),
    blur: Math.max(0, num(raw.blur, 12)),
    offsetX: num(raw.offsetX, 0),
    offsetY: num(raw.offsetY, 8),
    opacity: clamp(num(raw.opacity, 0.35), 0, 1),
  };
}

function backgroundOf(value: unknown): CanvasBackground {
  const raw = isRecord(value) ? value : {};
  const type = raw.type === 'transparent' ? 'transparent' : 'color';
  return { type, color: str(raw.color, '#ffffff') };
}

function repairChars(value: unknown, text: string): CharOverride[] {
  const list = Array.isArray(value) ? value.filter(isRecord) : [];
  return Array.from(text).map((char, index) => {
    const raw = list.find((item) => num(item.index, -1) === index) ?? list[index] ?? {};
    return {
      id: str(raw.id, nanoid(8)),
      char,
      index,
      offsetX: num(raw.offsetX, 0),
      offsetY: num(raw.offsetY, 0),
      rotation: num(raw.rotation, 0),
      scaleX: num(raw.scaleX, 1),
      scaleY: num(raw.scaleY, 1),
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : null,
      color: typeof raw.color === 'string' ? raw.color : null,
      opacity: typeof raw.opacity === 'number' ? raw.opacity : null,
      stroke: isRecord(raw.stroke) ? strokeOf(raw.stroke) : null,
      shadow: isRecord(raw.shadow) ? shadowOf(raw.shadow) : null,
      spacingBefore: num(raw.spacingBefore, 0),
      spacingAfter: num(raw.spacingAfter, 0),
      hidden: bool(raw.hidden, false),
      glyphId: typeof raw.glyphId === 'string' ? raw.glyphId : null,
    };
  });
}

function repairAnalysis(value: unknown): FontAnalysis {
  const raw = isRecord(value) ? value : {};
  return {
    fontCategory: str(raw.fontCategory, '未知'),
    weight: str(raw.weight, '未知'),
    strokeStructure: str(raw.strokeStructure, '未知'),
    proportion: str(raw.proportion, '未知'),
    serifAndTerminals: str(raw.serifAndTerminals, '未知'),
    decoration: str(raw.decoration, '未知'),
    spacing: str(raw.spacing, '未知'),
    overallStyle: str(raw.overallStyle, '未知'),
    creativeDirections: Array.isArray(raw.creativeDirections)
      ? raw.creativeDirections.filter((item): item is string => typeof item === 'string')
      : [],
    generationPrompt: str(raw.generationPrompt, ''),
    confidence: str(raw.confidence, '低'),
  };
}

export interface ImportResult {
  doc: ProjectDoc;
  warnings: string[];
}

/** 解析 .typelab 字节，校验并尽可能修复数据；失败时抛出带中文提示的错误 */
export function readProjectArchive(data: Uint8Array): ImportResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('无法解压该文件，请确认它是有效的 .typelab 项目文件');
  }

  const manifestBytes = files['project.json'];
  if (!manifestBytes) throw new Error('项目文件缺少 project.json，无法识别');

  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('project.json 内容已损坏，无法解析');
  }
  if (!isRecord(manifest) || manifest.format !== FORMAT) {
    throw new Error('该文件不是 TYPE LAB 项目文件');
  }
  if (!isRecord(manifest.doc)) throw new Error('项目数据缺失，无法导入');

  const warnings: string[] = [];
  const resolveAsset = (value: unknown, fallbackMime: string): string => {
    if (typeof value !== 'string' || !value) return '';
    if (value.startsWith('data:')) return value;
    const bytes = files[value];
    if (!bytes) {
      warnings.push(`缺少素材文件 ${value}`);
      return '';
    }
    const ext = value.slice(value.lastIndexOf('.') + 1).toLowerCase();
    return bytesToDataUrl(bytes, MIME_BY_EXT[ext] ?? fallbackMime);
  };

  const raw = manifest.doc;
  if (!Array.isArray(raw.layers)) throw new Error('项目数据结构不完整：图层列表缺失');

  const usedIds = new Set<string>();
  const layers: AnyLayer[] = [];
  const rawLayers = Array.isArray(raw.layers) ? raw.layers : [];

  rawLayers.forEach((item, index) => {
    if (!isRecord(item)) return;
    const type = item.type;
    if (type !== 'text' && type !== 'char' && type !== 'image') return;

    let id = str(item.id, '');
    if (!id || usedIds.has(id)) id = nanoid(10);
    usedIds.add(id);

    const base: BaseLayer = {
      id,
      type,
      name: str(item.name, type === 'text' ? '文字' : type === 'char' ? '字符' : '图片'),
      x: num(item.x, 0),
      y: num(item.y, 0),
      width: Math.max(1, num(item.width, 100)),
      height: Math.max(1, num(item.height, 100)),
      rotation: num(item.rotation, 0),
      scaleX: num(item.scaleX, 1),
      scaleY: num(item.scaleY, 1),
      opacity: clamp(num(item.opacity, 1), 0, 1),
      zIndex: index,
      visible: bool(item.visible, true),
      locked: bool(item.locked, false),
    };

    if (type === 'image') {
      const layer: ImageLayer = { ...base, type: 'image', src: resolveAsset(item.src, 'image/png') };
      if (!layer.src) warnings.push(`图片图层「${layer.name}」缺少图片数据`);
      layers.push(layer);
      return;
    }

    if (type === 'char') {
      const layer: CharLayer = {
        ...base,
        type: 'char',
        char: str(item.char, ''),
        fontId: str(item.fontId, 'pingfang'),
        fontFamily: str(item.fontFamily, getFont('pingfang').family),
        fontWeight: num(item.fontWeight, 400),
        italic: bool(item.italic, false),
        fontSize: clamp(num(item.fontSize, 64), 1, 4000),
        color: str(item.color, '#111111'),
        stroke: strokeOf(item.stroke),
        shadow: shadowOf(item.shadow),
        skewX: num(item.skewX, 0),
      };
      if (typeof item.sourceLayerId === 'string') layer.sourceLayerId = item.sourceLayerId;
      if (typeof item.sourceIndex === 'number') layer.sourceIndex = item.sourceIndex;
      if (typeof item.glyphSrc === 'string' && item.glyphSrc) {
        layer.glyphSrc = resolveAsset(item.glyphSrc, 'image/png');
      }
      layers.push(layer);
      return;
    }

    const content = str(item.text, '');
    const align = item.align === 'center' || item.align === 'right' ? item.align : 'left';
    const direction = item.direction === 'vertical' ? 'vertical' : 'horizontal';
    const glyphMode =
      item.glyphMode === 'font' || item.glyphMode === 'ai' || item.glyphMode === 'auto'
        ? item.glyphMode
        : 'auto';
    const layer: TextLayer = {
      ...base,
      type: 'text',
      text: content,
      fontId: str(item.fontId, 'pingfang'),
      fontFamily: str(item.fontFamily, getFont('pingfang').family),
      fontWeight: num(item.fontWeight, 400),
      italic: bool(item.italic, false),
      fontSize: clamp(num(item.fontSize, 64), 1, 4000),
      letterSpacing: num(item.letterSpacing, 0),
      lineHeight: clamp(num(item.lineHeight, 1.25), 0.2, 6),
      color: str(item.color, '#111111'),
      align,
      direction,
      wrap: bool(item.wrap, false),
      wrapWidth: Math.max(20, num(item.wrapWidth, 600)),
      stroke: strokeOf(item.stroke),
      shadow: shadowOf(item.shadow),
      skewX: num(item.skewX, 0),
      chars: repairChars(item.chars, content),
      glyphMode,
    };
    if (typeof item.styleId === 'string') layer.styleId = item.styleId;
    layers.push(layer);
  });

  const reference: ReferenceAsset | null = (() => {
    if (!isRecord(raw.reference)) return null;
    const src = resolveAsset(raw.reference.src, 'image/png');
    if (!src) return null;
    return {
      id: str(raw.reference.id, nanoid(10)),
      name: str(raw.reference.name, '参考图'),
      src,
      width: Math.max(1, num(raw.reference.width, 600)),
      height: Math.max(1, num(raw.reference.height, 400)),
    };
  })();

  const fonts: ImportedFont[] = (Array.isArray(raw.fonts) ? raw.fonts : [])
    .filter(isRecord)
    .map((item) => {
      const format: ImportedFont['format'] =
        item.format === 'opentype' || item.format === 'woff' || item.format === 'woff2'
          ? item.format
          : 'truetype';
      return {
        id: str(item.id, nanoid(10)),
        label: str(item.label, '导入字体'),
        family: str(item.family, `Imported_${nanoid(6)}`),
        src: resolveAsset(item.src, 'font/ttf'),
        format,
      };
    })
    .filter((font) => Boolean(font.src));

  const glyphs: AiGlyph[] = (Array.isArray(raw.glyphs) ? raw.glyphs : [])
    .filter(isRecord)
    .map((item) => ({
      id: str(item.id, nanoid(10)),
      char: str(item.char, ''),
      src: resolveAsset(item.src, 'image/png'),
      styleId: typeof item.styleId === 'string' ? item.styleId : null,
      styleName: str(item.styleName, ''),
      prompt: str(item.prompt, ''),
      createdAt: num(item.createdAt, Date.now()),
    }))
    .filter((glyph) => Boolean(glyph.src));

  const styles: StyleProfile[] = (Array.isArray(raw.styles) ? raw.styles : [])
    .filter(isRecord)
    .map((item) => ({
      id: str(item.id, nanoid(10)),
      name: str(item.name, '风格'),
      referenceId: typeof item.referenceId === 'string' ? item.referenceId : null,
      referenceName: str(item.referenceName, ''),
      referenceSrc: resolveAsset(item.referenceSrc, 'image/png'),
      createdAt: num(item.createdAt, Date.now()),
      analysis: repairAnalysis(item.analysis),
    }));

  const doc: ProjectDoc = {
    id: nanoid(10),
    name: str(raw.name, '导入的项目'),
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: Date.now(),
    canvas: {
      width: clamp(Math.round(num(isRecord(raw.canvas) ? raw.canvas.width : 1200, 1200)), 16, 12000),
      height: clamp(Math.round(num(isRecord(raw.canvas) ? raw.canvas.height : 800, 800)), 16, 12000),
      background: backgroundOf(isRecord(raw.canvas) ? raw.canvas.background : undefined),
    },
    layers,
    reference,
    fonts,
    styles,
    glyphs,
  };

  return { doc, warnings };
}

/** 从本地文件读取 .typelab */
export async function readProjectFile(file: File): Promise<ImportResult> {
  if (!file.name.toLowerCase().endsWith('.typelab')) {
    throw new Error('请选择 .typelab 项目文件');
  }
  const buffer = await file.arrayBuffer();
  return readProjectArchive(new Uint8Array(buffer));
}
