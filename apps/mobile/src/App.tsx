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

type SectionKey = 'capture' | 'inbox' | 'timeline' | 'stats' | 'snapshot';

type SnapshotTone = 'neutral' | 'success' | 'warning';

const QUICK_CATEGORY_PRESETS: QuickCategoryPreset[] = [
  { value: 'work', label: '工作', tags: ['focus'] },
  { value: 'learning', label: '学习', tags: ['reading'] },
  { value: 'entertainment', label: '娱乐', tags: ['break'] },
  { value: 'admin', label: '杂务', tags: ['ops'] },
];

const QUICK_TAG_PRESETS = ['mobile', 'quick', 'review', 'plan', 'sync'] as const;
const QUICK_MINUTES = [10, 20, 30, 45] as const;

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

function toPercent(value: number, base: number): number {
  if (base <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / base) * 100));
}

interface TimelineCardProps {
  item: MobileTimelineItem;
  onSave: (eventId: string, primaryCategory?: string, tagsRaw?: string, note?: string) => void;
}

function TimelineCard({ item, onSave }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(!item.annotation?.primaryCategory);
  const [primaryCategory, setPrimaryCategory] = useState(item.annotation?.primaryCategory ?? '');
  const [tagsRaw, setTagsRaw] = useState(toTagsRaw(item.annotation?.tags ?? []));
  const [note, setNote] = useState(item.annotation?.note ?? '');

  useEffect(() => {
    setPrimaryCategory(item.annotation?.primaryCategory ?? '');
    setTagsRaw(toTagsRaw(item.annotation?.tags ?? []));
    setNote(item.annotation?.note ?? '');
    setExpanded(!item.annotation?.primaryCategory);
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
      <header className="card-head">
        <div>
          <strong>{item.event.resourceTitle ?? item.event.resourceKey}</strong>
          <p>
            <span>{item.event.resourceKind}</span>
            <span>{formatClock(item.event.startedAt)} - {formatClock(item.event.endedAt)}</span>
            <span>{formatDuration(item.event.endedAt - item.event.startedAt)}</span>
          </p>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? '收起' : '编辑'}
        </button>
      </header>

      {expanded && (
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
      )}
    </article>
  );
}

interface InboxCardProps {
  item: PendingInboxItem;
  onApply: (item: PendingInboxItem, primaryCategory?: string, tagsRaw?: string, note?: string) => void;
}

