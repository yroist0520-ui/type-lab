/**
 * 左栏「AI 字形」：
 * 单字生成 / 批量生成 / 字形缓存 / 渲染引擎（自动 · 字体 · AI）切换。
 * 所有请求都走服务端代理；失败或未配置时如实提示，不伪造任何生成结果。
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { nanoid } from 'nanoid';
import { AiRequestError, fetchAiStatus, requestGlyph, type AiStatus } from '../../lib/aiClient';
import { useActiveLayer, useEditorStore } from '../../store/editorStore';
import type { AiGlyph, GlyphMode } from '../../types/project';
import { ChipGroup } from './props/fields';

const CHECKER_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d6d6d6 25%, transparent 25%, transparent 75%, #d6d6d6 75%), linear-gradient(45deg, #d6d6d6 25%, #ffffff 25%, #ffffff 75%, #d6d6d6 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
  padding: 8,
  border: '1px solid #d6d6d6',
};

const MODE_OPTIONS: Array<{ value: GlyphMode; label: string }> = [
  { value: 'auto', label: '自动混合' },
  { value: 'font', label: '仅字体' },
  { value: 'ai', label: '仅 AI 字形' },
];

function errorText(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return '生成失败，请重试。';
}

interface Draft {
  charIndex: number;
  char: string;
  image: string;
  promptUsed: string;
}

export default function GlyphPanel() {
  const activeLayer = useActiveLayer();
  const glyphs = useEditorStore((state) => state.doc.glyphs);
  const styles = useEditorStore((state) => state.doc.styles);
  const addGlyph = useEditorStore((state) => state.addGlyph);
  const updateGlyph = useEditorStore((state) => state.updateGlyph);
  const removeGlyph = useEditorStore((state) => state.removeGlyph);
  const setGlyphMode = useEditorStore((state) => state.setGlyphMode);
  const assignGlyph = useEditorStore((state) => state.assignGlyph);
  const assignGlyphs = useEditorStore((state) => state.assignGlyphs);
  const selectChars = useEditorStore((state) => state.selectChars);
  const selectedChars = useEditorStore((state) => state.selection.charIndices);

  const text = activeLayer && activeLayer.type === 'text' ? activeLayer : null;
  const style = text?.styleId ? styles.find((item) => item.id === text.styleId) : undefined;

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [charIndex, setCharIndex] = useState<number | null>(null);
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyChar, setBusyChar] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ total: number; done: number; char: string } | null>(null);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAiStatus()
      .then((result) => {
        setStatus(result);
        setStatusError(null);
      })
      .catch((error) => setStatusError(errorText(error)));
  }, []);

  const ready = status?.configured === true && Boolean(status.imageModel);

  // 风格描述默认取风格档案里的 generationPrompt；用户改动后以草稿为准
  const prompt = promptDraft ?? style?.analysis.generationPrompt ?? '';
  const styleId = text?.styleId ?? null;
  const styleName = style?.name ?? '自定义风格';

  const charOptions = useMemo(() => {
    if (!text) return [];
    return Array.from(text.text)
      .map((char, index) => ({ char, index }))
      .filter((item) => item.char !== '\n' && item.char !== ' ');
  }, [text]);

  const activeIndex =
    charIndex !== null && charOptions.some((item) => item.index === charIndex)
      ? charIndex
      : (selectedChars[0] ?? charOptions[0]?.index ?? null);

  const activeChar =
    activeIndex === null ? '' : (Array.from(text?.text ?? '')[activeIndex] ?? '');

  /** 当前文字层里还没有 AI 字形的字符（去重，按首次出现顺序） */
  const pendingChars = useMemo(() => {
    if (!text) return [] as Array<{ char: string; indices: number[] }>;
    const map = new Map<string, number[]>();
    for (const item of charOptions) {
      const override = text.chars.find((entry) => entry.index === item.index);
      if (override?.glyphId) continue;
      const list = map.get(item.char) ?? [];
      list.push(item.index);
      map.set(item.char, list);
    }
    return Array.from(map, ([char, indices]) => ({ char, indices }));
  }, [text, charOptions]);

  /** AI 模式下仍由字体兜底的字符，需要明确告诉用户 */
  const fontFallbackChars = useMemo(() => {
    if (!text || text.glyphMode === 'font') return [] as string[];
    const missing = charOptions
      .filter((item) => {
        const override = text.chars.find((entry) => entry.index === item.index);
        return !override?.glyphId;
      })
      .map((item) => item.char);
    return Array.from(new Set(missing));
  }, [text, charOptions]);

  const findCachedGlyph = (char: string): AiGlyph | undefined =>
    glyphs.find((item) => item.char === char && (item.styleId ?? null) === styleId);

  const buildPrompt = (char: string): string => {
    const description = prompt.trim();
    if (description) return description;
    return `Consistent original typeface; single letterform for "${char}"`;
  };

  const generateOne = async (char: string) => {
    const result = await requestGlyph(char, buildPrompt(char));
    return result;
  };

  const handleGenerate = async () => {
    if (!text || !activeChar || activeIndex === null) return;
    setBusyChar(activeIndex);
    setMessage(null);
    try {
      const result = await generateOne(activeChar);
      setDraft({
        charIndex: activeIndex,
        char: result.char,
        image: result.image,
        promptUsed: result.promptUsed,
      });
    } catch (error) {
      setDraft(null);
      setMessage(errorText(error));
    } finally {
      setBusyChar(null);
    }
  };

  const handleApplyDraft = () => {
    if (!text || !draft) return;
    const glyph: AiGlyph = {
      id: nanoid(10),
      char: draft.char,
      src: draft.image,
      styleId,
      styleName,
      prompt: prompt || draft.promptUsed,
      createdAt: Date.now(),
    };
    addGlyph(glyph);
    assignGlyph(text.id, draft.charIndex, glyph.id);
    setDraft(null);
    setMessage(`已将「${draft.char}」的 AI 字形应用到画布。`);
  };

  const handleBatch = async () => {
    if (!text || pendingChars.length === 0) return;
    setBatchErrors([]);
    setMessage(null);
    const entries: Array<{ charIndex: number; glyphId: string }> = [];
    const failures: string[] = [];
    for (let i = 0; i < pendingChars.length; i += 1) {
      const item = pendingChars[i];
      setBatch({ total: pendingChars.length, done: i, char: item.char });
      try {
        const result = await generateOne(item.char);
        const glyph: AiGlyph = {
          id: nanoid(10),
          char: result.char,
          src: result.image,
          styleId,
          styleName,
          prompt: prompt || result.promptUsed,
          createdAt: Date.now(),
        };
        addGlyph(glyph);
        item.indices.forEach((index) => entries.push({ charIndex: index, glyphId: glyph.id }));
      } catch (error) {
        failures.push(`「${item.char}」：${errorText(error)}`);
      }
    }
    setBatch({ total: pendingChars.length, done: pendingChars.length, char: '' });
    if (entries.length > 0) {
      assignGlyphs(
        text.id,
        entries.map((entry) => ({ charIndex: entry.charIndex, glyphId: entry.glyphId })),
      );
    }
    setBatchErrors(failures);
    setMessage(
      failures.length === 0
        ? `批量生成完成，共 ${entries.length} 个字符已应用到画布。`
        : `批量生成结束：成功 ${entries.length} 个字符，失败 ${failures.length} 个。`,
    );
    setBatch(null);
  };

  const handleRegenerate = async (glyph: AiGlyph) => {
    setRegeneratingId(glyph.id);
    setMessage(null);
    try {
      const result = await requestGlyph(glyph.char, glyph.prompt || buildPrompt(glyph.char));
      updateGlyph(glyph.id, { src: result.image, createdAt: Date.now() });
      setMessage(`已重新生成「${glyph.char}」，画布上使用该字形的位置已同步更新。`);
    } catch (error) {
      setMessage(`「${glyph.char}」重新生成失败：${errorText(error)}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="panel__scroll">
      <section className="section">
        <div className="section__title">AI 字形生成</div>
        {statusError && <p className="hint">{statusError}</p>}
        {status && !ready && (
          <p className="hint">
            AI 图像接口未配置：请在服务端环境变量中设置 AI_API_KEY 与 AI_IMAGE_MODEL 后重启服务。
            密钥只存在于服务端，不会写入前端。
          </p>
        )}
        {status && ready && (
          <p className="hint">
            图像模型：{status.imageModel}
            {status.visionModel ? ` · 分析模型：${status.visionModel}` : ''}
          </p>
        )}
        {!text && <p className="hint">先选中一个文字层，再生成字形。</p>}
      </section>

      {text && (
        <>
          <section className="section">
            <div className="section__title">渲染引擎</div>
            <ChipGroup
              options={MODE_OPTIONS}
              value={text.glyphMode}
              onChange={(mode) => setGlyphMode(text.id, mode)}
            />
            <p className="hint">
              自动混合：有 AI 字形的字符用 AI，其余用字体渲染；仅字体：全部用当前字体；仅 AI
              字形：优先使用 AI 字形。
            </p>
            {fontFallbackChars.length > 0 && (
              <p className="hint">
                以下字符没有 AI 字形，仍由字体渲染：{fontFallbackChars.join(' ')}
              </p>
            )}
            <p className="hint">风格来源：{style ? style.name : '未绑定风格档案（可用自定义描述）'}</p>
          </section>

          <section className="section">
            <div className="section__title">单字生成</div>
            <div className="char-strip">
              {charOptions.map((item) => (
                <button
                  key={`${item.index}-${item.char}`}
                  type="button"
                  className={`char-chip ${item.index === activeIndex ? 'is-active' : ''}`}
                  title={`第 ${item.index + 1} 个字符`}
                  onClick={() => {
                    setCharIndex(item.index);
                    selectChars(text.id, [item.index]);
                    setDraft(null);
                  }}
                >
                  {item.char}
                </button>
              ))}
            </div>
            <div className="field">
              <div className="row">
                <span className="field__label">风格描述</span>
                <span className="grow" />
                {style && promptDraft !== null && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setPromptDraft(null)}
                  >
                    用档案默认
                  </button>
                )}
              </div>
              <textarea
                className="textarea"
                value={prompt}
                placeholder="描述目标字形风格，例如：粗衬线、高对比、圆润转角"
                onChange={(event) => setPromptDraft(event.target.value)}
              />
            </div>
            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!ready || busyChar !== null || !activeChar}
                onClick={handleGenerate}
              >
                {busyChar !== null
                  ? `正在生成「${activeChar}」…`
                  : `生成「${activeChar || '字符'}」`}
              </button>
              {findCachedGlyph(activeChar) && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!ready || !findCachedGlyph(activeChar)}
                  onClick={() => {
                    const cached = findCachedGlyph(activeChar);
                    if (cached && activeIndex !== null) assignGlyph(text.id, activeIndex, cached.id);
                  }}
                >
                  使用已有字形
                </button>
              )}
            </div>

            {draft && (
              <div>
                <div style={CHECKER_STYLE}>
                  <img src={draft.image} alt={`AI 字形 ${draft.char}`} style={{ width: '100%', display: 'block' }} />
                </div>
                <div className="row row--wrap">
                  <button type="button" className="btn btn--sm" onClick={handleApplyDraft}>
                    应用到「{draft.char}」
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={!ready}
                    onClick={handleGenerate}
                  >
                    重新生成
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setDraft(null)}
                  >
                    丢弃
                  </button>
                </div>
                <p className="hint">预览确认后再入画布；生成结果会同时存入字形库，可重复使用。</p>
              </div>
            )}
          </section>

          <section className="section">
            <div className="section__title">批量生成</div>
            <p className="hint">
              缺失字形的字符：{pendingChars.length === 0 ? '无' : pendingChars.map((item) => item.char).join(' ')}
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!ready || batch !== null || pendingChars.length === 0}
              onClick={handleBatch}
            >
              {batch ? `生成中 ${batch.done}/${batch.total}${batch.char ? ` · ${batch.char}` : ''}` : '逐字生成缺失字形'}
            </button>
            {batchErrors.length > 0 && (
              <div>
                {batchErrors.map((item) => (
                  <p key={item} className="hint">
                    {item}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {message && <p className="hint">{message}</p>}

      <section className="section">
        <div className="section__title">字形库</div>
        {glyphs.length === 0 && <p className="hint">还没有生成过 AI 字形。</p>}
        {glyphs.map((glyph) => (
          <div key={glyph.id} className="field">
            <div className="row">
              <span style={{ ...CHECKER_STYLE, width: 36, height: 36, padding: 2, display: 'inline-flex' }}>
                <img src={glyph.src} alt={glyph.char} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </span>
              <span className="grow">{glyph.char}</span>
              <span className="mono">{glyph.styleName}</span>
            </div>
            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!text || activeIndex === null}
                onClick={() => text && activeIndex !== null && assignGlyph(text.id, activeIndex, glyph.id)}
              >
                应用到当前字符
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!ready || regeneratingId === glyph.id}
                onClick={() => handleRegenerate(glyph)}
              >
                {regeneratingId === glyph.id ? '重新生成中…' : '重新生成'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => removeGlyph(glyph.id)}
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
