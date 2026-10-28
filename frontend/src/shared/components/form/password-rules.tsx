import { Check, Circle } from "lucide-react";

import { PASSWORD_RULES } from "@/shared/lib/password-policy";
import { cn } from "@/shared/lib/utils";

/**
 * Các luật mật khẩu dưới ô mật khẩu MỚI, tích xanh dần khi gõ (QLTB-508) — người đặt mật khẩu biết ngay còn
 * thiếu gì, không phải bấm lưu rồi đọc câu từ chối.
 */
export function PasswordRules({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn("grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2", className)}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(value);
        return (
          <li key={rule.key} className={cn("flex items-center gap-1.5", ok ? "text-success-text" : "text-muted-foreground")}>
            {ok ? <Check className="size-3.5 shrink-0" /> : <Circle className="size-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
