import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Một nhóm ô nhập có tiêu đề. Trên màn rộng tiêu đề nằm cột trái, ô nhập cột
 * phải — mắt quét dọc theo tiêu đề để tìm nhóm, không phải đọc từng nhãn.
 */
export function FormSection({
  title,
  children,
  className,
  compact,
}: PropsWithChildren<{
  title: string;
  className?: string;
  /** Kiểu gọn cho hộp thoại: tiêu đề nằm TRÊN ô nhập, không chiếm một cột bên trái. */
  compact?: boolean;
}>) {
  if (compact) {
    return (
      <section className={cn("space-y-3 border-b border-border pb-5 last:border-b-0 last:pb-0", className)}>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
        <div className="space-y-4">{children}</div>
      </section>
    );
  }
  return (
    <section
      className={cn(
        "grid gap-x-10 gap-y-4 border-b border-border pb-8 last:border-b-0 last:pb-0",
        "md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]",
        className,
      )}
    >
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </header>
      {/* Card trải full màn, nhưng ô nhập thì không: một ô Tên dài 1.300px khó
          đọc và trông trống. Giới hạn cột ô nhập ở ~960px. */}
      <div className="max-w-5xl space-y-5">{children}</div>
    </section>
  );
}
