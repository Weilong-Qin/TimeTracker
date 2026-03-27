import { buildAiPrompt, buildFallbackReport } from './template.js';
import type { AiSettings, GenerateReportResult, ReportPayload } from './types.js';

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint.trim()) {
    return 'https://api.openai.com/v1/responses';
  }
  return endpoint;
}

function extractReportText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;

  if (typeof objectPayload.output_text === 'string' && objectPayload.output_text.trim()) {
    return objectPayload.output_text;
  }

  const output = objectPayload.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];

    for (const item of output) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const chunk of content) {
        if (typeof chunk !== 'object' || chunk === null) {
          continue;
        }

        const chunkObject = chunk as Record<string, unknown>;
        const text = chunkObject.text;
        if (typeof text === 'string' && text.trim()) {
          parts.push(text);
        }
      }
    }

    if (parts.length > 0) {
      return parts.join('\n').trim();
    }
  }

  return null;
}

export async function generateAiReport(
  settings: AiSettings,
  payload: ReportPayload,
): Promise<GenerateReportResult> {
  const fallback = buildFallbackReport(payload);

  if (!settings.enabled) {
    return {
      ok: true,
      source: 'disabled',
      report: fallback,
      message: 'AI disabled, fallback report generated',
    };
  }

  if (!settings.apiKey.trim()) {
    return {
      ok: false,
      source: 'fallback',
      report: fallback,
      message: 'AI key missing, fallback report generated',
    };
  }

  const controller = new AbortController();
  const timeoutMs = settings.timeoutMs > 0 ? settings.timeoutMs : 15_000;
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const endpoint = normalizeEndpoint(settings.endpoint);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4.1-mini',
        input: buildAiPrompt(payload),
        max_output_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        source: 'fallback',
        report: fallback,
        message: `AI request failed (${response.status}): ${detail.slice(0, 160)}`,
      };
    }

    const json = (await response.json()) as unknown;
    const reportText = extractReportText(json);

    if (!reportText) {
      return {
        ok: false,
        source: 'fallback',
        report: fallback,
        message: 'AI response missing text, fallback report generated',
      };
    }

    return {
      ok: true,
      source: 'ai',
      report: reportText,
      message: 'AI report generated',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';

    return {
      ok: false,
      source: 'fallback',
      report: fallback,
      message: `AI unavailable (${message}), fallback report generated`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
