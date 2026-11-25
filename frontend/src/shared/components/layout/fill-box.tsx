import type { PropsWithChildren } from "react";

import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { cn } from "@/shared/lib/utils";

/**
 * Khung cao kín phần còn lại của cửa sổ cho màn tự vẽ bảng, ít hay nhiều dòng đều một cỡ (màn dùng `DataTable` thì bảng tự lo). Thẻ
 * bên trong đặt `min-h-0 flex-1`, vùng dòng đặt `min-h-0 flex-1 overflow-auto`. Màn hẹp cao theo nội dung.
 */
export function FillBox({ children, className }: PropsWithChildren<{ className?: string }>) {
  const { ref, height } = useFillHeight();
  return (
    <div ref={ref} style={{ height }} className={cn("flex min-h-0 flex-col print:!h-auto", className)}>
      {children}
    </div>
  );
}
