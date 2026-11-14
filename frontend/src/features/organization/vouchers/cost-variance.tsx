import { TrendingDown, TrendingUp, Equal } from "lucide-react";

import { cn } from "@/shared/lib/utils";

const money = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/**
 * Chênh lệch chi phí thực tế so với chi phí dự kiến đã duyệt. Lãnh đạo duyệt con số dự kiến, nên phần VƯỢT là
 * phần không ai duyệt — đỏ; thấp hơn là xanh. Chữ là "vượt" / "thấp hơn", không phải "dư": với tiền, "dư" dễ
 * đọc thành "còn thừa", tức là ngược nghĩa.
 *
 * <p>Tính, không lưu: hai con số đã nằm trên phiếu. Thiếu một trong hai thì không vẽ gì.
 */
export function CostVariance({ estimated, actual, bare, className }: {
  estimated: number | null | undefined;
  actual: number | null | undefined;
  /** Bỏ chữ "Chênh lệch:" phía trước — khi nhãn đã nằm ở chỗ khác (ô thông tin của màn chi tiết). */
  bare?: boolean;
  className?: string;
}) {
  if (estimated == null || actual == null) {
    return null;
  }
  const diff = actual - estimated;
  const tone = diff > 0
    ? { label: "Vượt dự kiến", icon: <TrendingUp />, chip: "bg-destructive-subtle text-destructive-text" }
    : diff < 0
      ? { label: "Thấp hơn dự kiến", icon: <TrendingDown />, chip: "bg-success-subtle text-success-text" }
      : { label: "Đúng dự kiến", icon: <Equal />, chip: "bg-neutral-subtle text-neutral-text" };
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const share = estimated > 0 && diff !== 0 ? ` (${sign}${percent.format(Math.abs(diff) / estimated * 100)}%)` : "";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      {bare ? null : <span className="text-muted-foreground">Chênh lệch:</span>}
      <span className={cn("font-medium tabular-nums", diff > 0 && "text-destructive-text", diff < 0 && "text-success-text")}>
        {sign}{money.format(Math.abs(diff))} đ{share}
      </span>
      <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium [&_svg]:size-3.5", tone.chip)}>
        {tone.icon}
        {tone.label}
      </span>
    </div>
  );
}
