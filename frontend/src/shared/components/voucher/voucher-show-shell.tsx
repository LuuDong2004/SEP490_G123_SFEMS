import { AlertCircle, CornerUpLeft } from "lucide-react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { VoucherActions, type TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { VoucherMoreMenu } from "@/shared/components/voucher/voucher-more-menu";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { useVoucherEventCount, VoucherTimelineDialog } from "@/shared/components/voucher/voucher-timeline";
import { formatDateTime } from "@/shared/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card } from "@/shared/ui/card";
import type { VoucherBase } from "@/domains/voucher/types";

export type Fact = { label: string; value: ReactNode };

/**
 * Khung màn chi tiết của mọi loại phiếu: tiêu đề và trạng thái, cụm nút vòng duyệt, lời nhắn trả lại /
 * lý do từ chối, các thông tin của phiếu, rồi phần riêng của loại phiếu (`children`: bảng dòng...).
 *
 * HAI CỘT như form lập phiếu: trái là nội dung phiếu; phải là MỘT thẻ tóm tắt — số phiếu, trạng thái,
 * trường, và một dòng mở quá trình duyệt. Hàng nút trên đầu trang chỉ còn việc chính của bước hiện
 * tại (Sửa, Trình, Duyệt, nút riêng của loại phiếu). Quá trình duyệt, Tải lại, Huỷ phiếu, Xoá nằm
 * trong menu ⚙.
 *
 * Cách dùng (màn show của một loại phiếu):
 * <pre>
 * const { query } = useShow<EquipmentIntake>();
 * <VoucherShowShell resource="equipment_intakes" kind="Phiếu nhập thiết bị" record={query.data?.data}
 *     loading={query.isLoading} facts={[{ label: "Ngày nhập", value: formatDate(r.intakeDate) }]}
 *     actions={{ text: { approve: { label: "Duyệt và ghi tăng" } } }}>
 *   <IntakeLinesTable lines={r.lines} />
 * </VoucherShowShell>
 * </pre>
 */
export function VoucherShowShell({
  resource,
  kind,
  record,
  loading,
  facts,
  actions,
  extraActions,
  menuItems,
  side,
  children,
}: {
  resource: string;
  /** "Phiếu nhập thiết bị", "Đề xuất mua sắm"... */
  kind: string;
  record: VoucherBase | undefined;
  loading: boolean;
  facts: Fact[];
  /** Câu chữ riêng cho các nút duyệt. */
  actions?: Omit<ComponentProps<typeof VoucherActions>, "resource" | "record">;
  /** Nút riêng của loại phiếu (vd. "Ghi kết quả kiểm đếm"). */
  extraActions?: ReactNode;
  /** Mục riêng của loại phiếu trong menu ⚙. */
  menuItems?: ReactNode;
  /** Thẻ phụ dưới thẻ tóm tắt ở cột phải (tổng tiền...). */
  side?: ReactNode;
  children?: ReactNode;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const eventCount = useVoucherEventCount(resource, record?.id);
  // Huỷ phiếu và Xoá nằm trong menu ⚙ — menu báo việc được chọn, `VoucherActions` mở hộp hỏi lại.
  const [menuAction, setMenuAction] = useState<TuckedAction | null>(null);
  const tucked = useMemo(() => ({ request: menuAction, clear: () => setMenuAction(null) }), [menuAction]);
  return (
    <ShowView>
      <ShowViewHeader
        more={
          <VoucherMoreMenu resource={resource} record={record} onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction}>
            {menuItems}
          </VoucherMoreMenu>
        }
        actions={
          <>
            {extraActions}
            <VoucherActions resource={resource} record={record} tucked={tucked} {...actions} />
          </>
        }
      />
      <VoucherTimelineDialog resource={resource} id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} />
      <LoadingOverlay loading={loading}>
        <VoucherTwoColumn
          main={
            <>
              {record?.status === "DRAFT" && record.returnNote ? (
                <Alert>
                  <CornerUpLeft className="text-warning-text" />
                  <AlertTitle>Phiếu bị trả lại, cần sửa</AlertTitle>
                  <AlertDescription>{record.returnNote}</AlertDescription>
                </Alert>
              ) : null}
              {record?.status === "REJECTED" && record.rejectReason ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Phiếu bị từ chối</AlertTitle>
                  <AlertDescription>{record.rejectReason}</AlertDescription>
                </Alert>
              ) : null}
              <Card className="@container gap-4 px-4 py-4">
                <StepTitle title="Thông tin phiếu" />
                <dl className="grid gap-x-8 gap-y-5 @md:grid-cols-2 @3xl:grid-cols-3">
                  {/* Ô chưa khai không hiện: một lưới đầy dấu "—" che mất mấy dòng có nghĩa. */}
                  {facts.filter((f) => !blankFact(f.value)).map((f) => (
                    <FactItem key={f.label} label={f.label} value={f.value} />
                  ))}
                  {record?.note ? <FactItem label="Ghi chú" value={record.note} /> : null}
                  {record?.cancelReason ? <FactItem label="Lý do huỷ" value={record.cancelReason} /> : null}
                </dl>
              </Card>

              {children}
            </>
          }
          side={
            <>
              <Card className="gap-0 py-0">
                <SideSection title={kind}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-semibold tracking-tight">
                      {record?.code ?? <span className="text-muted-foreground text-sm font-normal">Chưa cấp số</span>}
                    </span>
                    {record ? <VoucherStatusBadge status={record.status} step={record.approvalStep} returned={!!record.returnNote} /> : null}
                  </div>
                  <SideFact label="Trường">{record?.school?.name}</SideFact>
                  {record?.submittedAt ? <SideFact label="Trình lúc">{formatDateTime(record.submittedAt)}</SideFact> : null}
                  {record?.completedAt ? <SideFact label="Hoàn tất lúc">{formatDateTime(record.completedAt)}</SideFact> : null}
                  <SideFact label="Quá trình duyệt">
                    {eventCount ? (
                      <button type="button" className="text-primary font-medium hover:underline" onClick={() => setTimelineOpen(true)}>
                        Xem {eventCount} bước
                      </button>
                    ) : (
                      <span className="text-muted-foreground font-normal">Chưa trình lần nào</span>
                    )}
                  </SideFact>
                </SideSection>
              </Card>
              {side}
            </>
          }
        />
      </LoadingOverlay>
    </ShowView>
  );
}

/** Ô chưa khai: trống, hoặc màn của loại phiếu đã tự đổi thành dấu gạch. */
const blankFact = (v: ReactNode) => v === null || v === undefined || v === "" || v === "—" || v === "-";

function FactItem({ label, value }: Fact) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}
