/**
 * Server-side AI adapter.
 *
 * The API key lives ONLY in the Node environment (AI_API_KEY). It is never bundled
 * into the browser build and never returned by any endpoint.
 *
 * Supported providers: any OpenAI-compatible HTTP API.
 *   AI_BASE_URL       e.g. https://api.openai.com/v1
 *   AI_API_KEY        secret
 *   AI_VISION_MODEL   e.g. gpt-4o-mini        (font style analysis)
 *   AI_IMAGE_MODEL    e.g. gpt-image-1        (glyph image generation)
 */

const MAX_BODY_BYTES = 12 * 1024 * 1024;

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function callOpenAI(cfg, path, payload) {
  const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message =
        (data && (data.error?.message || data.message)) ||
        `Upstream error ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (!data) throw new Error('Upstream returned a non-JSON response.');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract a JSON object from a model answer that may include prose or code fences. */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You are a senior type designer and typography analyst.
You inspect a reference image containing lettering and produce a precise, evidence-based
type style profile. Only describe what is visible in the image. Never invent details.
Always answer with a single JSON object and no extra text.`;

const ANALYSIS_USER_PROMPT = `Analyze the typeface shown in this reference image.

Return JSON with exactly these keys:
{
  "fontCategory": "e.g. geometric sans / humanist sans / transitional serif / script / display",
  "weight": "stroke weight, e.g. light / regular / medium / bold / black, plus any weight contrast notes",
  "strokeStructure": "how strokes are built: contrast, terminals, junctions, counters",
  "proportion": "character width-to-height ratio, x-height, ascender/descender behaviour",
  "serifAndTerminals": "serif presence and shape; corner and terminal treatments",
  "decoration": "any decorative details, flourishes, ink traps, custom features",
  "spacing": "rhythm, tracking, sidebearings, line spacing if visible",
  "overallStyle": "the overall visual personality in one or two sentences",
  "creativeDirections": ["3-5 short directions for creating new words in this style"],
  "generationPrompt": "a compact English prompt (max 60 words) that would let an image model draw a NEW character in exactly this style: letterform construction, weight, terminals, contrast, texture",
  "confidence": "high | medium | low"
}
If a field cannot be judged from the image, use an empty string instead of guessing.`;

export async function handleAiRequest(req, res, cfg) {
  let route = '';
  try {
    const url = new URL(req.url, 'http://localhost');
    route = url.pathname.replace(/^\/api\/ai\//, '');
  } catch {
    return sendJson(res, 400, { error: 'BAD_REQUEST', message: 'Invalid URL.' });
  }

  if (route === 'status') {
    return sendJson(res, 200, {
      configured: Boolean(cfg.apiKey),
      visionModel: cfg.visionModel || null,
      imageModel: cfg.imageModel || null,
      baseUrlConfigured: Boolean(cfg.baseUrl),
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  }

  if (!cfg.apiKey) {
    return sendJson(res, 501, {
      error: 'AI_NOT_CONFIGURED',
      message:
        'AI 服务未配置。请在服务端环境变量中设置 AI_API_KEY（以及 AI_BASE_URL / AI_VISION_MODEL / AI_IMAGE_MODEL），然后重启服务。',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    const tooLarge = error && error.message === 'PAYLOAD_TOO_LARGE';
    return sendJson(res, tooLarge ? 413 : 400, {
      error: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_JSON',
      message: tooLarge ? '图片过大，请压缩后再试。' : '请求体不是合法 JSON。',
    });
  }

  try {
    if (route === 'analyze') {
      if (!cfg.visionModel) {
        return sendJson(res, 501, {
          error: 'MODEL_NOT_CONFIGURED',
          message: '未配置 AI_VISION_MODEL，无法进行字体风格分析。',
        });
      }
      const image = typeof body.image === 'string' ? body.image : '';
      if (!image.startsWith('data:image/')) {
        return sendJson(res, 400, {
          error: 'BAD_IMAGE',
          message: '缺少参考图片（需要 data:image/... 形式）。',
        });
      }
      const data = await callOpenAI(cfg, '/chat/completions', {
        model: cfg.visionModel,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: ANALYSIS_USER_PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      });
      const answer = data?.choices?.[0]?.message?.content ?? '';
      const parsed = extractJson(
        Array.isArray(answer)
          ? answer.map((part) => part?.text || '').join('')
          : answer,
      );
      if (!parsed) {
        return sendJson(res, 502, {
          error: 'BAD_MODEL_OUTPUT',
          message: 'AI 返回内容无法解析为结构化风格档案，请重试。',
          raw: typeof answer === 'string' ? answer.slice(0, 2000) : undefined,
        });
      }
      return sendJson(res, 200, { profile: parsed, raw: answer });
    }

    if (route === 'glyph') {
      if (!cfg.imageModel) {
        return sendJson(res, 501, {
          error: 'MODEL_NOT_CONFIGURED',
          message: '未配置 AI_IMAGE_MODEL，无法进行字形生成。',
        });
      }
      const char = typeof body.char === 'string' ? body.char : '';
      if (!char || [...char].length !== 1) {
        return sendJson(res, 400, {
          error: 'BAD_CHAR',
          message: '字形生成一次只接受单个字符。',
        });
      }
      const stylePrompt =
        typeof body.stylePrompt === 'string' ? body.stylePrompt.slice(0, 800) : '';
      const reference = typeof body.reference === 'string' ? body.reference : '';

      const prompt = [
        `A single glyph of the character "${char}", rendered as pure black ink on a fully transparent background.`,
        'Centered, generous margins, no frame, no border, no paper texture, no drop shadow, no extra characters or text.',
        stylePrompt ? `Type style: ${stylePrompt}.` : '',
        'High contrast monochrome silhouette suitable for tracing as a vector letterform.',
      ]
        .filter(Boolean)
        .join(' ');

      const attempt = async (extra) => {
        const payload = {
          model: cfg.imageModel,
          prompt,
          n: 1,
          size: body.size === '1024x1536' ? '1024x1536' : '1024x1024',
          response_format: 'b64_json',
          ...extra,
        };
        if (reference.startsWith('data:image/')) {
          // Image edit style providers accept the reference inside `image`.
          payload.image = reference;
        }
        return callOpenAI(cfg, '/images/generations', payload);
      };

      let data;
      try {
        data = await attempt({ background: 'transparent' });
      } catch (error) {
        // Provider may not support the transparent background parameter.
        if (/background|transparent|unknown|unsupported|invalid/i.test(error.message)) {
          data = await attempt({});
        } else {
          throw error;
        }
      }

      const item = data?.data?.[0];
      const b64 = item?.b64_json;
      const remoteUrl = item?.url;
      if (!b64 && !remoteUrl) {
        return sendJson(res, 502, {
          error: 'EMPTY_RESULT',
          message: 'AI 未返回图像数据。',
        });
      }
      return sendJson(res, 200, {
        char,
        mimeType: 'image/png',
        image: b64 ? `data:image/png;base64,${b64}` : remoteUrl,
        promptUsed: prompt,
      });
    }

    return sendJson(res, 404, {
      error: 'NOT_FOUND',
      message: `未知的 AI 接口：${route}`,
    });
  } catch (error) {
    const status = error?.status && error.status >= 400 ? error.status : 502;
    const aborted = error?.name === 'AbortError';
    return sendJson(res, aborted ? 504 : status, {
      error: aborted ? 'TIMEOUT' : 'UPSTREAM_ERROR',
      message: aborted ? 'AI 请求超时，请重试。' : error?.message || 'AI 请求失败。',
    });
  }
}
