import * as React from "react";

import { isSearchField, SEARCH_MAX } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";

function Input({ className, type, maxLength, ...props }: React.ComponentProps<"input">) {
  // Ô tìm không truyền `maxLength` thì nhận mặc định `SEARCH_MAX` (xem `isSearchField`).
  const max = maxLength ?? (isSearchField({ type, ...props }) ? SEARCH_MAX : undefined);
  return (
    <input
      type={type}
      maxLength={max}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-field focus-visible:bg-card flex h-9 w-full min-w-0 rounded-full border px-3.5 py-1 text-base shadow-e1 transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
