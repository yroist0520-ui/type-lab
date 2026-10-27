/** 高清 PNG 导出：复用当前 Konva Stage，导出时临时隐藏控制框与辅助元素。 */

import type Konva from 'konva';
import type { ProjectDoc } from '../types/project';

let activeStage: Konva.Stage | null = null;

/** CanvasStage 挂载时注册，卸载时清空 */
export function registerStage(stage: Konva.Stage | null): void {
  activeStage = stage;
}

export interface PngOptions {
  pixelRatio: number;
  /** true 时隐藏画布背景，导出透明 PNG */
  transparent: boolean;
}

const MAX_SIDE = 12000;

export function outputSize(doc: ProjectDoc, pixelRatio: number): { width: number; height: number } {
  return {
    width: Math.round(doc.canvas.width * pixelRatio),
    height: Math.round(doc.canvas.height * pixelRatio),
  };
}

/** 渲染当前画布为 PNG dataURL；同步执行，渲染后立即恢复画布状态 */
export function renderDocumentPng(doc: ProjectDoc, options: PngOptions): string {
  const stage = activeStage;
  if (!stage) throw new Error('画布尚未准备好，请稍后再试');

  const ratio = Math.min(Math.max(options.pixelRatio, 0.1), 6);
  const width = doc.canvas.width;
  const height = doc.canvas.height;
  if (width * ratio > MAX_SIDE || height * ratio > MAX_SIDE) {
    throw new Error(`导出尺寸过大，单边不能超过 ${MAX_SIDE} 像素`);
  }

  const previous = {
    width: stage.width(),
    height: stage.height(),
    x: stage.x(),
    y: stage.y(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
  };

  const hiddenGuides: Konva.Node[] = [];
  const background = stage.findOne('.export-bg');

  try {
    stage.find('.export-hide').forEach((node) => {
      if (!node.visible()) return;
      node.visible(false);
      hiddenGuides.push(node);
    });
    if (options.transparent) background?.visible(false);

    stage.size({ width, height });
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    stage.draw();

    return stage.toDataURL({
      x: 0,
      y: 0,
      width,
      height,
      pixelRatio: ratio,
      mimeType: 'image/png',
    });
  } finally {
    hiddenGuides.forEach((node) => node.visible(true));
    background?.visible(true);
    stage.size({ width: previous.width, height: previous.height });
    stage.position({ x: previous.x, y: previous.y });
    stage.scale({ x: previous.scaleX, y: previous.scaleY });
    stage.draw();
  }
}

export function pngFileName(doc: ProjectDoc, width: number, height: number): string {
  const base = (doc.name || 'type-lab').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'type-lab';
  return `${base}-${width}x${height}.png`;
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
