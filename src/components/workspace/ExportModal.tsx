/** PNG 导出弹层：倍率/自定义宽度、透明背景、导出前预览。 */

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import {
  downloadDataUrl,
  outputSize,
  pngFileName,
  renderDocumentPng,
} from '../../lib/exportImage';
import { ChipGroup } from '../panels/props/fields';

type ScaleValue = '1' | '2' | '3' | 'custom';
type BackgroundValue = 'canvas' | 'transparent';

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const doc = useEditorStore((state) => state.doc);
  const [scale, setScale] = useState<ScaleValue>('2');
  const [customWidth, setCustomWidth] = useState(() => String(Math.round(doc.canvas.width * 2)));
  const [background, setBackground] = useState<BackgroundValue>(
    doc.canvas.background.type === 'transparent' ? 'transparent' : 'canvas',
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transparent = background === 'transparent';

  const ratio = useMemo(() => {
    if (scale !== 'custom') return Number(scale);
    const width = Number(customWidth);
    if (!Number.isFinite(width) || width < 16) return 1;
    return Math.min(Math.max(width / Math.max(doc.canvas.width, 1), 0.1), 6);
  }, [scale, customWidth, doc.canvas.width]);

  const size = outputSize(doc, ratio);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const previewRatio = Math.max(0.05, Math.min(ratio, 1000 / Math.max(doc.canvas.width, 1)));
        const url = renderDocumentPng(doc, { pixelRatio: previewRatio, transparent });
        if (!cancelled) {
          setPreview(url);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setError(err instanceof Error ? err.message : '预览失败');
        }
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, ratio, transparent]);

  const handleDownload = () => {
    try {
      const url = renderDocumentPng(doc, { pixelRatio: ratio, transparent });
      downloadDataUrl(url, pngFileName(doc, size.width, size.height));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="导出 PNG"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <span>导出 PNG</span>
          <button type="button" className="btn btn--icon" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="field">
            <span className="field__label">输出倍率</span>
            <ChipGroup<ScaleValue>
              value={scale}
              onChange={setScale}
              options={[
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
                { value: 'custom', label: '自定义宽度' },
              ]}
            />
          </div>

          {scale === 'custom' && (
            <label className="field">
              <span className="field__label">宽度（像素）</span>
              <input
                className="input"
                type="number"
                min={16}
                max={12000}
                step={100}
                value={customWidth}
                onChange={(event) => setCustomWidth(event.target.value)}
              />
            </label>
          )}

          <div className="field">
            <span className="field__label">背景</span>
            <ChipGroup<BackgroundValue>
              value={background}
              onChange={setBackground}
              options={[
                { value: 'canvas', label: '画布背景' },
                { value: 'transparent', label: '透明背景' },
              ]}
            />
          </div>

          <div className="export-preview">
            {preview ? (
              <img src={preview} alt="导出预览" />
            ) : (
              <span className="mono">预览生成中…</span>
            )}
          </div>

          <p className="hint">
            输出尺寸 {size.width} × {size.height} px{transparent ? ' · 透明背景' : ''}
            。预览为低分辨率，下载为所选倍率的高清图。
          </p>
          {error && <p className="hint hint--danger">{error}</p>}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={handleDownload} disabled={!preview}>
            下载 PNG
          </button>
        </div>
      </div>
    </div>
  );
}
