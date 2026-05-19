type Normalizer = (value: unknown) => unknown;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function normalizeDateValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return "__undefined__";
  if (value === null) return null;

  if (value instanceof Date) {
    return normalizeDateValue(value);
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return normalizeDateValue(parsedDate);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function areEquivalent(
  incomingValue: unknown,
  currentValue: unknown,
  normalizer?: Normalizer,
) {
  const normalize = normalizer ?? normalizeValue;
  return JSON.stringify(normalize(incomingValue)) === JSON.stringify(normalize(currentValue));
}

export function getChangedFields<T extends Record<string, unknown>>(
  incoming: Partial<T>,
  current: Partial<T>,
  normalizers: Partial<Record<keyof T, Normalizer>> = {},
) {
  const changed: Partial<T> = {};

  for (const key of Object.keys(incoming) as Array<keyof T>) {
    if (!(key in incoming)) continue;

    const incomingValue = incoming[key];
    const currentValue = current[key];
    const normalizer = normalizers[key];

    if (!areEquivalent(incomingValue, currentValue, normalizer)) {
      changed[key] = incomingValue;
    }
  }

  return changed;
}
