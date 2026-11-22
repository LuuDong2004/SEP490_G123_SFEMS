import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

/**
 * Loại phiếu bị khoá khi trường đang kiểm kê — cùng danh sách với `InventoryFreeze.TOUCHES` ở máy chủ.
 * Máy chủ là nơi chặn; dải này chỉ nói TRƯỚC để người lập khỏi lập xong cả phiếu rồi mới biết (E2E-02).
 */
const FROZEN_RESOURCES = new Set(["equipment_intakes"]);

type ActiveInventory = {
  id: number;
  code: string | null;
  title: string;
  status: "DRAFT" | "PENDING" | "APPROVED";
  roomName: string | null;
  canOpen: boolean;
  /** Kiểm kê toàn một cơ sở (tài khoản một cơ sở lập, không chọn phòng). */
  campusName?: string | null;
};

/** Dải cảnh báo khi trường có phiếu kiểm kê chưa duyệt xong (nháp hoặc chờ duyệt). Chỉ tài khoản của trường. */
export function InventoryFreezeNotice({ resource, className }: { resource: string | undefined; className?: string }) {
  const { perspective } = usePerspective();
  const enabled = perspective === "school" && !!resource && FROZEN_RESOURCES.has(resource);
  const { data } = useQuery({
    queryKey: ["inventory_sessions", "active"],
    queryFn: ({ signal }) => kyInstance.get("inventory_sessions/active", { signal }).json<ActiveInventory[]>(),
    enabled,
    staleTime: 0,
  });
  if (!enabled) return null;
  if (!data?.length) return null;
  const s = data.find((item) => item.roomName == null && !item.campusName) ?? data.find((item) => item.roomName == null) ?? data[0];
  // Tên phòng thường đã có chữ "Phòng" ("Phòng thí nghiệm") — không ghi thành "phòng Phòng thí nghiệm".
  const scope = s.roomName
    ? /^phòng\s/i.test(s.roomName) ? s.roomName : `phòng ${s.roomName}`
    : s.campusName ? `cơ sở ${s.campusName}` : "cả trường";
  const what = s.code ?? `phiếu nháp “${s.title}”`;
  // Một dòng ngắn nói chuyện gì + trạng thái; dòng nhỏ nói hệ quả; nút mở phiếu tách riêng bên phải — không để cả
  // đoạn văn màu cam dài hết bề ngang.
  return (
    <div role="status" className={cn("bg-card shadow-e1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5", className)}>
      <span className="bg-warning-subtle text-warning-text grid size-8 shrink-0 place-items-center rounded-md" aria-hidden>
        <ClipboardList className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          Đang kiểm kê {scope}
          <Badge variant="warning" size="sm" dot>{s.status === "DRAFT" ? "Nháp" : "Chờ duyệt"}</Badge>
        </p>
        <p className="text-muted-foreground text-xs">
          Phiếu tác động đến {scope} sẽ chưa trình / duyệt được cho tới khi{" "}
          <span className="text-foreground font-medium tabular-nums">{what}</span> hoàn tất hoặc được hủy.
          {data.length > 1 ? ` Trường còn ${data.length - 1} phiếu kiểm kê khác đang xử lý.` : null}
          {!s.canOpen ? " Liên hệ cán bộ thiết bị đang lập phiếu để xử lý." : null}
        </p>
      </div>
      {s.canOpen ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to={`/inventory-sessions/show/${s.id}`}>
            Mở phiếu kiểm kê
            <ArrowRight />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
