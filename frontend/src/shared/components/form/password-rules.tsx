import { Check } from "lucide-react";

import { PASSWORD_RULES } from "@/shared/lib/password-policy";
import { cn } from "@/shared/lib/utils";

/**
 * Luật mật khẩu dưới ô mật khẩu MỚI: một hàng viên chữ ngắn, viên nào đạt thì xanh kèm dấu tích — người đặt
 * mật khẩu thấy ngay còn thiếu gì, không phải bấm lưu rồi đọc câu từ chối. Gọn như một dòng ghi chú, không khung
 * riêng (theo trưởng nhóm); rê chuột lên viên thấy câu đầy đủ.
 */
export function PasswordRules({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Yêu cầu mật khẩu">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(value);
        return (
          <li key={rule.key} title={rule.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors duration-200",
              ok ? "bg-success-subtle text-success-text border-transparent" : "text-muted-foreground bg-muted/40",
            )}>
            {ok ? <Check className="size-3 shrink-0" /> : null}
            {rule.short}
          </li>
        );
      })}
    </ul>
  );
}
