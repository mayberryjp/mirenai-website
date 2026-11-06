const DAY_MS = 24 * 60 * 60 * 1000;

// Offset-free timestamps use the same local wall-clock frame as now.
export function isNewDomain(firstSeen: string): boolean {
  const date = new Date(firstSeen);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() < DAY_MS;
}
