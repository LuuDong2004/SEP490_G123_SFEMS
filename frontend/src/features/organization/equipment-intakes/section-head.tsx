import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";

/**
 * Tiêu đề một khối của form phiếu ghi tăng, bấm để thu gọn / mở ra (trưởng nhóm 13/11/2026: "ẩn đi cho gọn các
 * khối"). Thu gọn thì khối chỉ còn một dòng: tên khối và `summary` — điều đã khai, để không phải mở ra mới biết.
 * `actions` đứng bên phải cùng hàng (ô tìm thiết bị, nút xem tệp…) và ẩn theo khối.
 */
export function SectionHead({ title, open, onToggle, summary, aside, hint, actions }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Một dòng tóm tắt hiện khi khối thu gọn. */
  summary?: ReactNode;
  /** Chữ mờ ngay cạnh tên, hiện cả khi mở. */
  aside?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
      <h3 className="flex min-w-0 items-center gap-2 text-base leading-6 font-semibold">
        <button type="button" onClick={onToggle} aria-expanded={open}
          title={open ? "Thu gọn khối này" : "Mở khối này"}
          className="hover:bg-muted -ms-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start">
          <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="text-primary truncate">{title}</span>
        </button>
        {hint && open ? <HelpHint>{hint}</HelpHint> : null}
      </h3>
      {open ? (aside ? <span className="text-muted-foreground text-sm">{aside}</span> : null) : (
        <button type="button" onClick={onToggle} className="text-muted-foreground min-w-0 flex-1 truncate text-start text-sm">
          {summary}
        </button>
      )}
      {open && actions ? <div className="ms-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
