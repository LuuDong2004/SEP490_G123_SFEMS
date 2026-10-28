import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Màu của chấm biểu tượng — theo họ màu trạng thái của giao diện (`*-subtle` / `*-text`). */
const TONES = {
  info: "bg-info-subtle text-info-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  destructive: "bg-destructive-subtle text-destructive-text",
  neutral: "bg-neutral-subtle text-neutral-text",
} as const;
export type TimelineTone = keyof typeof TONES;

/**
 * Dòng thời gian dùng chung — quá trình duyệt của phiếu, lịch sử của tài sản. Mỗi mục là hai cột: chấm
 * biểu tượng trên một đường nối dọc, và nội dung. Đường nối là một phần tử trong cột trái chứ không
 * phải viền của cả danh sách, nên chấm luôn nằm đúng trên đường và không đè lên chữ dù hộp chứa đệm
 * bao nhiêu.
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("flex flex-col", className)}>{children}</ol>;
}

/**
 * Một mục: hàng đầu là VIỆC đã xảy ra (đậm) và thời điểm (sát mép phải, cùng một cột ở mọi mục để mắt
 * lướt dọc được); dưới là ai làm, rồi phần riêng của mục (lời nhắn, giá trị đổi).
 */
export function TimelineItem({ icon, tone = "neutral", title, time, by, children }: {
  icon: ReactNode;
  tone?: TimelineTone;
  title: ReactNode;
  time?: ReactNode;
  /** Người làm — dòng thứ hai, nhạt hơn tiêu đề. */
  by?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="group/item grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", TONES[tone])}>{icon}</span>
        <span className="bg-border my-1 w-px flex-1 group-last/item:hidden" />
      </div>
      <div className="min-w-0 pb-5 group-last/item:pb-0">
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-0.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">{title}</div>
          {time ? <time className="text-muted-foreground shrink-0 text-xs tabular-nums">{time}</time> : null}
        </div>
        {by ? <p className="text-muted-foreground text-sm">{by}</p> : null}
        {children}
      </div>
    </li>
  );
}
