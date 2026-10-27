/** 左栏「素材」：参考图片与文字输入。 */

import { useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { FONT_OPTIONS } from '../../lib/fonts';
import { useEditorStore } from '../../store/editorStore';
import AnalyzeBlock from './props/AnalyzeBlock';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export default function AssetsPanel() {
  const reference = useEditorStore((state) => state.doc.reference);
  const importedFonts = useEditorStore((state) => state.doc.fonts);
  const setReference = useEditorStore((state) => state.setReference);
  const addTextLayer = useEditorStore((state) => state.addTextLayer);

  const [draftText, setDraftText] = useState('TYPE LAB');
  const [draftFontId, setDraftFontId] = useState('pingfang');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fontOptions = [
    ...FONT_OPTIONS.map((font) => ({
      id: font.id,
      label: font.label,
      family: font.family,
      weight: font.defaultWeight,
    })),
    ...importedFonts.map((font) => ({
      id: font.id,
      label: `${font.label}（导入）`,
      family: font.family,
      weight: 400,
    })),
  ];
  const selectedFont = fontOptions.find((font) => font.id === draftFontId) ?? fontOptions[0];

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError('仅支持 JPG、PNG、WEBP 格式');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        setError('读取图片失败');
        return;
      }
      const probe = new window.Image();
      probe.onload = () =>
        setReference({
          id: nanoid(10),
          name: file.name,
          src,
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        });
      probe.onerror = () => setError('图片解码失败，请换一张图片');
      probe.src = src;
    };
    reader.onerror = () => setError('读取图片失败');
    reader.readAsDataURL(file);
  };

  const handleAddText = () => {
    addTextLayer(draftText.trim() || 'TYPE LAB', {
      fontId: selectedFont.id,
      fontFamily: selectedFont.family,
      fontWeight: selectedFont.weight,
    });
  };

  return (
    <div className="panel__scroll">
      <section className="section">
        <div className="section__title">参考图片</div>
        <div className="reference">
          {reference ? (
            <>
              <img src={reference.src} alt={reference.name} />
              <span className="reference__name">{reference.name}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReference(null)}>
                移除
              </button>
            </>
          ) : (
            <>
              <span className="mono">JPG / PNG / WEBP</span>
              <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
                上传参考图
              </button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(',')}
          hidden
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {reference && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            更换图片
          </button>
        )}
        {error && <p className="hint">{error}</p>}
        <AnalyzeBlock />
      </section>

      <section className="section">
        <div className="section__title">文字输入</div>
        <textarea
          className="textarea"
          value={draftText}
          placeholder="输入中文、英文、数字或标点"
          onChange={(event) => setDraftText(event.target.value)}
        />
        <label className="field">
          <span className="field__label">使用字体</span>
          <select
            className="select"
            value={selectedFont.id}
            onChange={(event) => setDraftFontId(event.target.value)}
          >
            {fontOptions.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--primary" onClick={handleAddText}>
          添加到画布
        </button>
        <p className="hint">换行可直接在输入框内回车；也可在属性面板对单个字符手动分行。</p>
      </section>
    </div>
  );
}
