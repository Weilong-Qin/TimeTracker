export interface CategorySnapshot {
  name: string;
  durationMs: number;
}

export interface ResourceSnapshot {
  key: string;
  title?: string;
  durationMs: number;
}

export interface ReportPayload {
  day: string;
  naturalMs: number;
  stackedMs: number;
  pendingInboxCount: number;
  categories: CategorySnapshot[];
  topResources: ResourceSnapshot[];
}

export interface AiSettings {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface PushSettings {
  webhookEnabled: boolean;
  webhookUrl: string;
  dingTalkEnabled: boolean;
  dingTalkWebhookUrl: string;
  feishuEnabled: boolean;
  feishuWebhookUrl: string;
}

export interface GenerateReportResult {
  ok: boolean;
  source: 'ai' | 'fallback' | 'disabled';
  report: string;
  message: string;
}

export interface PushTargetResult {
  target: 'webhook' | 'dingtalk' | 'feishu';
  ok: boolean;
  message: string;
}

export interface PushReportResult {
  skipped: boolean;
  pushed: number;
  failed: number;
  message: string;
  targets: PushTargetResult[];
}
