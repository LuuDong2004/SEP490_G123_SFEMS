import { useCan } from "@refinedev/core";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";

/**
 * Lối sang MÀN KHÁC để làm một việc mà màn này chỉ nhắc tới — ô "Chưa khai" của hồ sơ cán bộ, "Chưa xếp
 * phòng" của một tài sản, câu "khai ở màn Cán bộ". Ba luật, đi cùng nhau:
 *
 * - Chỉ dùng cho chỗ CÓ VIỆC phải làm ở màn kia; chữ chỉ để đọc thì để nguyên.
 * - Đang trong form / hộp thoại thì `newTab`: rời màn là mất thứ đang gõ dở.
 * - Chỉ là lối đi với người LÀM ĐƯỢC việc đó (`resource` + `action`); người khác thấy đúng chữ ấy,
 *   không thấy một lối dẫn tới trang từ chối.
 */
export function CrossLink({ to, resource, action = "edit", newTab, plain, className, title, children }: {
  to: string;
  /** Tài nguyên và hành động người xem phải có quyền thì chữ mới thành lối đi. */
  resource: string;
  action?: "edit" | "create" | "list";
  newTab?: boolean;
  /** Không vẽ biểu tượng mở ra ngoài — cho ô bảng hẹp, nơi chữ màu liên kết đã đủ nói đây là lối đi. */
  plain?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const can = useCan({ resource, action }).data?.can ?? false;
  if (!can) return <span className={className}>{children}</span>;
  return (
    <Link
      to={to}
      title={title ?? (newTab ? "Mở ở tab mới" : undefined)}
      {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      // Nằm trong một dòng bấm được (dòng bảng, dòng của hộp chọn): bấm lối này không phải là bấm dòng.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn("inline-flex items-center gap-1 underline-offset-2 hover:underline", className)}
    >
      {children}
      {plain ? null : <ExternalLink className="size-3 shrink-0" />}
    </Link>
  );
}
