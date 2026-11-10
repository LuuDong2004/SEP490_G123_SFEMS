import { useShow } from "@refinedev/core";

import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { SideFact, SideSection } from "@/shared/components/voucher/voucher-layout";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import type { InventorySession, InventorySummary } from "@/domains/inventory/types";
import { CountingPanel } from "./counting-panel";
import { SurplusPanel } from "./surplus-panel";

/** Thẻ "Kiểm đếm" ở cột phải: đã kiểm bao nhiêu, bao nhiêu chênh lệch, bao nhiêu tài sản thừa. */
function CountingSummary({ s }: { s: InventorySummary }) {
  const pct = s.total ? Math.round((s.checked / s.total) * 100) : 0;
  const lineDiffs = s.missing + s.wrongRoom + s.damaged;
  return (
    <Card className="gap-0 py-0">
      <SideSection title="Kiểm đếm">
        <SideFact label="Đã kiểm"><span className="tabular-nums">{s.checked}/{s.total} · {pct}%</span></SideFact>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        {/* Đếm dòng lệch như nút "Chênh lệch" của bảng; tài sản thừa không nằm trên dòng nào nên tách riêng. */}
        <SideFact label="Chênh lệch">
          {lineDiffs > 0
            ? <span className="text-destructive-text tabular-nums">{lineDiffs}</span>
            : s.checked === s.total && s.total > 0
              ? <span className="text-success-text">Không có</span>
              : <span className="text-muted-foreground font-normal">Chưa có</span>}
        </SideFact>
        {s.surplus > 0 ? <SideFact label="Tài sản thừa"><span className="text-warning-text tabular-nums">{s.surplus}</span></SideFact> : null}
      </SideSection>
    </Card>
  );
}

/**
 * Chi tiết phiếu kiểm kê: thông tin phiếu, bảng kiểm đếm các tài sản chụp từ sổ (KK-04), tài sản thừa, và các nút
 * của vòng duyệt. Phiếu còn nháp và người xem có quyền ghi thì bảng thành ô nhập.
 */
export const InventorySessionShow = () => {
  const { query } = useShow<InventorySession>();
  const r = query.data?.data;
  const editable = !!r?._actions?.includes("count");
  return (
    <VoucherShowShell
      resource="inventory_sessions"
      kind="Phiếu kiểm kê"
      record={r}
      loading={query.isLoading}
      facts={[
        { label: "Tên đợt", value: r?.title },
        { label: "Ngày kiểm kê", value: formatPlainDate(r?.inventoryDate) },
        { label: "Phạm vi", value: r ? (r.room?.name ?? "Cả trường") : null },
        { label: "Đợt kiểm kê", value: r?.campaign?.name },
        { label: "Tổ kiểm kê", value: r?.council },
        { label: "Kết luận", value: r?.conclusion },
      ]}
      side={r ? <CountingSummary s={r.summary} /> : null}
    >
      {r ? <CountingPanel key={r.id} record={r} editable={editable} /> : null}
      {r ? <SurplusPanel record={r} editable={editable} /> : null}
    </VoucherShowShell>
  );
};
