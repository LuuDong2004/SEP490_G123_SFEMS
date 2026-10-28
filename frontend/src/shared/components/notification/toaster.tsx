"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/shared/components/theme/theme-provider";

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Góc trên phải, ngay dưới thanh header; các toast xếp chồng lên nhau
      // như một chồng thẻ, di chuột vào mới xoè ra.
      position="top-right"
      offset={{ top: 80, right: 24 }}
      mobileOffset={{ top: 64 }}
      gap={10}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-popover !px-4 !py-3.5 !shadow-lg !shadow-black/5 !text-sm",
          title: "!font-medium !leading-snug",
          description: "!text-muted-foreground !text-xs",
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
