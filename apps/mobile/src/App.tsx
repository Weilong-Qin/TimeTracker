import type { PendingInboxItem } from '@timetracker/core';
import { useEffect, useMemo, useState } from 'react';
import {
  parseTagDraft,
  toTagsRaw,
  useMobileShell,
} from './hooks/use-mobile-shell.js';
import { formatClock, formatDuration } from './lib/format.js';
import type { MobileTimelineItem } from './model/mobile-shell.js';

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

const QUICK_TAG_PRESETS = ['mobile', 'quick', 'review', 'plan', 'sync'] as const;

function mergeTags(base: string[], incoming: string[]): string[] {
  const merged = new Set<string>();

  for (const tag of base) {
    const trimmed = tag.trim();
    if (trimmed.length > 0) {
      merged.add(trimmed);
    }
  }

  for (const tag of incoming) {
    const trimmed = tag.trim();
    if (trimmed.length > 0) {
      merged.add(trimmed);
    }
  }

  return [...merged];
}

function inferInboxPreset(item: PendingInboxItem): QuickCategoryPreset {
  const key = item.resourceKey.toLowerCase();
  const title = (item.resourceTitle ?? '').toLowerCase();
  const combined = `${key} ${title}`;

  if (combined.includes('meeting') || combined.includes('project') || combined.includes('github')) {
    return { value: 'work', label: '建议: 工作', tags: ['project'] };
  }

  if (combined.includes('article') || combined.includes('doc') || combined.includes('read')) {
    return { value: 'learning', label: '建议: 学习', tags: ['reading'] };
  }

  if (combined.includes('video') || combined.includes('music') || combined.includes('podcast')) {
    return { value: 'entertainment', label: '建议: 娱乐', tags: ['media'] };
  }

  return { value: 'work', label: '建议: 工作', tags: ['focus'] };
}

interface TimelineCardProps {
  item: MobileTimelineItem;
  onSave: (eventId: string, primaryCategory?: string, tagsRaw?: string, note?: string) => void;
}

