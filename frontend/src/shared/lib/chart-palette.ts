/**
 * Thứ tự màu cho biểu đồ phân loại (mỗi loạt một màu, gán theo thứ tự cố định, KHÔNG xoay vòng):
 * chart-1..5 theo đúng số — xanh dương, hổ phách, tím, xanh ngọc, hồng. Thứ tự này là thứ đã qua
 * sáu bước kiểm của `validate_palette` (skill dataviz) ở cả nền sáng lẫn nền tối; đổi thứ tự
 * hay đổi token trong theme.css thì chạy lại bộ kiểm.
 *
 * Tối đa 5 loạt. Nhiều hơn thì gộp phần đuôi vào "Khác", không sinh màu thứ sáu.
 */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Đầu sáng của dải gradient một loạt: chính màu đó pha sáng — cùng sắc, nên không lẫn loạt khác. */
export function seriesLight(color: string) {
  return `color-mix(in oklch, ${color} 62%, white)`;
}

/** Nền gradient ngang cho thanh HTML (thanh cơ cấu, thanh danh sách). */
export function seriesGradient(color: string, angle = 90) {
  return `linear-gradient(${angle}deg, ${color}, ${seriesLight(color)})`;
}

/** Màu thứ i cho một loạt; quá 5 là lỗi của người gọi — gộp "Khác" trước. */
export function seriesColor(i: number) {
  return SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)];
}

/** Số đếm (thiết bị, trường, phiếu) viết liền, không dấu chấm nghìn: "5.609" dễ đọc nhầm thành số thập phân. */
export const count = new Intl.NumberFormat("vi-VN", { useGrouping: false });
export const compactMoney = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

const oneDecimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, useGrouping: false });

/**
 * Số tiền rút gọn bằng CHỮ: "6,4 tỷ đ", "850 triệu đ". `compactMoney` ra "6,4 T", mà chữ "T" người đọc
 * không biết là tỷ hay nghìn tỷ — trên một ô chỉ số về tiền, đó là con số sai.
 */
export function shortMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${oneDecimal.format(value / 1e9)} tỷ đ`;
  if (abs >= 1e6) return `${oneDecimal.format(value / 1e6)} triệu đ`;
  return `${count.format(value)} đ`;
}
