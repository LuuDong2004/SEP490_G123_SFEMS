"use client";

import { useState } from "react";
import { useTranslate } from "@refinedev/core";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

type InputPasswordProps = React.ComponentProps<"input">;

/**
 * Ô mật khẩu có nút hiện / ẩn. Khoảng trắng bị bỏ ngay khi gõ hoặc dán (QLTB-508) — máy chủ cũng bỏ, nên
 * người dùng thấy đúng chuỗi sẽ được dùng.
 */
export const InputPassword = ({ className, onChange, ...props }: InputPasswordProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslate();

  return (
    <div className={cn("relative")}>
      <Input
        type={showPassword ? "text" : "password"}
        className={cn(className)}
        {...props}
        onChange={(e) => {
          if (/\s/.test(e.target.value)) e.target.value = e.target.value.replace(/\s+/g, "");
          onChange?.(e);
        }}
      />
      <button
        type="button"
        aria-label={showPassword ? t("form.hidePassword", "Hide password") : t("form.showPassword", "Show password")}
        className={cn(
          "appearance-none rounded-sm",
          "absolute right-2 top-1/2 -translate-y-1/2",
          "text-muted-foreground transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

InputPassword.displayName = "InputPassword";
