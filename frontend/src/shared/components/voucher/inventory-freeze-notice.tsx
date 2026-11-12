import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

/**
 * Loại phiếu bị khoá khi trường đang kiểm kê — cùng danh sách với `InventoryFreeze.TOUCHES` ở máy chủ. Máy chủ là
 * nơi chặn; dải này chỉ nói TRƯỚC để người lập khỏi lập xong cả phiếu rồi mới biết.
 */
const FROZEN_RESOURCES = new Set(["equipment_intakes"]);

type ActiveInventory = {
  id: number;
  code: string | null;
  title: string;
  status: "DRAFT" | "PENDING";
  roomName: string | null;
  canOpen: boolean;
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
  if (!enabled || !data?.length) return null;
  const s = data.find((item) => item.roomName == null) ?? data[0];
  // Tên phòng thường đã có chữ "Phòng" ("Phòng thí nghiệm") — không ghi thành "phòng Phòng thí nghiệm".
  const scope = !s.roomName ? "cả trường" : /^phòng\s/i.test(s.roomName) ? s.roomName : `phòng ${s.roomName}`;
  const what = s.code ?? `phiếu nháp “${s.title}”`;
  return (
    <div role="status" className={cn("bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5 shadow-sm", className)}>
      <span className="bg-warning-subtle text-warning-text grid size-8 shrink-0 place-items-center rounded-md" aria-hidden>
        <ClipboardList className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          Đang kiểm kê {scope}
          <Badge variant="warning" dot>{s.status === "DRAFT" ? "Nháp" : "Chờ duyệt"}</Badge>
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
