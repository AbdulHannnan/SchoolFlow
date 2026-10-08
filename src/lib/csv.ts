/**
 * Minimal RFC 4180 CSV builder. Quotes any field containing a comma, quote, or
 * newline and doubles embedded quotes. Isomorphic (no imports).
 */
function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) => row.map((cell) => escapeField(cell == null ? "" : String(cell))).join(","))
    .join("\r\n");
}
