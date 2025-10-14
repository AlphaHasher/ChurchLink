/**
 * Normalize a date-only string (YYYY-MM-DD) or a Date into a Date at local midnight.
 * Returns undefined for invalid inputs.
 */

export function normalizeDateOnly(value: string | Date | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const str = String(value);
  const datePortion = str.length > 10 ? str.slice(0, 10) : str;
  const parts = datePortion.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}
