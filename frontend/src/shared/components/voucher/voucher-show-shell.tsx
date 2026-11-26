import { AlertCircle } from "lucide-react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { PrintSheet, type PrintTable } from "@/shared/components/print/print-sheet";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { RelatedVouchers } from "@/shared/components/voucher/related-vouchers";
import { ReturnedNotice } from "@/shared/components/voucher/returned-notice";
import { VoucherActions, type TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { VoucherMoreMenu } from "@/shared/components/voucher/voucher-more-menu";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import {
  DEFAULT_TIMELINE_WORDING,
  useVoucherEventCount,
  VoucherTimelineDialog,
  type TimelineWording,
} from "@/shared/components/voucher/voucher-timeline";
import { detailFacts, VoucherDetailsView } from "@/shared/components/voucher/voucher-details";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { useVoucherApprovers } from "@/shared/hooks/use-voucher-events";
import { formatDateTime } from "@/shared/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card } from "@/shared/ui/card";
import { APPROVAL_STEP_LABELS, type ApprovalStep, type EquipmentLine, type VoucherApprovers, type VoucherBase } from "@/domains/voucher/types";

export type Fact = { label: string; value: ReactNode };

/**
 * Khung màn chi tiết của mọi loại phiếu: tiêu đề và trạng thái, cụm nút vòng
 * duyệt, lời nhắn trả lại / lý do từ chối, các thông tin của phiếu, các dòng, rồi
 * dòng thời gian duyệt và tệp đính kèm.
 *
 * <p>HAI CỘT như form lập phiếu: trái là nội dung phiếu (thông tin, các dòng, thông tin bổ sung, tệp
 * đính kèm); phải là MỘT thẻ tóm tắt — số phiếu, trạng thái, trường, và một dòng mở quá trình duyệt.
 *
 * <p>Hàng nút trên đầu trang chỉ còn việc chính của bước hiện tại (Sửa, Trình, Duyệt, nút riêng của loại
 * phiếu). Quá trình duyệt là nút biểu tượng cạnh ⚙; In, Tải lại, Huỷ phiếu, Xoá nằm trong menu ⚙ (`VoucherMoreMenu`) — sáu nút
 * ngang hàng là sáu thứ phải đọc trước khi tìm ra nút cần bấm.
 *
 * <p>Bảy loại phiếu, một bố cục: người đã đọc một phiếu thì đọc được phiếu khác —
 * số phiếu ở đâu, đang chờ ai, ai đã duyệt luôn nằm cùng một chỗ.
 */
export function VoucherShowShell({
  resource,
  kind,
  record,
  loading,
  facts,
  actions,
  extraActions,
  children,
  attachmentsHint,
  print,
  timeline,
  sideFacts,
}: {
  /**
   * Thông tin riêng của loại phiếu trên thẻ tóm tắt bên phải (năm ngân sách, số dòng, kế hoạch…) — đứng sau Trường,
   * trước các mốc thời gian. Mục để trống / "—" không hiện.
   */
  sideFacts?: Fact[];
  /** Chữ riêng cho phần quá trình (phiếu không qua duyệt): tên phần, nhãn mốc gửi, tên từng việc. */
  timeline?: TimelineWording;
  resource: string;
  /** "Đề xuất mua sắm"… */
  kind: string;
  record: VoucherBase | undefined;
  loading: boolean;
  facts: Fact[];
  /** Câu chữ riêng cho các nút duyệt. */
  actions?: Omit<ComponentProps<typeof VoucherActions>, "resource" | "record">;
  /** Nút riêng của loại phiếu (vd. "Lập phiếu ghi tăng"). */
  extraActions?: ReactNode;
  children?: ReactNode;
  attachmentsHint?: string;
  /**
   * Bản in: tên chứng từ, bảng dòng, người ký. Mặc định in các tài sản trên
   * phiếu, ký "Người lập phiếu" và "Thủ trưởng đơn vị".
   */
  print?: { title?: string; table?: PrintTable; signers?: string[] };
}) {
  const lines = (record as { lines?: EquipmentLine[] } | undefined)?.lines;
  const config = useVoucherForm(resource);
  const variant = (record as { kind?: string } | undefined)?.kind ?? null;
  const defaultTable: PrintTable | undefined = lines?.length && lines[0]?.equipment
    ? {
        headers: ["STT", "Mã thiết bị", "Tên thiết bị", "Vị trí", "Ghi chú"],
        rows: lines.map((l) => [l.lineNo, l.equipment.code, l.equipment.name, l.equipment.room?.name ?? "Kho", l.note ?? ""]),
      }
    : undefined;
  const [timelineOpen, setTimelineOpen] = useState(false);
  const wording = { ...DEFAULT_TIMELINE_WORDING, ...timeline };
  const eventCount = useVoucherEventCount(resource, record?.id);
  const { data: approvers } = useVoucherApprovers(resource, record?.id, record?.status);
  const approverText = approversText(approvers);
  // Huỷ phiếu và Xoá nằm trong menu ⚙ — menu báo việc được chọn, `VoucherActions` mở hộp hỏi lại.
  const [menuAction, setMenuAction] = useState<TuckedAction | null>(null);
  const tucked = useMemo(() => ({ request: menuAction, clear: () => setMenuAction(null) }), [menuAction]);
  return (
    <ShowView>
      <ShowViewHeader
        more={<VoucherMoreMenu resource={resource} record={record} onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction} timelineLabel={wording.title} />}
        // Nút việc của phiếu (Trình, Sửa, Huỷ phiếu, Duyệt…) nằm dưới thẻ tóm tắt bên phải — đầu trang chỉ còn
        // Quá trình duyệt và ⚙. Fragment rỗng để khung không tự vẽ nút Sửa mặc định.
        actions={<></>}
      />
      <VoucherTimelineDialog resource={resource} id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} wording={wording} />
      {record ? (
        <PrintSheet
          unit={record.school?.name}
          title={print?.title ?? kind}
          subtitle={record.code ? `Số: ${record.code}` : "Phiếu nháp, chưa cấp số"}
          facts={[
            ...facts.filter((f) => typeof f.value === "string" || typeof f.value === "number"),
            ...(record.note ? [{ label: "Ghi chú", value: record.note }] : []),
            ...detailFacts(config, record.details, variant),
          ]}
          table={print?.table ?? defaultTable}
          signers={print?.signers ?? ["Người lập phiếu", "Thủ trưởng đơn vị"]}
        />
      ) : null}
      <LoadingOverlay loading={loading}>
        <div className="print:hidden">
          <VoucherTwoColumn
            main={
              <>
                {record?.status === "DRAFT" && record.returnNote ? (
                  <ReturnedNotice resource={resource} id={record.id} note={record.returnNote} />
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
                      <Fact key={f.label} label={f.label} value={f.value} />
                    ))}
                    {record?.note ? <Fact label="Ghi chú" value={record.note} /> : null}
                    {record?.cancelReason ? <Fact label="Lý do huỷ" value={record.cancelReason} /> : null}
                  </dl>
                </Card>

                {children}

                {/* Phiếu gốc và phiếu sinh ra từ phiếu này — mọi phiếu dùng khuôn này đều có, không phải tự gắn. */}
                <RelatedVouchers resource={resource} id={record?.id} />

                <VoucherDetailsView config={config} details={record?.details} variant={variant}
                  draft={record?.status === "DRAFT"} />

                <AttachmentsPanel
                  resource={resource}
                  recordId={record?.id}
                  // Đã trình duyệt: tệp khoá, không thêm, không xoá — người duyệt đang xét các tệp đó.
                  canWrite={record?._can?.write === true && record?.status === "DRAFT"}
                  description={attachmentsHint}
                />
              </>
            }
            side={
              <>
                {/* Cùng chỗ với thẻ tóm tắt của form lập phiếu: số phiếu, đang ở trạng thái nào, của trường nào. */}
                <Card className="gap-0 py-0">
                  <SideSection title={kind}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-lg font-semibold tracking-tight">
                        {record?.code ?? <span className="text-muted-foreground text-sm font-normal">Chưa cấp số</span>}
                      </span>
                      {record ? <VoucherStatusBadge status={record.status} step={record.approvalStep} returned={!!record.returnNote} /> : null}
                    </div>
                    <SideFact label="Trường">{record?.school?.name}</SideFact>
                    {approverText ? <SideFact label="Người duyệt">{approverText}</SideFact> : null}
                    {(sideFacts ?? []).filter((f) => !blankFact(f.value)).map((f) => (
                      <SideFact key={f.label} label={f.label}>{f.value}</SideFact>
                    ))}
                    {record?.createdAt ? <SideFact label="Ngày lập">{formatDateTime(record.createdAt)}</SideFact> : null}
                    {record?.submittedAt ? <SideFact label={wording.submittedAt}>{formatDateTime(record.submittedAt)}</SideFact> : null}
                    {record?.completedAt ? <SideFact label="Hoàn tất lúc">{formatDateTime(record.completedAt)}</SideFact> : null}
                    {/* Quá trình duyệt mở trong hộp thoại: phiếu nháp chưa trình thì chưa có gì để xem, một thẻ
                        riêng cho một dòng "chưa trình lần nào" chỉ chiếm chỗ. */}
                    <SideFact label={wording.title}>
                      {eventCount ? (
                        <button type="button" className="text-primary font-medium hover:underline" onClick={() => setTimelineOpen(true)}>
                          Xem {eventCount} bước
                        </button>
                      ) : (
                        <span className="text-muted-foreground font-normal">{wording.notSubmitted}</span>
                      )}
                    </SideFact>
                  </SideSection>
                  {/* Nút việc của phiếu ngay dưới thông tin phiếu, như nút Lưu / Trình của form lập phiếu. */}
                  <VoucherActions resource={resource} record={record} tucked={tucked} layout="side" extra={extraActions} {...actions} />
                </Card>
              </>
            }
          />
        </div>
      </LoadingOverlay>
    </ShowView>
  );
}

