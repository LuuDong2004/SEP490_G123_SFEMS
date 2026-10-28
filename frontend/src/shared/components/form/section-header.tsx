import type { ReactNode } from "react";

/**
 * Tiêu đề một thẻ của form / màn phiếu: biểu tượng, tên, một dòng giải thích; thao tác của thẻ
 * (nếu có) đứng bên phải. Cùng một hình ở mọi loại phiếu để người đã quen một màn đọc được màn khác.
 */
export function SectionHeader({ icon, title, hint, right }: { icon: ReactNode; title: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-semibold">{title}</h3>
          {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
        </div>
      </div>
      {right}
    </div>
  );
}
