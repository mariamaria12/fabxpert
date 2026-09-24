const weldLengthFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

/** Table display, e.g. "850 m". */
export function formatProjectWeldLength(meters: number): string {
  return `${weldLengthFormat.format(meters)} m`;
}
