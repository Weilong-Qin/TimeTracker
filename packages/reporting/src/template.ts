import type { ReportPayload } from './types.js';

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function buildFallbackReport(payload: ReportPayload): string {
  const categories = payload.categories
    .slice(0, 5)
    .map((item) => `- ${item.name}: ${formatDuration(item.durationMs)}`)
    .join('\n');

  const resources = payload.topResources
    .slice(0, 5)
    .map((item) => `- ${item.title ?? item.key}: ${formatDuration(item.durationMs)}`)
    .join('\n');

  return [
    `# ${payload.day} 日报（本地模板）`,
    '',
    `自然时长: ${formatDuration(payload.naturalMs)}`,
    `并行叠加时长: ${formatDuration(payload.stackedMs)}`,
    `待分类资源: ${payload.pendingInboxCount}`,
    '',
    '## 主分类分布',
    categories || '- 无数据',
    '',
    '## 重点资源',
    resources || '- 无数据',
    '',
    '## 复盘提示',
    '- 今天最重要的投入是否和预期一致？',
    '- 哪些并行活动可能导致注意力分散？',
    '- 明天要保留或优化的节奏是什么？',
  ].join('\n');
}

export function buildAiPrompt(payload: ReportPayload): string {
  return [
    '你是一个时间管理复盘助手。',
    '请根据以下结构化数据，输出一份简洁但有洞察的中文日报。',
    '要求：',
    '1) 先给结论摘要（3 条）',
    '2) 给出主分类分析（工作、娱乐、学习等）',
    '3) 点出并行叠加时间的风险与机会',
    '4) 给出明日行动建议（3 条，可执行）',
    '5) 输出格式为纯文本，不要 markdown 表格',
    '',
    `日期: ${payload.day}`,
    `自然时长(ms): ${payload.naturalMs}`,
    `并行叠加时长(ms): ${payload.stackedMs}`,
    `待分类资源数: ${payload.pendingInboxCount}`,
    `主分类JSON: ${JSON.stringify(payload.categories)}`,
    `重点资源JSON: ${JSON.stringify(payload.topResources)}`,
  ].join('\n');
}
