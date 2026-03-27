import assert from 'node:assert/strict';
import test from 'node:test';
import { MobileShellModel } from '../src/model/mobile-shell.js';
import {
  parseMobileShellSnapshot,
  stringifyMobileShellSnapshot,
} from '../src/model/snapshot.js';

test('mobile snapshot parser restores shell state from exported JSON', () => {
  const shell = new MobileShellModel('mobile-snapshot-io');
  const endAt = Date.parse('2026-03-27T20:00:00.000Z');
  const event = shell.addManualEntry('Review day', 35, endAt);
  shell.saveAnnotationDraft({
    eventId: event.eventId,
    primaryCategory: 'work',
    tagsRaw: 'review, mobile',
    note: 'snapshot entry',
    updatedAt: endAt + 1,
  });

  const exported = stringifyMobileShellSnapshot(shell.createSnapshot());
  const parsed = parseMobileShellSnapshot(exported);
  const restored = MobileShellModel.fromSnapshot('mobile-snapshot-restore', parsed);
  const view = restored.getView('2026-03-27');

  assert.equal(view.timeline.length, 1);
  assert.equal(view.timeline[0]?.annotation?.primaryCategory, 'work');
  assert.deepEqual(view.timeline[0]?.annotation?.tags, ['review', 'mobile']);
  assert.equal(view.timeline[0]?.annotation?.note, 'snapshot entry');
});

test('mobile snapshot parser rejects invalid payload shape', () => {
  assert.throws(
    () => parseMobileShellSnapshot('{\"events\":{},\"annotations\":[]}'),
    /Invalid snapshot.events/,
  );

  assert.throws(
    () =>
      parseMobileShellSnapshot(
        JSON.stringify({
          events: [
            {
              eventId: 'x',
              deviceId: 'mobile-a',
              resourceKind: 'manual',
              resourceKey: 'manual://x',
              startedAt: 200,
              endedAt: 100,
              source: 'manual',
            },
          ],
          annotations: [],
        }),
      ),
    /endedAt must be greater than startedAt/,
  );
});
