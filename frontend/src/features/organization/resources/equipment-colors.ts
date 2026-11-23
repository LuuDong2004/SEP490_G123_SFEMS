import type { CSSProperties } from "react";

/**
 * Bảng sắc của màn Thiết bị: màu chủ đạo (xanh) chỉ dành cho điều hướng và nút chính; DỮ LIỆU dùng sắc riêng để mắt
 * phân biệt nhanh mà không rối. Mỗi môn học / loại thiết bị gắn cố định một sắc (băm theo tên) — cùng môn thì cùng màu ở
 * cột trái và trong bảng. Mười sắc trầm, đều độ sáng, không sắc nào chói hơn sắc nào.
 */
const HUES = [250, 165, 60, 300, 15, 200, 135, 35, 275, 340];

export function hueOf(name: string | null | undefined): number {
  if (!name) return 250;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return HUES[h % HUES.length];
}

/** Màu đậm của một sắc — biểu tượng, chấm. Đủ sáng để đọc trên nền tối, đủ đậm trên nền sáng. */
export const hueColor = (h: number) => `oklch(0.62 0.13 ${h})`;

/**
 * Viên nhãn nhạt theo sắc (môn học trong bảng): nền pha 14% màu, chữ pha màu với màu chữ chính — tự đúng ở cả chế độ
 * sáng lẫn tối, không cần hai bộ mã màu.
 */
export const hueChip = (h: number): CSSProperties => ({
  background: `color-mix(in oklch, ${hueColor(h)} 14%, transparent)`,
  color: `color-mix(in oklch, ${hueColor(h)} 70%, var(--foreground))`,
});

/**
 * Màu của từng cột số lượng: mỗi trạng thái MỘT sắc mang nghĩa — dùng được xanh lá, đang dùng xanh dương, trong kho
 * xanh ngọc, đang mượn tím, hỏng cam, mất đỏ.
 */
const TEAL = "text-[color:color-mix(in_oklch,var(--chart-4)_75%,var(--foreground))]";
const VIOLET = "text-[color:color-mix(in_oklch,var(--chart-3)_75%,var(--foreground))]";

/** `text`: màu số trong ô; `head`: màu chữ tiêu đề cột. */
export const QTY_TONE: Record<string, { text: string; head: string }> = {
  total: { text: "text-foreground font-semibold", head: "text-foreground" },
  usable: { text: "text-success-text font-semibold", head: "text-success-text" },
  in_use: { text: "text-info-text font-medium", head: "text-info-text" },
  in_stock: { text: `${TEAL} font-medium`, head: `${TEAL}` },
  borrowed: { text: `${VIOLET} font-medium`, head: `${VIOLET}` },
  broken: { text: "text-warning-text font-medium", head: "text-warning-text" },
  missing: { text: "text-destructive-text font-medium", head: "text-destructive-text" },
};
