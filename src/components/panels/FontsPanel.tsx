/** 左栏「字体」：字体文件导入、字体库匹配与风格档案库。 */

import { useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { FONT_OPTIONS } from '../../lib/fonts';
import { glyphCoverageCount } from '../../lib/glyphSvg';
import {
  detectFontFormat,
  isSupportedFontFile,
  makeFontFamily,
  registerFont,
  unregisterFont,
} from '../../lib/fontLoader';
import { useActiveLayer, useEditorStore } from '../../store/editorStore';
import type { ImportedFont } from '../../types/project';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

interface MatchRow {
  id: string;
  label: string;
  detail: string;
}

export default function FontsPanel() {
  const importedFonts = useEditorStore((state) => state.doc.fonts);
  const styles = useEditorStore((state) => state.doc.styles);
  const addFont = useEditorStore((state) => state.addFont);
  const removeFont = useEditorStore((state) => state.removeFont);
  const updateTextLayer = useEditorStore((state) => state.updateTextLayer);
  const renameStyle = useEditorStore((state) => state.renameStyle);
  const removeStyle = useEditorStore((state) => state.removeStyle);
  const applyStyle = useEditorStore((state) => state.applyStyle);
  const activeLayer = useActiveLayer();

  const activeText = activeLayer && activeLayer.type === 'text' ? activeLayer : null;

  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [report, setReport] = useState<MatchRow[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [styleName, setStyleName] = useState('');
  const [expandedStyleId, setExpandedStyleId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fonts = useMemo(
    () => [
      ...FONT_OPTIONS.map((font) => ({
        id: font.id,
        label: font.label,
        family: font.family,
        weight: font.defaultWeight,
        src: null as string | null,
      })),
      ...importedFonts.map((font) => ({
        id: font.id,
        label: font.label,
        family: font.family,
        weight: 400,
        src: font.src,
      })),
    ],
    [importedFonts],
  );

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedFontFile(file.name)) {
      setImportError('仅支持 TTF、OTF、WOFF、WOFF2 字体文件');
      return;
    }
    setBusy(true);
    setImportError(null);
    try {
      const src = await readAsDataUrl(file);
      const font: ImportedFont = {
        id: nanoid(10),
        label: file.name.replace(/\.[^.]+$/, ''),
        family: makeFontFamily(file.name),
        src,
        format: detectFontFormat(file.name),
      };
      await registerFont(font);
      addFont(font);
      if (activeText) {
        updateTextLayer(activeText.id, {
          fontId: font.id,
          fontFamily: font.family,
          fontWeight: 400,
        });
      }
    } catch (error) {
      setImportError(error instanceof Error ? `字体加载失败：${error.message}` : '字体加载失败');
    } finally {
      setBusy(false);
    }
  };

  const applyFont = (fontId: string, family: string, weight: number) => {
    if (!activeText) return;
    updateTextLayer(activeText.id, { fontId, fontFamily: family, fontWeight: weight });
  };

  const handleMatch = async () => {
    const sample = activeText?.text || 'Type 字体 Aa 123';
    const chars = Array.from(sample).filter((char) => char !== '\n' && char !== ' ');
    setMatching(true);
    try {
      const rows = await Promise.all(
        fonts.map(async (font) => {
          if (font.src) {
            const covered = await glyphCoverageCount(font.src, chars);
            return {
              id: font.id,
              label: font.label,
              detail: `${covered} / ${chars.length} 字符有轮廓`,
            };
          }
          return {
            id: font.id,
            label: font.label,
            detail: '内置字体，依赖系统字体渲染，未做逐字校验',
          };
        }),
      );
      setReport(rows);
    } finally {
      setMatching(false);
    }
  };

  const commitStyleName = () => {
    if (editingStyleId && styleName.trim()) renameStyle(editingStyleId, styleName.trim());
    setEditingStyleId(null);
  };

  return (
    <div className="panel__scroll">
      <section className="section">
        <div className="section__title">导入字体</div>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? '正在注册字体…' : '选择字体文件'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          hidden
          onChange={(event) => {
            handleImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {importError && <p className="hint">{importError}</p>}
        <p className="hint">
          导入的字体文件会真实注册到浏览器并随项目保存。字体只包含文件内已有的字符，缺失字符不会被补齐。
        </p>
        {importedFonts.length > 0 && (
          <div>
            {importedFonts.map((font) => (
              <div key={font.id} className="row">
                <span className="grow mono">{font.label}</span>
                <span className="mono">{font.format}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    unregisterFont(font.id);
                    removeFont(font.id);
                  }}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__title">字体库</div>
        {!activeText && <p className="hint">先选中一个文字层，再点击字体即可应用。</p>}
        {fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            className={`font-item ${activeText?.fontId === font.id ? 'is-active' : ''}`}
            onClick={() => applyFont(font.id, font.family, font.weight)}
          >
            <span
              className="font-item__sample"
              style={{ fontFamily: font.family, fontWeight: font.weight }}
            >
              {font.label} Aa 字
            </span>
            <span className="font-item__meta">{font.src ? '导入字体' : '内置字体'}</span>
          </button>
        ))}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={matching}
          onClick={handleMatch}
        >
          {matching ? '检查中…' : '检查字体匹配'}
        </button>
        {report && (
          <div>
            {report.map((row) => (
              <div key={row.id} className="row">
                <span className="grow">{row.label}</span>
                <span className="mono">{row.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__title">风格档案库</div>
        {styles.length === 0 && <p className="hint">还没有风格档案。去「素材」上传参考图并开始分析。</p>}
        {styles.map((style) => (
          <div key={style.id} className="field">
            {editingStyleId === style.id ? (
              <input
                className="input"
                value={styleName}
                autoFocus
                onChange={(event) => setStyleName(event.target.value)}
                onBlur={commitStyleName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitStyleName();
                  if (event.key === 'Escape') setEditingStyleId(null);
                }}
              />
            ) : (
              <div
                className="row"
                onDoubleClick={() => {
                  setEditingStyleId(style.id);
                  setStyleName(style.name);
                }}
              >
                <span className="grow">{style.name}</span>
                <span className="mono">{style.referenceName}</span>
              </div>
            )}
            <p className="hint">
              {style.analysis.fontCategory || '未标注类型'} · {style.analysis.weight || '未标注粗细'}
            </p>
            {expandedStyleId === style.id && (
              <img src={style.referenceSrc} alt={style.referenceName} style={{ maxWidth: '100%' }} />
            )}
            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!activeText}
                onClick={() => activeText && applyStyle(activeText.id, style.id)}
              >
                {activeText?.styleId === style.id ? '已应用' : '应用到选中文字'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setExpandedStyleId(expandedStyleId === style.id ? null : style.id)}
              >
                {expandedStyleId === style.id ? '收起参考图' : '查看参考图'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => removeStyle(style.id)}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
