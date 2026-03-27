import assert from 'node:assert/strict';
import test from 'node:test';
import { validateActivityEvent } from '@timetracker/core';
import {
  createCaptureProvider,
  inferProjectRootFromWindowTitle,
  parseBrowserBridgeSnapshot,
  resolveCaptureProviderMode,
} from '../src/capture/provider.js';

test('capture provider mode parser defaults to auto for invalid input', () => {
  assert.equal(resolveCaptureProviderMode('window'), 'window');
  assert.equal(resolveCaptureProviderMode('mock'), 'mock');
  assert.equal(resolveCaptureProviderMode('browser'), 'browser');
  assert.equal(resolveCaptureProviderMode('auto'), 'auto');
  assert.equal(resolveCaptureProviderMode('unexpected'), 'auto');
  assert.equal(resolveCaptureProviderMode(null), 'auto');
});

test('browser bridge snapshot parser normalizes valid payload and rejects malformed data', () => {
  const valid = parseBrowserBridgeSnapshot(
    JSON.stringify({
      url: 'https://example.com/tasks?id=1',
      title: 'Tasks',
      active: true,
      capturedAtMs: 1_700_000_000_100,
      browser: 'chrome',
    }),
  );

  assert.ok(valid);
  assert.equal(valid?.url, 'https://example.com/tasks?id=1');
  assert.equal(valid?.title, 'Tasks');
  assert.equal(valid?.active, true);

  const malformed = parseBrowserBridgeSnapshot('{"url":123}');
  assert.equal(malformed, null);
});

test('project root attribution resolves editor title into workspace key', () => {
  const attribution = inferProjectRootFromWindowTitle(
    'use-activity-model.ts - timetracker - Visual Studio Code',
  );

  assert.ok(attribution);
  assert.equal(attribution?.projectKey, '/workspace/timetracker');
  assert.equal(attribution?.projectName, 'timetracker');
});

test('mock provider emits valid ActivityEvent payload', () => {
  const provider = createCaptureProvider({ mode: 'mock' });
  assert.equal(provider.kind, 'mock');

  const event = provider.capture('device-mock', 1_700_000_000_000);
  assert.ok(event);
  if (!event) {
    throw new Error('expected mock provider event');
  }
  assert.equal(validateActivityEvent(event).valid, true);
});

test('browser provider emits web resource event when browser target is available', () => {
  const provider = createCaptureProvider({
    mode: 'browser',
    browserTarget: {
      location: { href: 'https://example.com/app?tab=work' },
      document: { title: 'Example Work Tab' },
    },
    sampleDurationMs: 15_000,
  });

  assert.equal(provider.kind, 'browser');

  const event = provider.capture('device-browser', 1_700_000_100_000);
  assert.ok(event);
  assert.equal(event?.resourceKind, 'web');
  assert.equal(event?.resourceKey, 'https://example.com/app?tab=work');
  assert.equal(event?.resourceTitle, 'Example Work Tab');
  assert.equal(event?.startedAt, 1_700_000_085_000);
  assert.equal(event?.endedAt, 1_700_000_100_000);
  if (!event) {
    throw new Error('expected browser provider event');
  }
  assert.equal(validateActivityEvent(event).valid, true);
});

test('browser provider uses bridge snapshot when provided', () => {
  const provider = createCaptureProvider({
    mode: 'browser',
    browserTarget: {
      location: { href: 'https://fallback.local/' },
      document: { title: 'Fallback Page' },
    },
    getBrowserBridgeSnapshot: () => ({
      url: 'https://bridge.local/work?ticket=42',
      title: 'Bridge Active Tab',
      active: true,
      capturedAtMs: 1_700_000_120_000,
      browser: 'edge',
    }),
  });

  assert.equal(provider.kind, 'browser');
  const event = provider.capture('device-bridge', 1_700_000_120_000);
  assert.ok(event);
  assert.equal(event?.resourceKind, 'web');
  assert.equal(event?.resourceKey, 'https://bridge.local/work?ticket=42');
  assert.equal(event?.resourceTitle, 'Bridge Active Tab');
});

