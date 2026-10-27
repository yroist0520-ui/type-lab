/**
 * AI 字形位图的加载与着色。
 * 生成结果是黑色墨迹 + 透明背景的 PNG，这里按字符当前颜色重新着色，
 * 使 AI 字形与字体渲染的字符共享同一套颜色 / 透明度设置。
 */

export type GlyphBitmap = HTMLImageElement | HTMLCanvasElement;

const cache = new Map<string, GlyphBitmap>();
const pending = new Map<string, Promise<GlyphBitmap | null>>();

function tint(image: HTMLImageElement, color: string): GlyphBitmap {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return image;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/** 加载并着色字形位图；失败返回 null，调用方需明确提示而不是伪造结果。 */
export function loadGlyphBitmap(src: string, color: string): Promise<GlyphBitmap | null> {
  const key = `${color}|${src}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(key);
  if (running) return running;

  const task = new Promise<GlyphBitmap | null>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const bitmap = tint(image, color);
      cache.set(key, bitmap);
      pending.delete(key);
      resolve(bitmap);
    };
    image.onerror = () => {
      pending.delete(key);
      resolve(null);
    };
    image.src = src;
  });
  pending.set(key, task);
  return task;
}
