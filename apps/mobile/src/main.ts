import { bootstrapMobileShell, toDayString } from './model/mobile-shell.js';

export function runMobileShellBootstrap(deviceId: string, nowMs = Date.now()): void {
  const shell = bootstrapMobileShell(deviceId, nowMs);
  const offDeviceItem = shell.addManualEntryWithAnnotation({
    title: 'Commute and planning',
    minutes: 25,
    endAtMs: nowMs - 2 * 60 * 1000,
    primaryCategory: 'learning',
    tagsRaw: 'mobile, commute, podcast',
  });
  shell.saveAnnotationDraft({
    eventId: offDeviceItem.event.eventId,
    primaryCategory: 'learning',
    tagsRaw: 'mobile, commute, podcast, recap',
    note: 'Updated on mobile shell bootstrap flow',
    updatedAt: nowMs + 1,
  });
  const view = shell.getView(toDayString(nowMs));

  console.log('[mobile] shell ready', {
    day: view.day,
    timelineCount: view.timeline.length,
    pendingInboxCount: view.stats.pendingInboxCount,
    stackedMs: view.stats.stackedMs,
    naturalMs: view.stats.naturalMs,
  });
}

if (process.env.NODE_ENV !== 'test') {
  runMobileShellBootstrap('mobile-local');
}
