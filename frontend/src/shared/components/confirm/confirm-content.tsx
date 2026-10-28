import type { ReactNode } from "react";
import { CircleHelp, Loader2, Trash2, TriangleAlert } from "lucide-react";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export type ConfirmTone = "danger" | "warning" | "neutral";

const TONE: Record<ConfirmTone, { chip: string; icon: ReactNode }> = {
  danger: { chip: "bg-destructive-subtle text-destructive-text", icon: <Trash2 /> },
  warning: { chip: "bg-warning-subtle text-warning-text", icon: <TriangleAlert /> },
  neutral: { chip: "bg-info-subtle text-info-text", icon: <CircleHelp /> },
};

/**
 * Thân của MỌI hộp hỏi lại trong ứng dụng — xoá, bỏ thay đổi chưa lưu, trình / duyệt / huỷ phiếu —
 * để chúng đọc như một hệ: biểu tượng tròn bên trái theo mức độ, câu hỏi nêu đúng VIỆC và đúng THỨ
 * đang bị hỏi ("Xoá phòng P101?", không "Bạn chắc chắn?"), một câu hệ quả, rồi hai nút dồn phải. Nút
 * xác nhận lặp lại động từ của câu hỏi; nút kia nói điều xảy ra khi không làm ("Không xoá", "Tiếp tục
 * nhập") thay cho "Huỷ" — chữ "Huỷ" cạnh "Huỷ phiếu" là hai nghĩa trái nhau.
 *
 * Đặt bên trong một `<AlertDialog>`; ai mở / đóng là việc của nơi gọi.
 */
export function ConfirmContent({
  tone = "neutral",
  icon,
  title,
  description,
  children,
  cancelLabel,
  confirmLabel,
  destructive,
  onConfirm,
  busy,
  confirmDisabled,
  keepOpen,
}: {
  tone?: ConfirmTone;
  /** Thay biểu tượng mặc định của mức độ. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Ô nhập thêm (lời nhắn, phiên bản…) — nằm giữa phần chữ và hàng nút. */
  children?: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  /** Nút xác nhận màu đỏ dù hộp không phải mức "danger" — việc làm MẤT thứ gì đó (bỏ dữ liệu đang nhập). */
  destructive?: boolean;
  onConfirm: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Việc xác nhận là bất đồng bộ: giữ hộp mở tới khi nơi gọi tự đóng. */
  keepOpen?: boolean;
}) {
  return (
    <AlertDialogContent className="sm:max-w-md">
      <AlertDialogHeader className="flex-row items-start gap-4 space-y-0 text-left sm:text-left">
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", TONE[tone].chip)}>
          {icon ?? TONE[tone].icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <AlertDialogTitle className="leading-snug">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          ) : null}
        </div>
      </AlertDialogHeader>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          disabled={busy || confirmDisabled}
          className={tone === "danger" || destructive ? cn(buttonVariants({ variant: "destructive" })) : undefined}
          onClick={(e) => {
            if (keepOpen) e.preventDefault();
            onConfirm();
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