function InboxCard({ item, onApply }: InboxCardProps) {
  const suggestion = useMemo(() => inferInboxPreset(item), [item]);
  const [expanded, setExpanded] = useState(true);
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
      <header className="card-head">
        <div>
          <strong>{item.resourceTitle ?? item.resourceKey}</strong>
          <p>
            <span>未分类 {item.eventIds.length} 条</span>
            <span>叠加 {formatDuration(item.stackedMs)}</span>
            <span>最近 {formatClock(item.lastSeenAt)}</span>
          </p>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? '收起' : '处理'}
        </button>
      </header>

      {expanded && (
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
      )}
    </article>
  );
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
  const [activeSection, setActiveSection] = useState<SectionKey>('capture');
  const [manualTitle, setManualTitle] = useState('移动端补录');
  const [manualMinutes, setManualMinutes] = useState(20);
  const [manualCategory, setManualCategory] = useState('');
  const [manualTagsRaw, setManualTagsRaw] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [actionStatus, setActionStatus] = useState('准备记录下一段活动');
  const [snapshotText, setSnapshotText] = useState('');
  const [snapshotStatus, setSnapshotStatus] = useState('尚未导入/导出快照');
  const [snapshotTone, setSnapshotTone] = useState<SnapshotTone>('neutral');

  const maxCategoryMs = useMemo(() => {
    if (view.stats.byPrimaryCategory.length === 0) {
      return 1;
    }

    return Math.max(...view.stats.byPrimaryCategory.map((item) => item.stackedMs), 1);
  }, [view.stats.byPrimaryCategory]);

  const parallelMultiplier = useMemo(() => {
    if (view.stats.naturalMs <= 0) {
      return 'N/A';
    }

    return `${(view.stats.stackedMs / view.stats.naturalMs).toFixed(2)}x`;
  }, [view.stats.naturalMs, view.stats.stackedMs]);

  const sections = useMemo(() => {
    return [
      { key: 'capture' as const, label: '补录', badge: '' },
      { key: 'inbox' as const, label: '待处理', badge: String(view.pendingInbox.length) },
      { key: 'timeline' as const, label: '时间线', badge: String(view.timeline.length) },
      { key: 'stats' as const, label: '统计', badge: String(view.stats.byPrimaryCategory.length) },
      { key: 'snapshot' as const, label: '快照', badge: '' },
    ];
  }, [view.pendingInbox.length, view.stats.byPrimaryCategory.length, view.timeline.length]);

  useEffect(() => {
    if (activeSection === 'inbox' && view.pendingInbox.length === 0) {
      setActionStatus('当前待处理为 0，建议直接补录或检查时间线标注');
    }
  }, [activeSection, view.pendingInbox.length]);

  return (
    <main className="mobile-shell">
      <header className="hero">
        <div className="hero__topline">
          <p className="hero__kicker">TimeTracker Mobile</p>
          <span className="hero__chip">Device {deviceId}</span>
        </div>
        <h1>Daily Focus Cockpit</h1>
        <p className="hero__lead">
          移动端优先视图：先记，再分，再看趋势。你只需要在一个屏幕里完成今日闭环。
        </p>

        <div className="hero__controls">
          <label>
            日期
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
        </div>

        <div className="stats-grid">
          <article>
            <h2>自然时长</h2>
            <p>{formatDuration(view.stats.naturalMs)}</p>
            <small>同一时段最多记 1 份</small>
          </article>
          <article>
            <h2>叠加时长</h2>
            <p>{formatDuration(view.stats.stackedMs)}</p>
            <small>并行系数 {parallelMultiplier}</small>
          </article>
          <article>
            <h2>待归类</h2>
            <p>{view.stats.pendingInboxCount}</p>
            <small>资源桶待处理</small>
          </article>
        </div>
      </header>

      <nav className="section-nav" aria-label="功能分区">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            className={section.key === activeSection ? 'section-tab section-tab--active' : 'section-tab'}
            onClick={() => setActiveSection(section.key)}
          >
            <span>{section.label}</span>
            {section.badge && <small>{section.badge}</small>}
          </button>
        ))}
      </nav>

      <p className="action-status">{actionStatus}</p>

      {activeSection === 'capture' && (
        <section className="panel panel--focus" aria-labelledby="capture-title">
          <header className="panel-head">
            <h2 id="capture-title">手工补录</h2>
            <p>优先在移动端快速补齐离线活动，再进入分类和复盘。</p>
          </header>

          <div className="chip-row">
            <span className="chip-row__label">快捷时长</span>
            {QUICK_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={minutes === manualMinutes ? 'chip chip--primary' : 'chip'}
                onClick={() => setManualMinutes(minutes)}
              >
                {minutes}m
              </button>
            ))}
          </div>

          <div className="chip-row">
            <span className="chip-row__label">快捷分类</span>
            {QUICK_CATEGORY_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={preset.value === manualCategory ? 'chip chip--primary' : 'chip'}
                onClick={() => {
                  setManualCategory(preset.value);
                  setManualTagsRaw(toTagsRaw(mergeTags(parseTagDraft(manualTagsRaw), preset.tags)));
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

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
              setActionStatus(`已添加「${manualTitle}」${manualMinutes} 分钟，建议下一步做标注检查`);
              setActiveSection('timeline');
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
            <button type="submit">添加记录并前往时间线</button>
          </form>
        </section>
      )}

      {activeSection === 'inbox' && (
        <section className="panel" aria-labelledby="inbox-title">
          <header className="panel-head">
            <h2 id="inbox-title">待处理归类</h2>
            <p>按资源桶批量处理未分类条目，优先消灭高频来源。</p>
          </header>

          {view.pendingInbox.length > 0 ? (
            <div className="stack-list">
              {view.pendingInbox.map((item) => (
                <InboxCard
                  key={item.resourceKey}
                  item={item}
                  onApply={(target, primaryCategory, tagsRaw, note) => {
                    applyInboxAnnotation(target, { primaryCategory, tagsRaw, note });
                    setActionStatus(`已批量处理 ${target.eventIds.length} 条，继续清理剩余待处理`);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="empty">当前没有未分类条目，今日分类已清空。</p>
          )}
        </section>
      )}

      {activeSection === 'timeline' && (
        <section className="panel" aria-labelledby="timeline-title">
          <header className="panel-head">
            <h2 id="timeline-title">活动时间线</h2>
            <p>逐条补充分类、标签和备注，保证日报质量。</p>
          </header>

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
                    setActionStatus('标注已保存，建议继续检查下一条');
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="empty">该日期暂无活动记录，先去补录区添加一条活动。</p>
          )}
        </section>
      )}

      {activeSection === 'stats' && (
        <section className="panel" aria-labelledby="stats-title">
          <header className="panel-head">
            <h2 id="stats-title">分类统计</h2>
            <p>同一口径展示自然/叠加时长，快速判断负载结构。</p>
          </header>

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
            <p className="empty">还没有分类数据，先去时间线补标注。</p>
          )}
        </section>
      )}

      {activeSection === 'snapshot' && (
        <section className="panel" aria-labelledby="snapshot-title">
          <header className="panel-head">
            <h2 id="snapshot-title">本地快照</h2>
            <p>导出为 JSON 备份，或导入覆盖当前会话。</p>
          </header>

          <div className="snapshot-actions">
            <button
              type="button"
              onClick={() => {
                const exported = exportSnapshot();
                setSnapshotText(exported);
                setSnapshotStatus(`已导出快照（${exported.length} chars）`);
                setSnapshotTone('success');
              }}
            >
              导出快照
            </button>
            <button
              type="button"
              onClick={() => {
                const result = importSnapshot(snapshotText);
                setSnapshotStatus(result.message);
                setSnapshotTone(result.ok ? 'success' : 'warning');
              }}
            >
              导入快照
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setSnapshotText('');
                setSnapshotStatus('已清空编辑区');
                setSnapshotTone('neutral');
              }}
            >
              清空文本
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
          <p className={`snapshot-status snapshot-status--${snapshotTone}`}>{snapshotStatus}</p>
        </section>
      )}
    </main>
  );
}

export default App;
