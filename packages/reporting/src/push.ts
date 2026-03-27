import type { PushReportResult, PushSettings, PushTargetResult } from './types.js';
import { runWithRetry, type RetryExecutionOptions } from './retry.js';

type FetchLike = typeof fetch;

export interface PushExecutionOptions {
  fetch?: FetchLike;
  retry?: RetryExecutionOptions;
}

async function pushWebhook(
  url: string,
  day: string,
  report: string,
  fetchImpl: FetchLike,
): Promise<PushTargetResult> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      day,
      report,
      sentAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      target: 'webhook',
      ok: false,
      message: `HTTP ${response.status}: ${detail.slice(0, 160)}`,
    };
  }

  return {
    target: 'webhook',
    ok: true,
    message: 'ok',
  };
}

async function pushDingTalk(url: string, report: string, fetchImpl: FetchLike): Promise<PushTargetResult> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgtype: 'text',
      text: {
        content: report,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      target: 'dingtalk',
      ok: false,
      message: `HTTP ${response.status}: ${detail.slice(0, 160)}`,
    };
  }

  return {
    target: 'dingtalk',
    ok: true,
    message: 'ok',
  };
}

async function pushFeishu(url: string, report: string, fetchImpl: FetchLike): Promise<PushTargetResult> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: {
        text: report,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      target: 'feishu',
      ok: false,
      message: `HTTP ${response.status}: ${detail.slice(0, 160)}`,
    };
  }

  return {
    target: 'feishu',
    ok: true,
    message: 'ok',
  };
}

interface PushTask {
  target: PushTargetResult['target'];
  run: () => Promise<PushTargetResult>;
}

function buildPushTasks(
  settings: PushSettings,
  day: string,
  report: string,
  fetchImpl: FetchLike,
): PushTask[] {
  const tasks: PushTask[] = [];

  if (settings.webhookEnabled && settings.webhookUrl.trim()) {
    tasks.push({
      target: 'webhook',
      run: () => pushWebhook(settings.webhookUrl.trim(), day, report, fetchImpl),
    });
  }

  if (settings.dingTalkEnabled && settings.dingTalkWebhookUrl.trim()) {
    tasks.push({
      target: 'dingtalk',
      run: () => pushDingTalk(settings.dingTalkWebhookUrl.trim(), report, fetchImpl),
    });
  }

  if (settings.feishuEnabled && settings.feishuWebhookUrl.trim()) {
    tasks.push({
      target: 'feishu',
      run: () => pushFeishu(settings.feishuWebhookUrl.trim(), report, fetchImpl),
    });
  }

  return tasks;
}

async function executePushTasks(
  tasks: PushTask[],
  runTask: (task: PushTask) => Promise<PushTargetResult>,
): Promise<PushReportResult> {
  if (tasks.length === 0) {
    return {
      skipped: true,
      pushed: 0,
      failed: 0,
      message: 'no push targets configured',
      targets: [],
    };
  }

  const settled = await Promise.all(
    tasks.map(async (task) => {
      try {
        return await runTask(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        return {
          target: task.target,
          ok: false,
          message,
        };
      }
    }),
  );

  const pushed = settled.filter((result) => result.ok).length;
  const failed = settled.length - pushed;

  return {
    skipped: false,
    pushed,
    failed,
    message: `push completed: ${pushed} success, ${failed} failed`,
    targets: settled,
  };
}

export async function pushReport(
  settings: PushSettings,
  day: string,
  report: string,
  options?: PushExecutionOptions,
): Promise<PushReportResult> {
  const fetchImpl = options?.fetch ?? fetch;
  const tasks = buildPushTasks(settings, day, report, fetchImpl);

  return executePushTasks(tasks, (task) => task.run());
}

export async function pushReportWithRetry(
  settings: PushSettings,
  day: string,
  report: string,
  options?: PushExecutionOptions,
): Promise<PushReportResult> {
  const fetchImpl = options?.fetch ?? fetch;
  const tasks = buildPushTasks(settings, day, report, fetchImpl);

  return executePushTasks(
    tasks,
    (task) =>
      runWithRetry(
        async () => {
          const result = await task.run();
          if (!result.ok) {
            throw new Error(result.message);
          }
          return result;
        },
        options?.retry,
      ),
  );
}
