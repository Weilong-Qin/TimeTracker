import type { PushReportResult, PushSettings, PushTargetResult } from './types.js';

async function pushWebhook(url: string, day: string, report: string): Promise<PushTargetResult> {
  const response = await fetch(url, {
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

async function pushDingTalk(url: string, report: string): Promise<PushTargetResult> {
  const response = await fetch(url, {
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

async function pushFeishu(url: string, report: string): Promise<PushTargetResult> {
  const response = await fetch(url, {
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

export async function pushReport(
  settings: PushSettings,
  day: string,
  report: string,
): Promise<PushReportResult> {
  const tasks: Array<{ target: PushTargetResult['target']; run: () => Promise<PushTargetResult> }> = [];

  if (settings.webhookEnabled && settings.webhookUrl.trim()) {
    tasks.push({
      target: 'webhook',
      run: () => pushWebhook(settings.webhookUrl.trim(), day, report),
    });
  }

  if (settings.dingTalkEnabled && settings.dingTalkWebhookUrl.trim()) {
    tasks.push({
      target: 'dingtalk',
      run: () => pushDingTalk(settings.dingTalkWebhookUrl.trim(), report),
    });
  }

  if (settings.feishuEnabled && settings.feishuWebhookUrl.trim()) {
    tasks.push({
      target: 'feishu',
      run: () => pushFeishu(settings.feishuWebhookUrl.trim(), report),
    });
  }

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
    tasks.map(async ({ target, run }) => {
      try {
        return await run();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        return {
          target,
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
