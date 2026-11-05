const VND = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** "1.500.000 đ"; trống thì "—". */
export function formatVnd(value: number | null | undefined): string {
  return value == null ? "—" : `${VND.format(value)} đ`;
}