test('browser provider falls back to target location when bridge snapshot is inactive', () => {
  const provider = createCaptureProvider({
    mode: 'browser',
    browserTarget: {
      location: { href: 'https://fallback.local/board' },
      document: { title: 'Fallback Board' },
    },
    getBrowserBridgeSnapshot: () => ({
      url: 'https://bridge.local/inactive',
      title: 'Inactive',
      active: false,
      capturedAtMs: 1_700_000_130_000,
      browser: 'firefox',
    }),
  });

  const event = provider.capture('device-bridge-fallback', 1_700_000_130_000);
  assert.ok(event);
  assert.equal(event?.resourceKey, 'https://fallback.local/board');
  assert.equal(event?.resourceTitle, 'Fallback Board');
});

test('window provider emits app resource event when window is visible and focused', () => {
  const provider = createCaptureProvider({
    mode: 'window',
    browserTarget: {
      location: { href: 'https://timetracker.local/app' },
      document: { title: 'TimeTracker - Inbox', visibilityState: 'visible' },
      hasFocus: () => true,
      navigator: { platform: 'Linux x86_64' },
    },
    sampleDurationMs: 15_000,
  });

  assert.equal(provider.kind, 'window');
  const event = provider.capture('device-window', 1_700_000_150_000);
  assert.ok(event);
  if (!event) {
    throw new Error('expected window provider event');
  }

  assert.equal(event.resourceKind, 'app');
  assert.equal(
    event.resourceKey,
    'window://linux-x86-64/timetracker-inbox',
  );
  assert.equal(event.resourceTitle, 'TimeTracker - Inbox');
  assert.equal(validateActivityEvent(event).valid, true);
});

test('window provider prioritizes project attribution for coding titles', () => {
  const provider = createCaptureProvider({
    mode: 'window',
    browserTarget: {
      document: {
        title: 'src/main.ts - timetracker - Cursor',
        visibilityState: 'visible',
      },
      hasFocus: () => true,
      navigator: { platform: 'macOS' },
    },
  });

  const event = provider.capture('device-project', 1_700_000_160_000);
  assert.ok(event);
  assert.equal(event?.resourceKind, 'project');
  assert.equal(event?.resourceKey, '/workspace/timetracker');
  assert.equal(event?.resourceTitle, 'timetracker');
});

test('window provider skips background windows', () => {
  const provider = createCaptureProvider({
    mode: 'window',
    browserTarget: {
      document: { title: 'Background Tab', visibilityState: 'hidden' },
      hasFocus: () => false,
    },
  });

  assert.equal(provider.kind, 'window');
  const event = provider.capture('device-window-bg', 1_700_000_180_000);
  assert.equal(event, null);
});

test('browser mode falls back to mock when browser target is unavailable', () => {
  const provider = createCaptureProvider({
    mode: 'browser',
    browserTarget: {
      location: { href: '' },
      document: { title: 'Unavailable' },
    },
  });

  assert.equal(provider.kind, 'mock');
  const event = provider.capture('device-fallback', 1_700_000_200_000);
  assert.ok(event);
  if (!event) {
    throw new Error('expected fallback mock event');
  }
  assert.equal(validateActivityEvent(event).valid, true);
});

test('auto mode prefers window provider when available', () => {
  const provider = createCaptureProvider({
    mode: 'auto',
    browserTarget: {
      location: { href: 'https://timetracker.local/dashboard' },
      document: { title: 'TimeTracker Dashboard' },
      hasFocus: () => true,
    },
  });

  assert.equal(provider.kind, 'window');
  const event = provider.capture('device-auto', 1_700_000_300_000);
  assert.equal(event?.resourceKind, 'app');
});
