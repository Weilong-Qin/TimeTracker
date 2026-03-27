import type { ActivityEvent, Annotation } from './types.js';

export type RuleMatcherType = 'resource-key-prefix' | 'resource-key-exact' | 'title-contains';

export interface ClassificationRule {
  id: string;
  matcherType: RuleMatcherType;
  matcherValue: string;
  primaryCategory: string;
  tags: string[];
}

export interface RuleApplicationResult {
  affectedEventIds: string[];
  updatedAnnotations: Map<string, Annotation>;
}

function isRuleMatch(rule: ClassificationRule, event: ActivityEvent): boolean {
  if (rule.matcherType === 'resource-key-prefix') {
    return event.resourceKey.startsWith(rule.matcherValue);
  }

  if (rule.matcherType === 'resource-key-exact') {
    return event.resourceKey === rule.matcherValue;
  }

  const title = event.resourceTitle ?? '';
  return title.toLowerCase().includes(rule.matcherValue.toLowerCase());
}

export function applyClassificationRule(
  rule: ClassificationRule,
  events: ActivityEvent[],
  existingAnnotations: ReadonlyMap<string, Annotation>,
  nowMs: number,
  deviceId: string,
): RuleApplicationResult {
  const updated = new Map(existingAnnotations);
  const affectedEventIds: string[] = [];

  for (const event of events) {
    if (!isRuleMatch(rule, event)) {
      continue;
    }

    const existing = updated.get(event.eventId);
    const mergedTags = new Set<string>([...(existing?.tags ?? []), ...rule.tags]);

    updated.set(event.eventId, {
      primaryCategory: rule.primaryCategory,
      tags: [...mergedTags],
      note: existing?.note,
      updatedAt: nowMs,
      updatedByDeviceId: deviceId,
    });

    affectedEventIds.push(event.eventId);
  }

  return {
    affectedEventIds,
    updatedAnnotations: updated,
  };
}
