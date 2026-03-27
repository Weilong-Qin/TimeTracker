import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MobileShellModel,
  bootstrapMobileShell,
  toDayString,
} from '../src/model/mobile-shell.js';

test('mobile shell integrates with shared contracts for timeline + stats view', () => {
  const shell = new MobileShellModel('mobile-model');
  const endAt = Date.parse('2026-03-27T10:00:00.000Z');
  const itemA = shell.addManualEntryWithAnnotation({
    title: 'Design review',
    minutes: 60,
    endAtMs: endAt,
    primaryCategory: 'work',
    tagsRaw: 'design, review',
  });
  const itemB = shell.addManualEntryWithAnnotation({
    title: 'Async notes',
    minutes: 45,
    endAtMs: endAt + 30 * 60 * 1000,
    primaryCategory: 'learning',
    tagsRaw: 'docs',
  });
  shell.saveAnnotationDraft({
    eventId: itemB.event.eventId,
    primaryCategory: 'learning',
    tagsRaw: 'docs, notes',
    note: 'edited on mobile',
    updatedAt: endAt + 31 * 60 * 1000,
  });

  const view = shell.getView('2026-03-27');

  assert.equal(view.timeline.length, 2);
  assert.equal(view.timeline[0]?.event.source, 'manual');
  assert.equal(view.timeline[0]?.event.resourceKind, 'manual');
  assert.equal(view.timeline[0]?.event.eventId, itemA.event.eventId);
  assert.equal(view.timeline[1]?.event.eventId, itemB.event.eventId);
  assert.equal(view.stats.byPrimaryCategory.length, 2);
  assert.equal(view.stats.byPrimaryCategory[0]?.key, 'work');
  assert.equal(view.stats.byPrimaryCategory[1]?.key, 'learning');
  assert.equal(view.stats.pendingInboxCount, 0);
  assert.ok(view.stats.stackedMs >= view.stats.naturalMs);
  assert.equal(view.timeline[1]?.annotation?.note, 'edited on mobile');
  assert.deepEqual(view.timeline[1]?.annotation?.tags, ['docs', 'notes']);
});

test('mobile shell snapshot restore keeps summary and annotations stable', () => {
  const shell = new MobileShellModel('mobile-snapshot');
  const endAt = Date.parse('2026-03-27T13:00:00.000Z');
  const event = shell.addManualEntry('Plan sprint', 30, endAt);
  shell.annotateEvent(event.eventId, 'work', ['planning'], endAt + 1);

  const before = shell.getView('2026-03-27');
  const snapshot = shell.createSnapshot();
  const restored = MobileShellModel.fromSnapshot('mobile-restored', snapshot);
  const after = restored.getView('2026-03-27');

  assert.equal(after.timeline.length, before.timeline.length);
  assert.equal(after.stats.stackedMs, before.stats.stackedMs);
  assert.equal(after.stats.naturalMs, before.stats.naturalMs);
  assert.equal(
    after.timeline[0]?.annotation?.primaryCategory,
    before.timeline[0]?.annotation?.primaryCategory,
  );
});

test('bootstrap mobile shell produces local testable MVP flow', () => {
  const now = Date.parse('2026-03-27T16:00:00.000Z');
  const shell = bootstrapMobileShell('mobile-bootstrap', now);
  const view = shell.getView(toDayString(now));

  assert.ok(view.timeline.length >= 2);
  assert.ok(view.stats.stackedMs > 0);
  assert.ok(view.stats.naturalMs > 0);
  assert.ok(view.stats.byPrimaryCategory.some((item) => item.key === 'work'));
});

test('mobile annotation flow keeps LWW semantics when merging remote annotations', () => {
  const shell = new MobileShellModel('mobile-lww');
  const event = shell.addManualEntry('Off-device reading', 30, Date.parse('2026-03-27T18:00:00.000Z'));

  shell.saveAnnotationDraft({
    eventId: event.eventId,
    primaryCategory: 'learning',
    tagsRaw: 'read, mobile',
    updatedAt: 100,
  });

  shell.mergeRemoteAnnotations(
    new Map([
      [
        event.eventId,
        {
          primaryCategory: 'entertainment',
          tags: ['video'],
          updatedAt: 99,
          updatedByDeviceId: 'remote-a',
        },
      ],
    ]),
  );

  let view = shell.getView('2026-03-27');
  assert.equal(view.timeline[0]?.annotation?.primaryCategory, 'learning');

  shell.mergeRemoteAnnotations(
    new Map([
      [
        event.eventId,
        {
          primaryCategory: 'work',
          tags: ['summary'],
          updatedAt: 101,
          updatedByDeviceId: 'remote-b',
        },
      ],
    ]),
  );

  view = shell.getView('2026-03-27');
  assert.equal(view.timeline[0]?.annotation?.primaryCategory, 'work');
  assert.deepEqual(view.timeline[0]?.annotation?.tags, ['summary']);
  assert.equal(view.stats.byPrimaryCategory[0]?.key, 'work');
});
