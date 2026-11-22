import type { ReactNode } from "react";
import { Link } from "react-router";

import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { Progress } from "@/shared/ui/progress";

export type Tone = "primary" | "good" | "warning" | "destructive";
export const TONE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  good: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  destructive: "bg-destructive-subtle text-destructive-text",
};


/**
 * Một con số đứng đầu trang: nhãn, số lớn, một dòng phụ, và (nếu có) một thanh tỷ lệ. Cả thẻ là lối
 * tới màn của con số đó — người ta nhìn thấy "54 hỏng" thì việc kế tiếp là mở danh sách 54 cái ấy.
 */
export function Kpi({ to, icon, label, value, hint, tone = "primary", meter, info }: {
  /** Màn của con số — có thì cả thẻ bấm được. */
  to?: string;
  /** Giải thích cách tính, hiện trong dấu "?" cạnh nhãn. */
  info?: ReactNode;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** `title`: rê chuột vào tỷ lệ để biết nó tính từ đâu. */
  /** Thanh tỷ lệ: `label` nói thanh đo cái gì (vd. "Đang sử dụng 255 / 643"), số % đứng bên phải. */
  meter?: { percent: number; label: string; title?: string };
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground flex items-center gap-1 text-sm">{label}{info ? <HelpHint>{info}</HelpHint> : null}</p>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[1.125rem]", TONE[tone])}>{icon}</span>
      </div>
      <p className="-mt-1 text-3xl leading-tight font-bold tracking-tight tabular-nums">{value}</p>
      {meter ? (
        <div className="mt-2 space-y-1.5" title={meter.title}>
          {/* Nhãn của thanh nằm NGAY TRÊN thanh (đo cái gì · bao nhiêu %), dòng phụ của thẻ tách riêng bên dưới —
              không để hai thông tin khác nhau chung một dòng hai đầu thanh. */}
          {meter.label ? (
            <p className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate tabular-nums">{meter.label}</span>
              <span className="text-foreground shrink-0 font-semibold tabular-nums">{meter.percent}%</span>
            </p>
          ) : null}
          <Progress value={meter.percent} className="h-1.5" />
          {hint ? <p className="text-muted-foreground truncate pt-0.5 text-xs">{hint}</p> : null}
        </div>
      ) : hint ? (
        <p className="text-muted-foreground mt-1 truncate text-xs">{hint}</p>
      ) : null}
    </>
  );
  const box = "bg-card group flex flex-col rounded-xl border p-4 shadow-e1";
  return to ? (
    <Link to={to} className={cn(box, "hover:border-primary/40 hover:shadow-e2 transition-[border-color,box-shadow]")}>{body}</Link>
  ) : (
    <div className={box}>{body}</div>
  );
}
