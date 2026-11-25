/**
 * Nhãn ô viết thường để ghép giữa câu ("Chọn loại CSVC", "Nhập mã Bộ") — giữ nguyên từ viết tắt toàn chữ hoa
 * (CSVC, GV, HS) thay vì `toLowerCase()` cả nhãn thành "csvc" (M2-12, 13/11/2026).
 */
export function lowerLabel(label: string): string {
  return label
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toLocaleUpperCase("vi") && w !== w.toLocaleLowerCase("vi") ? w : w.toLocaleLowerCase("vi")))
    .join(" ");
}
