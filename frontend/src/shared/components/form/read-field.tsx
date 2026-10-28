import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Một ô CHỈ XEM vẽ đúng như ô nhập của form: nhãn trên, giá trị trong khung cùng cỡ — hộp thoại xem
 * và hộp thoại sửa cùng một dáng, bấm Sửa thì ô nằm nguyên chỗ, chỉ đổi từ chữ sang ô nhập.
 */
export function ReadField({ label, children, className }: { label: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      {/* Cùng chiều cao dòng với `FormLabel` (leading-none): ô chỉ xem đứng cạnh ô nhập trong một hàng thì hai khung thẳng nhau. */}
      <span className="flex items-center gap-2 text-sm leading-none font-medium">{label}</span>
      <div className="bg-surface-subtle flex min-h-9 items-center rounded-md border px-3 py-1 text-sm break-words">
        {children ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
