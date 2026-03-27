export type ResourceKind = 'web' | 'document' | 'project' | 'app' | 'manual';

export type EventSource = 'auto' | 'manual';

export interface ActivityEvent {
  eventId: string;
  deviceId: string;
  resourceKind: ResourceKind;
  resourceKey: string;
  resourceTitle?: string;
  startedAt: number;
  endedAt: number;
  source: EventSource;
}

export interface Annotation {
  primaryCategory?: string;
  tags: string[];
  note?: string;
  updatedAt: number;
  updatedByDeviceId: string;
}

export interface AnnotatedActivityEvent extends ActivityEvent {
  annotation?: Annotation;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface SyncSettings {
  enabled: boolean;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  syncIntervalMinutes: 1 | 5 | 15 | 30 | 60;
}
