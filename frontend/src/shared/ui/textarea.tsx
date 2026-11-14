import * as React from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Ô nhiều dòng tự cao theo nội dung (`field-sizing-content`) nhưng có TRẦN `max-h-40` (~6 dòng), quá thì cuộn trong ô —
 * không có trần thì một ghi chú 500 ký tự kéo cả hàng form cao vống, để trống một khoảng lớn bên cạnh (13/11/2026).
 * Chỗ cần ô cao hơn thì truyền `className` (tailwind-merge ghi đè `max-h`).
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-field focus-visible:bg-card flex field-sizing-content min-h-16 max-h-40 overflow-y-auto w-full rounded-md border px-3 py-2 text-base shadow-e1 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