/**
 * Dòng "Người duyệt" của thẻ tóm tắt — hiện VAI TRÒ duyệt, không hiện tên người. Đang chờ: vai trò của bước đang chờ
 * ("Lãnh đạo Sở"); phiếu nháp: vai trò bước đầu kèm "(khi trình)"; chưa ai có quyền thì nói rõ để người lập báo quản
 * trị viên. Đã quyết: vai trò người quyết cuối. Phiếu huỷ: không có dòng này.
 */
function approversText(a: VoucherApprovers | undefined): ReactNode {
  if (!a) return null;
  if (a.pending || a.upcoming) {
    if (!a.step) return null;
    if (!a.people.length) {
      return <span className="text-warning-text">Chưa có tài khoản {APPROVAL_STEP_LABELS[a.step]}</span>;
    }
    const role = capitalize(APPROVAL_STEP_LABELS[a.step]);
    return a.upcoming ? <>{role} <span className="text-muted-foreground font-normal">(khi trình)</span></> : role;
  }
  // Đã quyết: vai trò của người quyết CUỐI (người chốt duyệt / từ chối) — cùng cột "Người duyệt" của danh sách.
  const last = a.people.map((p) => p.step).filter((s): s is ApprovalStep => s != null).at(-1);
  return last ? capitalize(APPROVAL_STEP_LABELS[last]) : null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ô chưa khai: trống, hoặc màn của loại phiếu đã tự đổi thành dấu gạch. */
const blankFact = (v: ReactNode) => v === null || v === undefined || v === "" || v === "—" || v === "-";

function Fact({ label, value }: Fact) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}:</dt>
      <dd className="text-foreground text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}
