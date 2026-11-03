import { cn } from "@/shared/lib/utils";

/**
 * Khung chờ: khối nền nhạt có một vệt sáng lướt qua từ trái sang phải (kiểu iOS / Facebook) thay cho nhấp nháy mờ
 * — người dùng thấy "đang chạy" chứ không thấy "đứng hình".
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-foreground/[0.07] relative overflow-hidden rounded-md",
        "after:animate-shimmer after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--card)_75%,transparent)] after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