function TimelineCard({ item, onSave }: TimelineCardProps) {
  const [primaryCategory, setPrimaryCategory] = useState(item.annotation?.primaryCategory ?? '');
  const [tagsRaw, setTagsRaw] = useState(toTagsRaw(item.annotation?.tags ?? []));
  const [note, setNote] = useState(item.annotation?.note ?? '');

  useEffect(() => {
    setPrimaryCategory(item.annotation?.primaryCategory ?? '');
    setTagsRaw(toTagsRaw(item.annotation?.tags ?? []));
    setNote(item.annotation?.note ?? '');
  }, [item.annotation?.note, item.annotation?.primaryCategory, item.annotation?.tags]);

  const saveDraft = (nextCategory: string, nextTagsRaw: string, nextNote: string): void => {
    onSave(item.event.eventId, nextCategory, nextTagsRaw, nextNote);
  };

  const appendTag = (tag: string): void => {
    const merged = mergeTags(parseTagDraft(tagsRaw), [tag]);
    setTagsRaw(toTagsRaw(merged));
  };

  const applyPreset = (preset: QuickCategoryPreset): void => {
    const mergedTags = mergeTags(parseTagDraft(tagsRaw), preset.tags);
    const mergedRaw = toTagsRaw(mergedTags);
    setPrimaryCategory(preset.value);
    setTagsRaw(mergedRaw);
    saveDraft(preset.value, mergedRaw, note);
  };

  return (
    <article className="timeline-card">
      <header className="timeline-card__meta">
        <strong>{item.event.resourceTitle ?? item.event.resourceKey}</strong>
        <p>
          <span>{item.event.resourceKind}</span>
          <span>{formatClock(item.event.startedAt)} - {formatClock(item.event.endedAt)}</span>
          <span>{formatDuration(item.event.endedAt - item.event.startedAt)}</span>
        </p>
      </header>

      <form
        className="timeline-card__form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          saveDraft(primaryCategory, tagsRaw, note);
        }}
      >
        <div className="chip-row">
          <span className="chip-row__label">一键分类</span>
          {QUICK_CATEGORY_PRESETS.map((preset) => (
            <button key={preset.value} type="button" className="chip" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <span className="chip-row__label">快捷标签</span>
          {QUICK_TAG_PRESETS.map((tag) => (
            <button key={tag} type="button" className="chip chip--subtle" onClick={() => appendTag(tag)}>
              +{tag}
            </button>
          ))}
        </div>
        <label>
          分类
          <input
            value={primaryCategory}
            onChange={(event) => setPrimaryCategory(event.target.value)}
            placeholder="work / learning / entertainment / admin"
          />
        </label>
        <label>
          标签
          <input
            value={tagsRaw}
            onChange={(event) => setTagsRaw(event.target.value)}
            placeholder="mobile, review, note"
          />
        </label>
        <label>
          备注
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="补充上下文" />
        </label>
        <button type="submit">保存标注</button>
      </form>
    </article>
  );
}

interface InboxCardProps {
  item: PendingInboxItem;
  onApply: (item: PendingInboxItem, primaryCategory?: string, tagsRaw?: string, note?: string) => void;
}

function InboxCard({ item, onApply }: InboxCardProps) {
  const suggestion = useMemo(() => inferInboxPreset(item), [item]);
  const [primaryCategory, setPrimaryCategory] = useState(suggestion.value);
  const [tagsRaw, setTagsRaw] = useState(toTagsRaw(suggestion.tags));
  const [note, setNote] = useState('');

  useEffect(() => {
    setPrimaryCategory(suggestion.value);
    setTagsRaw(toTagsRaw(suggestion.tags));
  }, [suggestion]);

  const applyPreset = (preset: QuickCategoryPreset): void => {
    const merged = toTagsRaw(mergeTags(parseTagDraft(tagsRaw), preset.tags));
    setPrimaryCategory(preset.value);
    setTagsRaw(merged);
    onApply(item, preset.value, merged, note);
  };

  return (
    <article className="inbox-card">
      <header className="timeline-card__meta">
        <strong>{item.resourceTitle ?? item.resourceKey}</strong>
        <p>
          <span>未分类 {item.eventIds.length} 条</span>
          <span>叠加 {formatDuration(item.stackedMs)}</span>
          <span>最近 {formatClock(item.lastSeenAt)}</span>
        </p>
      </header>
      <form
        className="timeline-card__form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          onApply(item, primaryCategory, tagsRaw, note);
        }}
      >
        <div className="chip-row">
          <button type="button" className="chip chip--primary" onClick={() => applyPreset(suggestion)}>
            {suggestion.label}
          </button>
          {QUICK_CATEGORY_PRESETS.map((preset) => (
            <button key={preset.value} type="button" className="chip" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <label>
          分类
          <input value={primaryCategory} onChange={(event) => setPrimaryCategory(event.target.value)} />
        </label>
        <label>
          标签
          <input value={tagsRaw} onChange={(event) => setTagsRaw(event.target.value)} />
        </label>
        <label>
          备注
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="批量说明（可选）" />
        </label>
        <button type="submit">批量应用</button>
      </form>
    </article>
  );
}

function toPercent(value: number, base: number): number {
  if (base <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / base) * 100));
}

