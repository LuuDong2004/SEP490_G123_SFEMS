import { useShow } from "@refinedev/core";
import { AlertCircle, CheckCircle2, Clock, FilePen } from "lucide-react";
import { useState, type ReactNode } from "react";

import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { SideFact, SideSection } from "@/shared/components/voucher/voucher-layout";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import type { InventorySession } from "@/domains/inventory/types";
import type { VoucherStatus } from "@/domains/voucher/types";
import { InventoryBreakdown } from "./breakdown";
import { CountingPanel, type SurplusSeed } from "./counting-panel";
import { InventoryPrint, PrintMenuItem } from "./print";
import { SurplusPanel } from "./surplus-panel";

/** Câu "đang ở đâu, việc kế tiếp là gì" trong thẻ kiểm đếm. */
const STAGE: Record<VoucherStatus, { icon: ReactNode; tone: string; text: string }> = {
  DRAFT: { icon: <FilePen />, tone: "bg-neutral-subtle text-neutral-text", text: "Đang kiểm đếm. Kiểm xong thì trình biên bản." },
  PENDING: { icon: <Clock />, tone: "bg-warning-subtle text-warning-text", text: "Kết quả đã chốt, chờ duyệt." },
  APPROVED: { icon: <CheckCircle2 />, tone: "bg-success-subtle text-success-text", text: "Đã duyệt, kết quả đã ghi vào lịch sử tài sản." },
  COMPLETED: { icon: <CheckCircle2 />, tone: "bg-success-subtle text-success-text", text: "Đã duyệt, kết quả đã ghi vào lịch sử tài sản." },
  REJECTED: { icon: <AlertCircle />, tone: "bg-destructive-subtle text-destructive-text", text: "Biên bản bị từ chối." },
  CANCELLED: { icon: <AlertCircle />, tone: "bg-neutral-subtle text-neutral-text", text: "Phiếu đã huỷ." },
};

/** Thẻ "Kiểm đếm" ở cột phải: phiếu đang ở bước nào, đã kiểm bao nhiêu, bao nhiêu chênh lệch, bao nhiêu tài sản thừa. */
function CountingSummary({ record }: { record: InventorySession }) {
  const s = record.summary;
  const pct = s.total ? Math.round((s.checked / s.total) * 100) : 0;
  const lineDiffs = s.missing + s.wrongRoom + s.damaged;
  const stage = STAGE[record.status];
  return (
    <Card className="gap-0 py-0">
      <SideSection title="Kiểm đếm">
        {stage ? (
          <p className={cn("flex items-start gap-2 rounded-md px-2.5 py-2 text-xs [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0", stage.tone)}>
            {stage.icon}
            {stage.text}
          </p>
        ) : null}
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
 * của vòng duyệt. Phiếu còn nháp và người xem có quyền ghi thì bảng thành ô nhập. Menu ⚙ có "In biên bản" (KK-07):
 * in giấy hoặc lưu PDF từ hộp in của trình duyệt.
 */
export const InventorySessionShow = () => {
  const { query } = useShow<InventorySession>();
  const r = query.data?.data;
  const editable = !!r?._actions?.includes("count");
  const [surplusSeed, setSurplusSeed] = useState<SurplusSeed | null>(null);
  return (
    <>
      {/* Màn làm việc không lên giấy; bản in là một bố cục riêng (quốc hiệu, chữ ký). */}
      <div className="print:hidden">
        <VoucherShowShell
          resource="inventory_sessions"
          kind="Phiếu kiểm kê"
          record={r}
          loading={query.isLoading}
          menuItems={<PrintMenuItem />}
          facts={[
            { label: "Tên đợt", value: r?.title },
            { label: "Ngày kiểm kê", value: formatPlainDate(r?.inventoryDate) },
            { label: "Phạm vi", value: r ? (r.room?.name ?? "Cả trường") : null },
            { label: "Đợt kiểm kê", value: r?.campaign?.name },
            { label: "Tổ kiểm kê", value: r?.council },
            { label: "Kết luận", value: r?.conclusion },
          ]}
          actions={{
            text: {
              submit: {
                label: "Trình biên bản",
                title: "Trình biên bản kiểm kê?",
                description: "Kết quả kiểm đếm sẽ được chốt. Lãnh đạo trường duyệt xong thì kết quả được ghi vào lịch sử tài sản.",
                confirm: "Trình biên bản",
              },
              approve: {
                label: "Duyệt biên bản",
                title: "Duyệt biên bản kiểm kê?",
                // Dự án chưa có phiếu ghi giảm, điều chuyển, báo hỏng: duyệt chỉ ghi nhận, không lập phiếu xử lý nào.
                description: "Kết quả kiểm kê được ghi vào lịch sử từng tài sản; tài sản phát hiện hỏng chuyển tình trạng thành Hỏng.",
                confirm: "Duyệt biên bản",
                done: "Đã duyệt biên bản",
              },
            },
          }}
          side={r ? <CountingSummary record={r} /> : null}
        >
          {r ? <CountingPanel key={r.id} record={r} editable={editable} onSurplus={setSurplusSeed} /> : null}
          {r ? <InventoryBreakdown record={r} /> : null}
          {r ? <SurplusPanel record={r} editable={editable} seed={surplusSeed} /> : null}
        </VoucherShowShell>
      </div>
      {r ? <InventoryPrint record={r} /> : null}
    </>
  );
};
