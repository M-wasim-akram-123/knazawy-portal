export function parentCreatesCycle(locationId: string, ancestorIds: readonly string[]): boolean {
  return ancestorIds.includes(locationId);
}
