import { PackagePlus, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";

/**
 * Lối thêm dòng của MỌI bảng dòng trên form phiếu — một kiểu cho cả ứng dụng:
 *  - bảng còn trống: `AddLinesEmpty`, ô viền đứt giữa thẻ (biểu tượng, chữ, một dòng gợi ý), bấm cả ô là thêm;
 *  - đã có dòng: `AddLinesButton` ở góc thẻ, nút viền cỡ thường có dấu +.
 * Không dùng nút nhỏ đổi màu theo trạng thái hay dòng chữ "Bấm … để chọn".
 */
export function AddLinesButton({ label, onClick, disabled, title }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button type="button" variant="outline" disabled={disabled} title={title} onClick={onClick}>
      <Plus />
      {label}
    </Button>
  );
}

export function AddLinesEmpty({ label, hint, onClick, disabled, disabledLabel, icon }: {
  label: string;
  /** Một dòng gợi ý dưới chữ chính, vd. "Chọn từ danh sách tài sản của trường". */
  hint?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Chữ khi chưa bấm được, vd. "Chọn trường trước". */
  disabledLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="border-t p-4">
      <button type="button" disabled={disabled || !onClick} onClick={onClick}
        className="hover:border-primary/50 hover:bg-primary/5 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors disabled:pointer-events-none disabled:opacity-60">
        <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full [&_svg]:size-5">
          {icon ?? <PackagePlus />}
        </span>
        <span className="text-sm font-medium">{disabled && disabledLabel ? disabledLabel : label}</span>
        {hint && !(disabled && disabledLabel) ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </button>
    </div>
  );
}
