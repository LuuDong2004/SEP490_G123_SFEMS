"use client";

import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/shared/components/theme/theme-provider";

/**
 * Toast của cả ứng dụng (mọi `toast.*` của sonner, kể cả thông báo của Refine đi qua đây).
 *
 * Một kiểu chung: thẻ rộng cố định ~22rem, biểu tượng trong ô tròn theo loại, tiêu đề đậm tối đa 2 dòng, dòng giải
 * thích nhỏ tối đa 3 dòng, nút X ở góc phải luôn có. Màu chỉ ở biểu tượng — chữ giữ màu thường, cả khối đỏ trông như máy
 * hỏng.
 */
export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();
  const icon = (cls: string, Icon: typeof Info, spin = false) => (
    <span className={`flex size-7 items-center justify-center rounded-full ${cls}`}>
      <Icon className={`size-4${spin ? " animate-spin" : ""}`} />
    </span>
  );

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Góc trên phải, ngay dưới thanh header; các toast xếp chồng, di chuột vào mới xoè ra.
      position="top-right"
      offset={{ top: 80, right: 24 }}
      mobileOffset={{ top: 64, left: 16, right: 16 }}
      gap={10}
      visibleToasts={4}
      closeButton
      icons={{
        success: icon("bg-success-subtle text-success-text", CircleCheck),
        error: icon("bg-destructive-subtle text-destructive-text", CircleAlert),
        warning: icon("bg-warning-subtle text-warning-text", TriangleAlert),
        info: icon("bg-info-subtle text-info-text", Info),
        loading: icon("bg-muted text-muted-foreground", Loader2, true),
        close: <X className="size-3.5" />,
      }}
      toastOptions={{
        classNames: {
          // Cùng kiểu với popover của hệ thống: viền mảnh đều, bóng shadow-e4, bo rounded-xl — không vạch màu.
          toast:
            "!w-[22rem] !max-w-[calc(100vw-2rem)] !items-start !gap-3 !rounded-xl !border !border-border/80" +
            " !bg-popover !py-3 !pl-3 !pr-11 !text-sm !text-popover-foreground !shadow-e4 !ring-1 !ring-black/[0.03]" +
            " dark:!ring-white/5",
          icon: "!m-0 !size-7 !shrink-0",
          content: "!min-w-0 !gap-0.5 !pt-0.5",
          title: "!line-clamp-2 !font-semibold !leading-snug !text-foreground",
          description: "!line-clamp-3 !text-[0.8125rem] !leading-relaxed !text-muted-foreground",
          actionButton:
            "!ml-auto !h-7 !shrink-0 !self-center !rounded-md !bg-primary !px-2.5 !text-xs !font-medium !text-primary-foreground",
          cancelButton: "!h-7 !rounded-md !px-2.5 !text-xs",
          // Nút X: góc trên phải trong thẻ (sonner mặc định treo ở góc trái ngoài viền).
          closeButton:
            "!left-auto !right-2.5 !top-2.5 !size-6 !transform-none !translate-none !border-0 !bg-transparent" +
            " !text-muted-foreground hover:!bg-muted hover:!text-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
