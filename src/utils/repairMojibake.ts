const SUSPICIOUS_SEQUENCES = ['Ã', 'Â', 'â€', 'â€™', 'â€œ', 'â€', 'â€“', 'â€”', 'â€¦'];

const suspiciousScore = (value: string): number =>
  SUSPICIOUS_SEQUENCES.reduce((total, sequence) => {
    let count = 0;
    let fromIndex = 0;
    while (fromIndex >= 0) {
      const nextIndex = value.indexOf(sequence, fromIndex);
      if (nextIndex === -1) break;
      count += 1;
      fromIndex = nextIndex + sequence.length;
    }
    return total + count;
  }, 0);

export function maybeRepairMojibake(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return '';

  const originalScore = suspiciousScore(text);
  if (!originalScore) return text;

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    if (!repaired || repaired.includes('\uFFFD')) return text;

    const repairedScore = suspiciousScore(repaired);
    return repairedScore < originalScore ? repaired : text;
  } catch {
    return text;
  }
}

export function repairDeepStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return maybeRepairMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => repairDeepStrings(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        repairDeepStrings(nestedValue),
      ]),
    ) as T;
  }

  return value;
}
