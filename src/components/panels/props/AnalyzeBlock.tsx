/** 参考图的 AI 风格分析：未配置服务时明确提示，不伪造结果。 */

import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { AiRequestError, fetchAiStatus, requestAnalysis, type AiStatus } from '../../../lib/aiClient';
import { useEditorStore } from '../../../store/editorStore';
import type { FontAnalysis } from '../../../types/project';

const FIELDS: Array<{ key: keyof FontAnalysis; label: string }> = [
  { key: 'fontCategory', label: '字体类型' },
  { key: 'weight', label: '字体粗细' },
  { key: 'strokeStructure', label: '笔画结构' },
  { key: 'proportion', label: '宽高比例' },
  { key: 'serifAndTerminals', label: '衬线与端点' },
  { key: 'decoration', label: '装饰特征' },
  { key: 'spacing', label: '排列与间距' },
  { key: 'overallStyle', label: '整体风格' },
];

export default function AnalyzeBlock() {
  const reference = useEditorStore((state) => state.doc.reference);
  const addStyle = useEditorStore((state) => state.addStyle);

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FontAnalysis | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAiStatus()
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => {
        if (!cancelled) setStatusError('无法连接 AI 接口，请确认开发服务器已启动。');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setSaved(false);
  }, [reference?.id]);

  const configured = status?.configured === true;

  const handleAnalyze = async () => {
    if (!reference) return;
    setRunning(true);
    setError(null);
    setSaved(false);
    try {
      setAnalysis(await requestAnalysis(reference.src));
    } catch (caught) {
      setError(caught instanceof AiRequestError ? caught.message : '分析失败，请重试。');
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    if (!reference || !analysis) return;
    addStyle({
      id: nanoid(10),
      name: `${reference.name.replace(/\.[^.]+$/, '') || '参考图'} 风格`,
      referenceId: reference.id,
      referenceName: reference.name,
      referenceSrc: reference.src,
      createdAt: Date.now(),
      analysis,
    });
    setSaved(true);
  };

  return (
    <>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!reference || !configured || running}
        onClick={handleAnalyze}
      >
        {running ? '分析中…' : '开始分析'}
      </button>

      {statusError && <p className="hint">{statusError}</p>}
      {status && !configured && (
        <p className="hint">
          未检测到 AI 服务配置。请在服务端环境变量中设置 AI_API_KEY、AI_VISION_MODEL 后重启，键值不会进入前端。
        </p>
      )}
      {error && <p className="hint">{error}</p>}

      {analysis && (
        <>
          <div className="section__title">风格档案预览</div>
          {FIELDS.filter((field) => String(analysis[field.key] ?? '').trim().length > 0).map((field) => (
            <div key={field.key} className="field">
              <span className="field__label">{field.label}</span>
              <p className="hint">{String(analysis[field.key])}</p>
            </div>
          ))}
          {analysis.creativeDirections.length > 0 && (
            <div className="field">
              <span className="field__label">适用创作方向</span>
              {analysis.creativeDirections.map((direction) => (
                <p key={direction} className="hint">
                  · {direction}
                </p>
              ))}
            </div>
          )}
          {analysis.confidence && <p className="hint">AI 置信度：{analysis.confidence}</p>}
          <button type="button" className="btn btn--ghost" onClick={handleSave} disabled={saved}>
            {saved ? '已保存到风格库' : '保存为风格档案'}
          </button>
        </>
      )}
    </>
  );
}
