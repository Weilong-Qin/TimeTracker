import { createMockCaptureEvent } from './mock-capture.js';
import { validateActivityEvent, type ActivityEvent } from '@timetracker/core';

export type CaptureProviderKind = 'window' | 'browser' | 'mock';
export type CaptureProviderMode = 'auto' | 'window' | 'browser' | 'mock';

const DEFAULT_SAMPLE_DURATION_MS = 15_000;
const PROJECT_ROOT_PREFIX = '/workspace/';
const EDITOR_HINTS = [
  'visual studio code',
  'code - oss',
  'cursor',
  'zed',
  'webstorm',
  'intellij',
  'pycharm',
  'goland',
  'android studio',
  'xcode',
  'neovim',
  'nvim',
  'vim',
  'sublime text',
] as const;
const PATH_NOISE_SEGMENTS = new Set([
  '',
  'users',
  'user',
  'home',
  'workspace',
  'workspaces',
  'src',
  'lib',
  'app',
  'apps',
  'packages',
  'project',
]);

export interface BrowserCaptureTarget {
  location?: {
    href?: string;
  };
  document?: {
    title?: string;
    visibilityState?: string;
  };
  hasFocus?: () => boolean;
  navigator?: {
    platform?: string;
    userAgent?: string;
  };
}

export interface CaptureProvider {
  readonly kind: CaptureProviderKind;
  isAvailable(): boolean;
  capture(deviceId: string, nowMs?: number): ActivityEvent | null;
}

export interface BrowserBridgeSnapshot {
  url: string;
  title?: string;
  active: boolean;
  capturedAtMs: number;
  browser?: string;
}

export interface ProjectRootAttribution {
  projectKey: string;
  projectName: string;
}

export interface CreateCaptureProviderOptions {
  mode?: CaptureProviderMode;
  browserTarget?: BrowserCaptureTarget | null;
  sampleDurationMs?: number;
  getBrowserBridgeSnapshot?: () => BrowserBridgeSnapshot | null;
}

function normalizeDurationMs(value: number | undefined): number {
  if (typeof value !== 'number' || value <= 0) {
    return DEFAULT_SAMPLE_DURATION_MS;
  }
  return value;
}

function normalizeBrowserHref(rawHref: string | undefined): string | null {
  if (!rawHref || !rawHref.trim()) {
    return null;
  }

  try {
    return new URL(rawHref).toString();
  } catch {
    return rawHref.trim();
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function normalizeBridgeTitle(rawTitle: unknown): string | undefined {
  if (typeof rawTitle !== 'string') {
    return undefined;
  }
  return safeDocumentTitle(rawTitle);
}

function normalizeBridgeBrowser(rawBrowser: unknown): string | undefined {
  if (typeof rawBrowser !== 'string') {
    return undefined;
  }
  const browser = rawBrowser.trim();
  return browser.length > 0 ? browser : undefined;
}

function normalizeBridgeCapturedAt(rawCapturedAt: unknown): number {
  if (typeof rawCapturedAt === 'number' && Number.isFinite(rawCapturedAt) && rawCapturedAt > 0) {
    return rawCapturedAt;
  }
  return Date.now();
}

export function parseBrowserBridgeSnapshot(raw: string | null): BrowserBridgeSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const payload = parsed as Record<string, unknown>;
    const url = normalizeBrowserHref(typeof payload.url === 'string' ? payload.url : undefined);
    if (!url) {
      return null;
    }

    return {
      url,
      title: normalizeBridgeTitle(payload.title),
      active: toBoolean(payload.active, true),
      capturedAtMs: normalizeBridgeCapturedAt(payload.capturedAtMs),
      browser: normalizeBridgeBrowser(payload.browser),
    };
  } catch {
    return null;
  }
}

function safeDocumentTitle(rawTitle: string | undefined): string | undefined {
  if (!rawTitle) {
    return undefined;
  }

  const title = rawTitle.trim();
  return title.length > 0 ? title : undefined;
}

function normalizeWindowLabel(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return 'desktop-window';
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'desktop-window';
}

function slugifyProjectName(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized;
}

function isLikelyFileName(token: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(token);
}

