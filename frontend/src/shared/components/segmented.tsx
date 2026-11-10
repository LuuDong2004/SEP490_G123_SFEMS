import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { useLiquid } from "@/shared/hooks/use-liquid";
import { TAB_ACTIVE, TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  /** Một câu nói mục này cho xem gì — hiện khi rê chuột. */
  hint?: ReactNode;
};

/**
 * Nút chọn một trong vài chế độ (Tất cả / Chưa kiểm / Khớp / Chênh lệch…). Nền của mục đang chọn là MỘT viên
 * trượt sang mục mới (`useLiquid`, cùng chuyển động với thanh tab phân hệ); bấm thì nút lún nhẹ.
 *
 * Nằm trong thanh công cụ cạnh ô tìm nên gọn hơn thanh tab điều hướng: `md` nút 30px, cả khung 36px bằng ô tìm;
 * `sm` 28px cho ô lọc nhỏ.
 */
export function Segmented<V extends string>({ options, value, onChange, label, size = "md", className }: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Tên của cả nhóm cho trình đọc màn hình, vd. "Lọc theo kết quả". */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  // Khối chứa nút hay bị dựng lại khi đổi chế độ: nhớ chỗ cũ theo màn + nhóm để viên nền vẫn trượt từ mục cũ sang.
  const { pathname } = useLocation();
  const [boxRef, indRef] = useLiquid<HTMLDivElement>(value, { selector: '[aria-selected="true"]', memory: `seg:${pathname}:${label}` });
  return (
    <div ref={boxRef} role="tablist" aria-label={label} className={cn(TAB_STRIP, "shrink-0 gap-0.5 p-0.5", className)}>
      <span ref={indRef} aria-hidden className="pill-on pointer-events-none absolute rounded-full opacity-0" />
      {options.map((o) => {
        const active = o.value === value;
        const button = (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) onChange(o.value);
            }}
            className={cn(
              TAB_ITEM,
              size === "md" ? "h-[30px] gap-1.5 px-3.5" : "h-7 gap-1.5 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
              active ? TAB_ACTIVE : TAB_IDLE,
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
        if (!o.hint) return button;
        return (
          <Tooltip key={o.value} delayDuration={300}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>{o.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
