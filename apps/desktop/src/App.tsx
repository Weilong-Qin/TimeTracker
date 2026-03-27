import type { ActivityEvent, Annotation, PendingInboxItem } from '@timetracker/core';
import { useEffect, useMemo, useState } from 'react';
import { formatClock, formatDuration } from './lib/format.js';
import { useActivityModel } from './hooks/use-activity-model.js';

interface QuickCategoryPreset {
  value: string;
  label: string;
  tags: string[];
}

const QUICK_CATEGORY_PRESETS: QuickCategoryPreset[] = [
  { value: 'work', label: '工作', tags: ['focus'] },
  { value: 'learning', label: '学习', tags: ['reading'] },
  { value: 'entertainment', label: '娱乐', tags: ['break'] },
  { value: 'admin', label: '杂务', tags: ['ops'] },
];

const QUICK_TAG_PRESETS = ['coding', 'meeting', 'review', 'docs', 'research'] as const;

function parseTagsRaw(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toTagsRaw(tags: string[]): string {
  return tags.join(', ');
}

function mergeUniqueTags(base: string[], incoming: string[]): string[] {
  const merged = new Set(base);
  for (const tag of incoming) {
    if (tag.trim()) {
      merged.add(tag.trim());
    }
  }
  return [...merged];
}

function inferInboxSuggestion(item: PendingInboxItem): QuickCategoryPreset {
  const key = item.resourceKey.toLowerCase();
  const title = (item.resourceTitle ?? '').toLowerCase();
  const subject = `${key} ${title}`;

  if (key.startsWith('/workspace/') || subject.includes('github') || subject.includes('jira') || subject.includes('project')) {
    return { value: 'work', label: '建议: 工作', tags: ['project'] };
  }

  if (subject.includes('youtube') || subject.includes('bilibili') || subject.includes('music') || subject.includes('video')) {
    return { value: 'entertainment', label: '建议: 娱乐', tags: ['media'] };
  }

  if (key.startsWith('doc://') || subject.includes('docs') || subject.includes('article') || subject.includes('read')) {
    return { value: 'learning', label: '建议: 学习', tags: ['reading'] };
  }

  return { value: 'work', label: '建议: 工作', tags: ['focus'] };
}

interface EventRowProps {
  event: ActivityEvent;
  annotation?: Annotation;
  onSave: (eventId: string, primaryCategory: string, tagsRaw: string) => void;
}

function EventRow({ event, annotation, onSave }: EventRowProps) {
  const [primaryCategory, setPrimaryCategory] = useState(annotation?.primaryCategory ?? '');
  const [tagsRaw, setTagsRaw] = useState(annotation?.tags.join(', ') ?? '');
  const appliedTags = useMemo(() => parseTagsRaw(tagsRaw), [tagsRaw]);

  const applyPreset = (preset: QuickCategoryPreset): void => {
    const nextTags = mergeUniqueTags(appliedTags, preset.tags);
    const nextTagsRaw = toTagsRaw(nextTags);
    setPrimaryCategory(preset.value);
    setTagsRaw(nextTagsRaw);
    onSave(event.eventId, preset.value, nextTagsRaw);
  };

  const appendQuickTag = (tag: string): void => {
    const nextTags = mergeUniqueTags(appliedTags, [tag]);
    setTagsRaw(toTagsRaw(nextTags));
  };

  return (
    <article className="event-row">
      <div className="event-meta">
        <div className="event-headline">{event.resourceTitle ?? event.resourceKey}</div>
        <div className="event-subline">
          <span>{event.resourceKind}</span>
          <span>{formatClock(event.startedAt)} - {formatClock(event.endedAt)}</span>
          <span>{formatDuration(event.endedAt - event.startedAt)}</span>
        </div>
      </div>

      <form
        className="event-tagbox"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          onSave(event.eventId, primaryCategory, tagsRaw);
        }}
      >
        <div className="quick-actions">
          <span className="quick-title">一键分类</span>
          {QUICK_CATEGORY_PRESETS.map((preset) => (
            <button key={preset.value} type="button" className="chip" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="quick-actions">
          <span className="quick-title">快捷标签</span>
          {QUICK_TAG_PRESETS.map((tag) => (
            <button key={tag} type="button" className="chip subtle" onClick={() => appendQuickTag(tag)}>
              +{tag}
            </button>
          ))}
        </div>
        <label>
          主分类
          <input
            value={primaryCategory}
            onChange={(inputEvent) => setPrimaryCategory(inputEvent.target.value)}
            placeholder="work / entertainment / learning"
          />
        </label>
        <label>
          标签
          <input
            value={tagsRaw}
            onChange={(inputEvent) => setTagsRaw(inputEvent.target.value)}
            placeholder="project, coding, docs"
          />
        </label>
        <button type="submit">
          保存标注
        </button>
      </form>
    </article>
  );
}

interface InboxRowProps {
  item: PendingInboxItem;
  onApply: (item: PendingInboxItem, primaryCategory: string, tagsRaw: string) => void;
}

function InboxRow({ item, onApply }: InboxRowProps) {
  const suggestion = useMemo(() => inferInboxSuggestion(item), [item]);
  const [primaryCategory, setPrimaryCategory] = useState(suggestion.value);
  const [tagsRaw, setTagsRaw] = useState(() => toTagsRaw(suggestion.tags));
  const parsedTags = useMemo(() => parseTagsRaw(tagsRaw), [tagsRaw]);

  useEffect(() => {
    setPrimaryCategory(suggestion.value);
    setTagsRaw(toTagsRaw(suggestion.tags));
  }, [suggestion]);

  const quickApply = (preset: QuickCategoryPreset): void => {
    const mergedTags = toTagsRaw(mergeUniqueTags(parsedTags, preset.tags));
    setPrimaryCategory(preset.value);
    setTagsRaw(mergedTags);
    onApply(item, preset.value, mergedTags);
  };

  return (
    <article className="inbox-row">
      <div>
        <div className="event-headline">{item.resourceTitle ?? item.resourceKey}</div>
        <div className="event-subline">
          <span>未分类条目: {item.eventIds.length}</span>
          <span>叠加时长: {formatDuration(item.stackedMs)}</span>
          <span>最近活动: {formatClock(item.lastSeenAt)}</span>
        </div>
      </div>

      <form
        className="event-tagbox compact"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          onApply(item, primaryCategory, tagsRaw);
        }}
      >
        <div className="quick-actions compact">
          <button type="button" className="chip primary" onClick={() => quickApply(suggestion)}>
            {suggestion.label}
          </button>
          {QUICK_CATEGORY_PRESETS.map((preset) => (
            <button key={preset.value} type="button" className="chip" onClick={() => quickApply(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <label>
          分类
          <input value={primaryCategory} onChange={(inputEvent) => setPrimaryCategory(inputEvent.target.value)} />
        </label>
        <label>
          标签
          <input value={tagsRaw} onChange={(inputEvent) => setTagsRaw(inputEvent.target.value)} />
        </label>
        <button type="submit">
          批量应用
        </button>
      </form>
    </article>
  );
}

export function App() {
  const {
    day,
    setDay,
    deviceId,
    events,
    annotations,
    pendingInbox,
    categorySnapshots,
    stackedMs,
    naturalMs,
    captureRunning,
    startCapture,
    stopCapture,
    addManual,
    annotateEvent,
    applyInboxRule,
    syncSettings,
    updateSyncSettings,
    runSyncNow,
    syncStatus,
    reportSettings,
    updateReportSettings,
    pushSettings,
    updatePushSettings,
    reportText,
    setReportText,
    generateReportNow,
    pushReportNow,
    reportStatus,
  } = useActivityModel();

  const [manualTitle, setManualTitle] = useState('离线活动');
  const [manualMinutes, setManualMinutes] = useState(20);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="kicker">TimeTracker Desktop</p>
          <h1>Parallel Activity Observatory</h1>
          <p className="lead">
            资源级时间追踪，支持并行叠加统计、批量待办箱标注，以及单端优先体验。
          </p>
        </div>

        <div className="hero-controls">
          <label>
            日期
            <input type="date" value={day} onChange={(inputEvent) => setDay(inputEvent.target.value)} />
          </label>
          <label>
            Device ID
            <input value={deviceId} readOnly />
          </label>
          <div className="control-buttons">
            {captureRunning ? (
              <button type="button" className="danger" onClick={stopCapture}>
                停止自动采集
              </button>
            ) : (
              <button type="button" onClick={startCapture}>
                开始自动采集
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="stats-grid">
        <article>
          <h2>自然时长</h2>
          <p>{formatDuration(naturalMs)}</p>
          <small>同一时段最多计 1 份时间</small>
        </article>
        <article>
          <h2>并行叠加时长</h2>
          <p>{formatDuration(stackedMs)}</p>
          <small>并行窗口叠加，允许超过 24h/日</small>
        </article>
        <article>
          <h2>待处理分类</h2>
          <p>{pendingInbox.length}</p>
          <small>批量待办箱入口</small>
        </article>
      </section>

      <section className="panel">
        <h2>R2 同步设置（可选）</h2>
        <div className="sync-grid">
          <label>
            启用同步
            <input
              type="checkbox"
              checked={syncSettings.enabled}
              onChange={(inputEvent) => updateSyncSettings({ enabled: inputEvent.target.checked })}
            />
          </label>
          <label>
            Account ID
            <input
              value={syncSettings.accountId}
              onChange={(inputEvent) => updateSyncSettings({ accountId: inputEvent.target.value.trim() })}
              placeholder="cloudflare account id"
            />
          </label>
          <label>
            Bucket
            <input
              value={syncSettings.bucket}
              onChange={(inputEvent) => updateSyncSettings({ bucket: inputEvent.target.value.trim() })}
              placeholder="timetracker-sync"
            />
          </label>
          <label>
            Access Key ID
            <input
              value={syncSettings.accessKeyId}
              onChange={(inputEvent) => updateSyncSettings({ accessKeyId: inputEvent.target.value.trim() })}
              placeholder="R2 access key id"
            />
          </label>
          <label>
            Secret Access Key
            <input
              type="password"
              value={syncSettings.secretAccessKey}
              onChange={(inputEvent) =>
                updateSyncSettings({
                  secretAccessKey: inputEvent.target.value.trim(),
                })
              }
              placeholder="R2 secret access key"
            />
          </label>
          <label>
            Region
            <input
              value={syncSettings.region}
              onChange={(inputEvent) => updateSyncSettings({ region: inputEvent.target.value.trim() || 'auto' })}
              placeholder="auto"
            />
          </label>
          <label>
            同步周期（分钟）
            <select
              value={syncSettings.syncIntervalMinutes}
              onChange={(inputEvent) =>
                updateSyncSettings({
                  syncIntervalMinutes: Number(inputEvent.target.value) as 1 | 5 | 15 | 30 | 60,
                })
              }
            >
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
          <button type="button" disabled={syncStatus.syncing} onClick={() => void runSyncNow()}>
            {syncStatus.syncing ? '同步中...' : '立即同步'}
          </button>
        </div>
        <p className="sync-status">
          状态: {syncStatus.message}
          {syncStatus.lastSyncAt ? ` · 最近同步 ${formatClock(syncStatus.lastSyncAt)}` : ''}
        </p>
      </section>

      <section className="panel">
        <h2>AI 报告与推送（可选）</h2>
        <div className="sync-grid">
          <label>
            启用 AI 报告
            <input
              type="checkbox"
              checked={reportSettings.enabled}
              onChange={(inputEvent) => updateReportSettings({ enabled: inputEvent.target.checked })}
            />
          </label>
          <label>
            API Endpoint
            <input
              value={reportSettings.endpoint}
              onChange={(inputEvent) => updateReportSettings({ endpoint: inputEvent.target.value })}
              placeholder="https://api.openai.com/v1/responses"
            />
          </label>
          <label>
            Model
            <input
              value={reportSettings.model}
              onChange={(inputEvent) => updateReportSettings({ model: inputEvent.target.value })}
              placeholder="gpt-4.1-mini"
            />
          </label>
          <label>
            API Key
            <input
              type="password"
              value={reportSettings.apiKey}
              onChange={(inputEvent) => updateReportSettings({ apiKey: inputEvent.target.value })}
              placeholder="sk-***"
            />
          </label>
          <label>
            请求超时(ms)
            <input
              type="number"
              min={1000}
              value={reportSettings.timeoutMs}
              onChange={(inputEvent) =>
                updateReportSettings({
                  timeoutMs: Math.max(1000, Number(inputEvent.target.value) || 15000),
                })
              }
            />
          </label>
          <div className="control-buttons">
            <button type="button" disabled={reportStatus.generating} onClick={() => void generateReportNow()}>
              {reportStatus.generating ? '生成中...' : '生成报告'}
            </button>
          </div>
        </div>

        <div className="sync-grid">
          <label>
            Webhook
            <input
              type="checkbox"
              checked={pushSettings.webhookEnabled}
              onChange={(inputEvent) => updatePushSettings({ webhookEnabled: inputEvent.target.checked })}
            />
          </label>
          <label>
            Webhook URL
            <input
              value={pushSettings.webhookUrl}
              onChange={(inputEvent) => updatePushSettings({ webhookUrl: inputEvent.target.value })}
              placeholder="https://example.com/webhook"
            />
          </label>
          <label>
            钉钉机器人
            <input
              type="checkbox"
              checked={pushSettings.dingTalkEnabled}
              onChange={(inputEvent) => updatePushSettings({ dingTalkEnabled: inputEvent.target.checked })}
            />
          </label>
          <label>
            钉钉 Webhook
            <input
              value={pushSettings.dingTalkWebhookUrl}
              onChange={(inputEvent) => updatePushSettings({ dingTalkWebhookUrl: inputEvent.target.value })}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=***"
            />
          </label>
          <label>
            飞书机器人
            <input
              type="checkbox"
              checked={pushSettings.feishuEnabled}
              onChange={(inputEvent) => updatePushSettings({ feishuEnabled: inputEvent.target.checked })}
            />
          </label>
          <label>
            飞书 Webhook
            <input
              value={pushSettings.feishuWebhookUrl}
              onChange={(inputEvent) => updatePushSettings({ feishuWebhookUrl: inputEvent.target.value })}
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/***"
            />
          </label>
        </div>

        <label className="report-editor">
          报告文本（可手动编辑）
          <textarea value={reportText} onChange={(inputEvent) => setReportText(inputEvent.target.value)} />
        </label>
        <div className="control-buttons">
          <button type="button" disabled={reportStatus.pushing} onClick={() => void pushReportNow()}>
            {reportStatus.pushing ? '推送中...' : '推送报告'}
          </button>
        </div>
        <p className="sync-status">
          状态: {reportStatus.message}
          {reportStatus.lastGeneratedAt ? ` · 最近生成 ${formatClock(reportStatus.lastGeneratedAt)}` : ''}
          {reportStatus.lastPushedAt ? ` · 最近推送 ${formatClock(reportStatus.lastPushedAt)}` : ''}
        </p>
      </section>

      <section className="panel">
        <h2>手工补录</h2>
        <div className="manual-form">
          <label>
            活动标题
            <input value={manualTitle} onChange={(inputEvent) => setManualTitle(inputEvent.target.value)} />
          </label>
          <label>
            时长（分钟）
            <input
              type="number"
              min={1}
              value={manualMinutes}
              onChange={(inputEvent) => setManualMinutes(Math.max(1, Number(inputEvent.target.value)))}
            />
          </label>
          <button type="button" onClick={() => addManual(manualTitle, manualMinutes)}>
            添加补录
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>分类汇总（主分类）</h2>
        <ul className="category-list">
          {categorySnapshots.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{formatDuration(item.durationMs)}</strong>
            </li>
          ))}
          {categorySnapshots.length === 0 && <li>暂无数据</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>批量待办箱</h2>
        <p className="lead">将未分类片段按资源批量归类。可 1 步用建议分类，或 2-3 步自定义后批量应用。</p>
        <div className="list-stack">
          {pendingInbox.map((item) => (
            <InboxRow key={item.resourceKey} item={item} onApply={applyInboxRule} />
          ))}
          {pendingInbox.length === 0 && <p className="empty">当前没有未分类片段。</p>}
        </div>
      </section>

      <section className="panel">
        <h2>活动时间轴（资源级）</h2>
        <div className="list-stack">
          {events.map((event) => (
            <EventRow
              key={event.eventId}
              event={event}
              annotation={annotations.get(event.eventId)}
              onSave={annotateEvent}
            />
          ))}
          {events.length === 0 && <p className="empty">该日期暂无活动记录。</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