function normalizeProjectToken(raw: string): string | null {
  const token = raw.trim();
  if (!token) {
    return null;
  }

  const pathMatch = token.match(/\/workspace\/([A-Za-z0-9._-]+)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const normalizedPath = token.replace(/\\/g, '/');
  if (normalizedPath.includes('/')) {
    const segments = normalizedPath.split('/').filter(Boolean);
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const candidate = segments[index]?.trim() ?? '';
      if (!candidate) {
        continue;
      }
      if (PATH_NOISE_SEGMENTS.has(candidate.toLowerCase())) {
        continue;
      }
      if (isLikelyFileName(candidate)) {
        continue;
      }
      return candidate;
    }
    return null;
  }

  if (isLikelyFileName(token)) {
    return null;
  }

  return token;
}

function splitTitleTokens(rawTitle: string): string[] {
  return rawTitle
    .split(/\s(?:-|—|\|)\s/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isEditorToken(rawToken: string): boolean {
  const token = rawToken.toLowerCase();
  return EDITOR_HINTS.some((hint) => token.includes(hint));
}

function resolveProjectCandidateFromTitle(rawTitle: string): string | null {
  const tokens = splitTitleTokens(rawTitle);
  if (tokens.length === 0) {
    return null;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || !isEditorToken(token)) {
      continue;
    }

    for (let left = index - 1; left >= 0; left -= 1) {
      const candidate = normalizeProjectToken(tokens[left] ?? '');
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function inferProjectRootFromWindowTitle(
  rawTitle: string | undefined,
): ProjectRootAttribution | null {
  const title = safeDocumentTitle(rawTitle);
  if (!title) {
    return null;
  }

  const projectName = resolveProjectCandidateFromTitle(title);
  if (!projectName) {
    return null;
  }

  const slug = slugifyProjectName(projectName);
  if (!slug) {
    return null;
  }

  return {
    projectName,
    projectKey: `${PROJECT_ROOT_PREFIX}${slug}`,
  };
}

function safePlatformLabel(target: BrowserCaptureTarget): string {
  const navigatorPlatform = target.navigator?.platform;
  if (navigatorPlatform && navigatorPlatform.trim()) {
    return normalizeWindowLabel(navigatorPlatform);
  }

  const userAgent = target.navigator?.userAgent;
  if (userAgent && userAgent.trim()) {
    return normalizeWindowLabel(userAgent.split('/')[0]);
  }

  return 'desktop';
}

class MockCaptureProvider implements CaptureProvider {
  readonly kind = 'mock' as const;

  isAvailable(): boolean {
    return true;
  }

  capture(deviceId: string, nowMs = Date.now()): ActivityEvent {
    return createMockCaptureEvent(deviceId, nowMs);
  }
}

class DesktopWindowCaptureProvider implements CaptureProvider {
  readonly kind = 'window' as const;

  private sequence = 0;

  private readonly target: BrowserCaptureTarget;

  private readonly sampleDurationMs: number;

  constructor(target: BrowserCaptureTarget, sampleDurationMs: number) {
    this.target = target;
    this.sampleDurationMs = sampleDurationMs;
  }

  isAvailable(): boolean {
    return Boolean(this.target.document);
  }

  capture(deviceId: string, nowMs = Date.now()): ActivityEvent | null {
    if (!this.isAvailable()) {
      return null;
    }

    const visibility = this.target.document?.visibilityState;
    const focused = this.target.hasFocus?.() ?? true;

    // Foreground window capture: skip when page is hidden or not focused.
    if (visibility === 'hidden' || !focused) {
      return null;
    }

    const title = safeDocumentTitle(this.target.document?.title) ?? 'Desktop Window';
    const platform = safePlatformLabel(this.target);
    const project = inferProjectRootFromWindowTitle(title);
    this.sequence += 1;

    const event: ActivityEvent = {
      eventId: `${deviceId}-window-${nowMs}-${this.sequence}`,
      deviceId,
      resourceKind: project ? 'project' : 'app',
      resourceKey: project
        ? project.projectKey
        : `window://${platform}/${encodeURIComponent(normalizeWindowLabel(title))}`,
      resourceTitle: project ? project.projectName : title,
      startedAt: nowMs - this.sampleDurationMs,
      endedAt: nowMs,
      source: 'auto',
    };

    const validation = validateActivityEvent(event);
    if (!validation.valid) {
      console.warn('[capture] invalid desktop window capture event dropped');
      return null;
    }

    return event;
  }
}

class BrowserCaptureProvider implements CaptureProvider {
  readonly kind = 'browser' as const;

  private sequence = 0;

  private readonly target: BrowserCaptureTarget;

  private readonly sampleDurationMs: number;

  private readonly getBrowserBridgeSnapshot?: () => BrowserBridgeSnapshot | null;

  constructor(
    target: BrowserCaptureTarget,
    sampleDurationMs: number,
    getBrowserBridgeSnapshot?: () => BrowserBridgeSnapshot | null,
  ) {
    this.target = target;
    this.sampleDurationMs = sampleDurationMs;
    this.getBrowserBridgeSnapshot = getBrowserBridgeSnapshot;
  }

  private resolveBridgeSnapshot(): BrowserBridgeSnapshot | null {
    if (!this.getBrowserBridgeSnapshot) {
      return null;
    }

    return this.getBrowserBridgeSnapshot();
  }

  isAvailable(): boolean {
    const bridge = this.resolveBridgeSnapshot();
    if (bridge && bridge.active) {
      return true;
    }

    return normalizeBrowserHref(this.target.location?.href) !== null;
  }

  capture(deviceId: string, nowMs = Date.now()): ActivityEvent | null {
    const bridge = this.resolveBridgeSnapshot();
    const href =
      bridge && bridge.active
        ? normalizeBrowserHref(bridge.url)
        : normalizeBrowserHref(this.target.location?.href);
    if (!href) {
      return null;
    }

    this.sequence += 1;
    const title =
      bridge && bridge.active
        ? bridge.title
        : safeDocumentTitle(this.target.document?.title);

    const event: ActivityEvent = {
      eventId: `${deviceId}-browser-${nowMs}-${this.sequence}`,
      deviceId,
      resourceKind: 'web',
      resourceKey: href,
      resourceTitle: title,
      startedAt: nowMs - this.sampleDurationMs,
      endedAt: nowMs,
      source: 'auto',
    };

    const validation = validateActivityEvent(event);
    if (!validation.valid) {
      console.warn('[capture] invalid browser capture event dropped');
      return null;
    }

    return event;
  }
}

function createWindowProvider(options: CreateCaptureProviderOptions): CaptureProvider {
  const target = options.browserTarget ?? (typeof window !== 'undefined' ? window : null);
  if (!target) {
    return new MockCaptureProvider();
  }

  return new DesktopWindowCaptureProvider(target, normalizeDurationMs(options.sampleDurationMs));
}

function createBrowserProvider(options: CreateCaptureProviderOptions): CaptureProvider {
  const target = options.browserTarget ?? (typeof window !== 'undefined' ? window : null);
  if (!target) {
    return new MockCaptureProvider();
  }

  return new BrowserCaptureProvider(
    target,
    normalizeDurationMs(options.sampleDurationMs),
    options.getBrowserBridgeSnapshot,
  );
}

export function resolveCaptureProviderMode(raw: string | null | undefined): CaptureProviderMode {
  if (raw === 'window' || raw === 'browser' || raw === 'mock' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function createCaptureProvider(options: CreateCaptureProviderOptions = {}): CaptureProvider {
  const mode = options.mode ?? 'auto';
  const windowProvider = createWindowProvider(options);
  const browserProvider = createBrowserProvider(options);

  if (mode === 'mock') {
    return new MockCaptureProvider();
  }

  if (mode === 'window') {
    if (windowProvider.kind === 'window' && windowProvider.isAvailable()) {
      return windowProvider;
    }

    console.warn('[capture] window provider unavailable, falling back to mock provider');
    return new MockCaptureProvider();
  }

  if (mode === 'browser') {
    if (browserProvider.kind === 'browser' && browserProvider.isAvailable()) {
      return browserProvider;
    }

    console.warn('[capture] browser provider unavailable, falling back to mock provider');
    return new MockCaptureProvider();
  }

  if (windowProvider.kind === 'window' && windowProvider.isAvailable()) {
    return windowProvider;
  }

  if (browserProvider.kind === 'browser' && browserProvider.isAvailable()) {
    return browserProvider;
  }

  return new MockCaptureProvider();
}
