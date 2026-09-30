export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareCanonicalValues(a: unknown, b: unknown): number {
  return compareStrings(JSON.stringify(a), JSON.stringify(b));
}
