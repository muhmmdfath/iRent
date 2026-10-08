import { formatWibDateTime } from '../time/wib';

/** Money remains a decimal string. Business timestamps never leak an implicit Z. */
export function toApiValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return formatWibDateTime(value);
  if (Array.isArray(value)) return value.map(toApiValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, toApiValue(child)]),
    );
  }
  return value;
}
