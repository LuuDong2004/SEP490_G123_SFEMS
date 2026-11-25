import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // Nền phía sau tối nhẹ và mờ đi (kiểu iOS) thay vì một lớp đen đặc.
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px] duration-300",
        className
      )}
      {...props}
    />
  );
}

/**
 * Cỡ hộp thoại, không đổi theo lượng dữ liệu: ít thì còn chỗ trống, nhiều thì cuộn bên trong, hàng nút luôn ở đáy (`.dialog-fixed`
 * trong `styles/index.css`). `sm` cho hộp chỉ có vài ô (rộng cố định, cao vừa nội dung vì số ô đổi theo vai: cao cố định sẽ dư khoảng trống), `form` cho form và hộp xem (`formFit`: cùng bề rộng, cao vừa nội dung — form nhiều ô cần thấy hết không cuộn), `picker` cho hộp chọn (tìm rồi bấm một dòng), `wide` cho phiếu và hộp xem nhiều cột; `auto` chỉ cho hộp hỏi nhanh và
 * công cụ có khung riêng (quét mã, cắt ảnh, xem tệp).
 */
const DIALOG_SIZES = {
  sm: "dialog-fixed max-h-[92dvh] sm:max-w-lg",
  form: "dialog-fixed h-[min(40rem,92dvh)] sm:max-w-3xl",
  // Bề rộng như `form`, cao vừa nội dung: form nhiều ô (phòng) xếp đủ trên một màn, không cuộn, không dư khoảng trống.
  formFit: "dialog-fixed max-h-[92dvh] sm:max-w-3xl",
  // Form nhiều ô (phòng): rộng hơn để xếp 4 cột — đủ ô trên MỘT màn, không cuộn.
  formWide: "dialog-fixed max-h-[92dvh] sm:max-w-5xl",
  // Rộng như `formWide`, CAO CỐ ĐỊNH: hộp xem có tab (phòng) — chuyển tab hộp không co lại theo nội dung. Cao bằng
  // hộp Thêm / Sửa phòng (gần kín màn) để tab Thông tin thấy hết các ô, không cuộn.
  formWideFixed: "dialog-fixed h-[min(52rem,92dvh)] sm:max-w-5xl",
  picker: "dialog-fixed h-[min(35rem,92dvh)] sm:max-w-[min(56rem,calc(100vw-4rem))]",
  wide: "dialog-fixed h-[min(50rem,92dvh)] sm:max-w-[min(80rem,calc(100vw-4rem))]",
  // Rộng như `wide`, cao vừa nội dung: form hai cột (thêm / sửa trường) không dư khoảng trống dưới đáy.
  wideFit: "dialog-fixed max-h-[92dvh] sm:max-w-[min(80rem,calc(100vw-4rem))]",
  auto: "",
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "form",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  size?: keyof typeof DIALOG_SIZES;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Hộp bo góc lớn, bóng mềm sâu; mở ra phóng nhẹ + trồi lên + hơi nảy (đường cong vượt đà), đóng thì thu nhanh.
          "bg-background outline-none fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border p-6 sm:max-w-lg",
          "shadow-[0_24px_60px_-16px_rgb(0_0_0/.35),0_0_0_1px_rgb(0_0_0/.03)]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.94] data-[state=open]:slide-in-from-bottom-3 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(.2,.9,.3,1.15)]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-150",
          DIALOG_SIZES[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus-visible:ring-ring text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 rounded-full p-1.5 transition-[background-color,color,scale] active:scale-90 focus-visible:ring-2 focus-visible:ring-offset-2 outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Đóng</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
