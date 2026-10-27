/** AI 接口适配层：所有请求走服务端代理，API Key 永远不会出现在前端。 */

import type { FontAnalysis } from '../types/project';

export interface AiStatus {
  configured: boolean;
  visionModel: string | null;
  imageModel: string | null;
  baseUrlConfigured: boolean;
}

export class AiRequestError extends Error {
  code: string;

  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AiRequestError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: (T & ErrorPayload) | null = null;
  try {
    payload = (await response.json()) as T & ErrorPayload;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const code = payload?.error || 'REQUEST_FAILED';
    const message = payload?.message || `请求失败（HTTP ${response.status}）`;
    throw new AiRequestError(code, message, response.status);
  }
  if (!payload) throw new AiRequestError('BAD_RESPONSE', '服务端返回了无法解析的内容。', response.status);
  return payload;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const response = await fetch('/api/ai/status', { headers: { Accept: 'application/json' } });
  return parseResponse<AiStatus>(response);
}

/** 参考图风格分析；未配置 AI 时会抛出 AI_NOT_CONFIGURED，调用方必须如实提示 */
export async function requestAnalysis(image: string): Promise<FontAnalysis> {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const payload = await parseResponse<{ profile: Partial<FontAnalysis> }>(response);
  return normalizeAnalysis(payload.profile);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeAnalysis(profile: Partial<FontAnalysis> | undefined): FontAnalysis {
  const directions = Array.isArray(profile?.creativeDirections)
    ? profile.creativeDirections.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    fontCategory: asText(profile?.fontCategory),
    weight: asText(profile?.weight),
    strokeStructure: asText(profile?.strokeStructure),
    proportion: asText(profile?.proportion),
    serifAndTerminals: asText(profile?.serifAndTerminals),
    decoration: asText(profile?.decoration),
    spacing: asText(profile?.spacing),
    overallStyle: asText(profile?.overallStyle),
    creativeDirections: directions,
    generationPrompt: asText(profile?.generationPrompt),
    confidence: asText(profile?.confidence),
  };
}

export interface GlyphGenerationResult {
  char: string;
  image: string;
  promptUsed: string;
}

/** 单字 AI 生成（第四阶段使用） */
export async function requestGlyph(
  char: string,
  stylePrompt: string,
  reference?: string,
): Promise<GlyphGenerationResult> {
  const response = await fetch('/api/ai/glyph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ char, stylePrompt, reference: reference ?? '' }),
  });
  const payload = await parseResponse<GlyphGenerationResult>(response);
  if (payload.char !== char) {
    throw new AiRequestError('CHAR_MISMATCH', 'AI 返回的字符与请求不一致，已拒绝使用该结果。', 502);
  }
  return payload;
}
