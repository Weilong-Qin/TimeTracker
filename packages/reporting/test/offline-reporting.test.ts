import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAiReport, pushReport, pushReportWithRetry } from '../src/index.js';
import type { ReportPayload } from '../src/types.js';

function samplePayload(): ReportPayload {
  return {
    day: '2026-03-27',
    naturalMs: 2 * 60 * 60 * 1000,
    stackedMs: 3 * 60 * 60 * 1000,
    pendingInboxCount: 1,
    categories: [
      { name: 'work', durationMs: 2 * 60 * 60 * 1000 },
      { name: 'learning', durationMs: 60 * 60 * 1000 },
    ],
    topResources: [
      { key: '/workspace/timetracker', title: 'timetracker', durationMs: 90 * 60 * 1000 },
    ],
  };
}

test('offline reporting gate: disabled AI returns local fallback report', async () => {
  const result = await generateAiReport(
    {
      enabled: false,
      endpoint: 'https://api.openai.com/v1/responses',
      apiKey: '',
      model: 'gpt-4.1-mini',
      timeoutMs: 15_000,
    },
    samplePayload(),
  );

  assert.equal(result.ok, true);
  assert.equal(result.source, 'disabled');
  assert.match(result.report, /日报（本地模板）/);
  assert.match(result.report, /自然时长/);
  assert.match(result.report, /并行叠加时长/);
});

test('offline reporting gate: missing AI key falls back without throwing', async () => {
  const result = await generateAiReport(
    {
      enabled: true,
      endpoint: 'https://api.openai.com/v1/responses',
      apiKey: '',
      model: 'gpt-4.1-mini',
      timeoutMs: 15_000,
    },
    samplePayload(),
  );

  assert.equal(result.ok, false);
  assert.equal(result.source, 'fallback');
  assert.match(result.message, /AI key missing/);
  assert.match(result.report, /主分类分布/);
});

test('offline reporting gate: push is skipped when no targets configured', async () => {
  const result = await pushReport(
    {
      webhookEnabled: false,
      webhookUrl: '',
      dingTalkEnabled: false,
      dingTalkWebhookUrl: '',
      feishuEnabled: false,
      feishuWebhookUrl: '',
    },
    '2026-03-27',
    'offline report content',
  );

  assert.equal(result.skipped, true);
  assert.equal(result.pushed, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.targets.length, 0);
  assert.equal(result.message, 'no push targets configured');
});

test('pushReportWithRetry retries transient target failures and succeeds', async () => {
  let callCount = 0;
  const delays: number[] = [];
  const flakyFetch: typeof fetch = async () => {
    callCount += 1;
    if (callCount < 3) {
      return new Response('temporary error', { status: 503 });
    }
    return new Response('ok', { status: 200 });
  };

  const result = await pushReportWithRetry(
    {
      webhookEnabled: true,
      webhookUrl: 'https://push.example/webhook',
      dingTalkEnabled: false,
      dingTalkWebhookUrl: '',
      feishuEnabled: false,
      feishuWebhookUrl: '',
    },
    '2026-03-27',
    'retry report content',
    {
      fetch: flakyFetch,
      retry: {
        policy: {
          maxRetries: 3,
          baseDelayMs: 20,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    },
  );

  assert.equal(result.skipped, false);
  assert.equal(result.pushed, 1);
  assert.equal(result.failed, 0);
  assert.equal(callCount, 3);
  assert.deepEqual(delays, [20, 40]);
});

test('pushReportWithRetry returns failed target after retry exhaustion', async () => {
  let callCount = 0;
  const delays: number[] = [];
  const alwaysFailFetch: typeof fetch = async () => {
    callCount += 1;
    return new Response('still failing', { status: 500 });
  };

  const result = await pushReportWithRetry(
    {
      webhookEnabled: true,
      webhookUrl: 'https://push.example/webhook',
      dingTalkEnabled: false,
      dingTalkWebhookUrl: '',
      feishuEnabled: false,
      feishuWebhookUrl: '',
    },
    '2026-03-27',
    'retry failure report content',
    {
      fetch: alwaysFailFetch,
      retry: {
        policy: {
          maxRetries: 1,
          baseDelayMs: 15,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    },
  );

  assert.equal(result.skipped, false);
  assert.equal(result.pushed, 0);
  assert.equal(result.failed, 1);
  assert.equal(callCount, 2);
  assert.match(result.targets[0]?.message ?? '', /HTTP 500/);
  assert.deepEqual(delays, [15]);
});
