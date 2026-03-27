import type { Annotation } from './types.js';

export function resolveLww(
  current: Annotation | undefined,
  incoming: Annotation,
): Annotation {
  if (!current) {
    return incoming;
  }

  if (incoming.updatedAt > current.updatedAt) {
    return incoming;
  }

  if (incoming.updatedAt < current.updatedAt) {
    return current;
  }

  return incoming.updatedByDeviceId.localeCompare(current.updatedByDeviceId) >= 0
    ? incoming
    : current;
}

export function mergeAnnotations(
  current: ReadonlyMap<string, Annotation>,
  incoming: ReadonlyMap<string, Annotation>,
): Map<string, Annotation> {
  const merged = new Map(current);

  for (const [eventId, next] of incoming.entries()) {
    const selected = resolveLww(merged.get(eventId), next);
    merged.set(eventId, selected);
  }

  return merged;
}