export function App() {
  const {
    day,
    setDay,
    deviceId,
    view,
    addManualEntry,
    saveAnnotationDraft,
    applyInboxAnnotation,
    exportSnapshot,
    importSnapshot,
  } = useMobileShell();
  const [manualTitle, setManualTitle] = useState('移动端补录');
  const [manualMinutes, setManualMinutes] = useState(20);
  const [manualCategory, setManualCategory] = useState('');
  const [manualTagsRaw, setManualTagsRaw] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [snapshotText, setSnapshotText] = useState('');
  const [snapshotStatus, setSnapshotStatus] = useState('尚未导入/导出快照');

  const maxCategoryMs = useMemo(() => {
    if (view.stats.byPrimaryCategory.length === 0) {
      return 1;
    }

    return Math.max(...view.stats.byPrimaryCategory.map((item) => item.stackedMs), 1);
  }, [view.stats.byPrimaryCategory]);

  return (
    <main className="mobile-shell">
      <header className="hero">
        <p className="hero__kicker">TimeTracker Mobile</p>
        <h1>Pocket Activity Hub</h1>
        <p className="hero__lead">
          面向移动端的完整 MVP：手工记录、时间线标注、待处理归类、统计看板与快照导入导出。
        </p>
        <div className="hero__controls">
          <label>
            日期
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          <label>
            Device ID
            <input value={deviceId} readOnly />
          </label>
        </div>
      </header>

      <section className="stats-grid">
        <article>
          <h2>自然时长</h2>
          <p>{formatDuration(view.stats.naturalMs)}</p>
          <small>同一时段最多记 1 份</small>
        </article>
        <article>
          <h2>叠加时长</h2>
          <p>{formatDuration(view.stats.stackedMs)}</p>
          <small>并行活动累加统计</small>
        </article>
        <article>
          <h2>待归类</h2>
          <p>{view.stats.pendingInboxCount}</p>
          <small>待处理资源桶</small>
        </article>
      </section>

      <section className="panel">
        <h2>手工补录</h2>
        <form
          className="manual-form"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            addManualEntry({
              title: manualTitle,
              minutes: manualMinutes,
              primaryCategory: manualCategory || undefined,
              tagsRaw: manualTagsRaw || undefined,
              note: manualNote || undefined,
            });
            setManualNote('');
          }}
        >
          <label>
            活动标题
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} required />
          </label>
          <label>
            时长（分钟）
            <input
              type="number"
              min={1}
              value={manualMinutes}
              onChange={(event) => setManualMinutes(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <label>
            默认分类（可选）
            <input value={manualCategory} onChange={(event) => setManualCategory(event.target.value)} />
          </label>
          <label>
            默认标签（可选）
            <input
              value={manualTagsRaw}
              onChange={(event) => setManualTagsRaw(event.target.value)}
              placeholder="mobile, commute"
            />
          </label>
          <label className="manual-form__note">
            备注（可选）
            <textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} />
          </label>
          <button type="submit">添加记录</button>
        </form>
      </section>

      <section className="panel">
        <h2>待处理归类</h2>
        {view.pendingInbox.length > 0 ? (
          <div className="stack-list">
            {view.pendingInbox.map((item) => (
              <InboxCard
                key={item.resourceKey}
                item={item}
                onApply={(target, primaryCategory, tagsRaw, note) => {
                  applyInboxAnnotation(target, { primaryCategory, tagsRaw, note });
                }}
              />
            ))}
          </div>
        ) : (
          <p className="empty">当前没有未分类条目。</p>
        )}
      </section>

      <section className="panel">
        <h2>活动时间线</h2>
        {view.timeline.length > 0 ? (
          <div className="stack-list">
            {view.timeline.map((item) => (
              <TimelineCard
                key={item.event.eventId}
                item={item}
                onSave={(eventId, primaryCategory, tagsRaw, note) => {
                  saveAnnotationDraft({
                    eventId,
                    primaryCategory,
                    tagsRaw,
                    note,
                  });
                }}
              />
            ))}
          </div>
        ) : (
          <p className="empty">该日期暂无活动记录。</p>
        )}
      </section>

      <section className="panel">
        <h2>分类统计</h2>
        {view.stats.byPrimaryCategory.length > 0 ? (
          <div className="summary-list" role="list" aria-label="分类统计列表">
            {view.stats.byPrimaryCategory.map((item) => (
              <article key={item.key} className="summary-item" role="listitem">
                <div className="summary-item__head">
                  <strong>{item.key}</strong>
                  <span>
                    自然 {formatDuration(item.naturalMs)} · 叠加 {formatDuration(item.stackedMs)}
                  </span>
                </div>
                <div className="summary-item__track">
                  <span style={{ width: `${toPercent(item.stackedMs, maxCategoryMs)}%` }} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">还没有分类数据。</p>
        )}
      </section>

      <section className="panel">
        <h2>本地快照</h2>
        <p className="snapshot-tip">导出可复制为 JSON 文件；导入会覆盖当前会话数据。</p>
        <div className="snapshot-actions">
          <button
            type="button"
            onClick={() => {
              const exported = exportSnapshot();
              setSnapshotText(exported);
              setSnapshotStatus(`已导出快照（${exported.length} chars）`);
            }}
          >
            导出快照
          </button>
          <button
            type="button"
            onClick={() => {
              const result = importSnapshot(snapshotText);
              setSnapshotStatus(result.message);
            }}
          >
            导入快照
          </button>
        </div>
        <label>
          快照 JSON
          <textarea
            className="snapshot-editor"
            value={snapshotText}
            onChange={(event) => setSnapshotText(event.target.value)}
            placeholder='{"events":[...],"annotations":[...]}'
          />
        </label>
        <p className="snapshot-status">{snapshotStatus}</p>
      </section>
    </main>
  );
}

export default App;
