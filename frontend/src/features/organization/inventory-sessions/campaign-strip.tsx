import { useList } from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { getPinnedCampusId } from "@/shared/api/session";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { CampaignProgress, InventoryCampaign } from "@/domains/inventory/types";
import type { VoucherStatus } from "@/domains/voucher/types";

/**
 * Các ĐỢT KIỂM KÊ cấp trên đang mở, ngay trên danh sách phiếu kiểm kê của trường.
 *
 * <p>Với một trường, "đợt kiểm kê" không phải thứ để quản lý — nó là một LỜI YÊU CẦU: cơ quan nào đòi,
 * chốt số liệu ngày nào, hạn nộp bao giờ, và trường mình đã có phiếu cho đợt đó chưa. Một tab riêng chỉ
 * để đọc ba dòng ấy là một tab thừa; đặt nó ở đây thì việc phải làm (lập phiếu cho đợt này) nằm ngay
 * cạnh lời yêu cầu. Màn quản lý đợt (phát động, sửa, bảng tiến độ các trường) vẫn là màn riêng của
 * Sở / UBND.
 *
 * <p>Tình trạng của trường đọc từ `/inventory_campaigns/{id}/progress` — máy chủ chỉ trả các trường
 * người xem thấy, nên tài khoản một trường nhận đúng một dòng; tài khoản thấy nhiều trường nhận số tổng.
 */
export function CampaignStrip() {
  const { perspective } = usePerspective();
  // Phiếu theo đợt phủ mọi cơ sở của trường — tài khoản chỉ quản lý một cơ sở không lập được (máy chủ cũng từ chối).
  const pinned = getPinnedCampusId() != null;
  const { result } = useList<InventoryCampaign>({
    resource: "inventory_campaigns",
    pagination: { currentPage: 1, pageSize: 20 },
    sorters: [{ field: "deadline", order: "asc" }],
    // Chỉ đợt đang mở, lọc ở máy chủ — lấy một trang rồi lọc ở đây là mất đợt mới khi có nhiều đợt cũ.
    filters: [{ field: "closed", operator: "eq", value: false }],
  });
  const open = (result?.data ?? []).filter((c) => !c.closed);
  const progress = useQueries({
    queries: open.map((c) => ({
      queryKey: ["inventory_campaigns", c.id, "progress"],
      queryFn: ({ signal }) => kyInstance.get(`inventory_campaigns/${c.id}/progress`, { signal }).json<CampaignProgress>(),
      // Sau khi hoàn tất phiếu rồi quay về danh sách, lấy tiến độ mới ngay cả khi cache còn mới.
      refetchOnMount: "always" as const,
    })),
  });
  // Đợt vẫn mở với Sở/UBND, nhưng không còn là việc cần làm của trường đã hoàn tất phiếu.
  // Đợi tiến độ tải xong để không chớp lại một đợt đã hoàn tất từ cache cũ.
  const visible = open.flatMap((campaign, index) => {
    const state = progress[index];
    if (perspective === "school" && state?.isFetching) return [];
    const rows = state?.data?.schools;
    const own = perspective === "school" && rows?.length === 1 ? rows[0] : undefined;
    return own?.status === "COMPLETED" ? [] : [{ campaign, state }];
  });
  if (visible.length === 0) return null;

  return (
    <section aria-label="Đợt kiểm kê cấp trên đang mở" className="bg-card mb-3 rounded-lg border">
      <h3 className="text-overline text-muted-foreground border-b px-4 py-2">Đợt kiểm kê cấp trên đang mở</h3>
      <ul className="divide-y">
        {visible.map(({ campaign: c, state }) => {
          const p = state?.data;
          const rows = p && "schools" in p ? p.schools : undefined;
          const own = perspective === "school" && rows?.length === 1 ? rows[0] : undefined;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <Megaphone className="text-primary size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-muted-foreground text-xs">
                  {c.managingBody.name}{c.documentNo ? ` · CV số ${c.documentNo}` : ""} · hiệu lực {formatPlainDate(c.cutoffDate)} ·{" "}
                  <span className={cn(c.overdue && "text-destructive font-medium")}>
                    kết thúc {formatPlainDate(c.deadline)}
                    {c.overdue ? " (đã quá hạn)" : ""}
                  </span>
                </div>
              </div>
              {own ? (
                own.sessionId ? (
                  <>
                    <VoucherStatusBadge status={own.status as VoucherStatus} short />
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link to={`/inventory-sessions/show/${own.sessionId}`}>Mở phiếu của trường</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="warning">Chưa lập phiếu</Badge>
                    {pinned ? (
                      <span className="text-muted-foreground text-xs">Tài khoản quản lý cả trường lập phiếu cho đợt này</span>
                    ) : (
                      <Button asChild type="button" size="sm">
                        <Link to={`/inventory-sessions/create?campaign=${c.id}`}>Lập phiếu cho đợt này</Link>
                      </Button>
                    )}
                  </>
                )
              ) : rows ? (
                <>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {p?.completed ?? 0}/{p?.total ?? 0} trường đã có biên bản được duyệt
                  </span>
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link to={`/inventory-campaigns/show/${c.id}`}>Xem tiến độ</Link>
                  </Button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
