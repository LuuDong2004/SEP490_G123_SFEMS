import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Switch } from "@/shared/ui/switch";

/**
 * Một cờ bật / tắt trong form, kiểu cài đặt của iOS: tên và một câu mô tả ngắn bên trái, nút gạt bên phải, bấm vào cả
 * dòng là đổi. Đang bật thì dòng có viền và nền màu chính nhạt — nhìn là biết. Thay cho kiểu cũ (một ô nhập chứa nút gạt
 * + chữ, nhãn nằm trên).
 */
export function SwitchRow({ checked, onCheckedChange, title, description, className, disabled }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 select-none",
        "transition-[background-color,border-color,scale] duration-200 active:scale-[0.99]",
        checked ? "border-primary/40 bg-primary/[0.06]" : "bg-card hover:border-primary/30",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        {description ? <span className="text-muted-foreground block text-xs leading-snug">{description}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}
