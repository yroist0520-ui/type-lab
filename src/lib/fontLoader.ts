/** 导入字体文件的解析、注册与释放（真实注册到 document.fonts）。 */

import { nanoid } from 'nanoid';
import type { ImportedFont } from '../types/project';

const faces = new Map<string, FontFace>();

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export function detectFontFormat(fileName: string): ImportedFont['format'] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.woff2')) return 'woff2';
  if (lower.endsWith('.woff')) return 'woff';
  if (lower.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

export function isSupportedFontFile(fileName: string): boolean {
  return /\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/.test(fileName);
}

/** 用文件名派生出唯一 family，避免与系统字体同名冲突 */
export function makeFontFamily(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_');
  return `${base || 'Imported'}_${nanoid(6)}`;
}

export async function registerFont(font: ImportedFont): Promise<void> {
  if (faces.has(font.id)) return;
  const buffer = dataUrlToArrayBuffer(font.src);
  const face = new FontFace(font.family, buffer);
  await face.load();
  document.fonts.add(face);
  faces.set(font.id, face);
}

/** 项目载入后恢复全部导入字体 */
export async function ensureFonts(fonts: ImportedFont[]): Promise<void> {
  await Promise.all(fonts.map((font) => registerFont(font).catch(() => undefined)));
}

export function unregisterFont(id: string): void {
  const face = faces.get(id);
  if (!face) return;
  document.fonts.delete(face);
  faces.delete(id);
}

/** 字体是否已在本页面可用（用于字体匹配提示） */
export function isFontUsable(family: string, sample: string): boolean {
  try {
    return document.fonts.check(`16px "${family}"`, sample || 'Aa');
  } catch {
    return false;
  }
}
