import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Link } from "react-router";
import { useResourceParams } from "@refinedev/core";
import { AlertCircle, CornerUpLeft } from "lucide-react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { PrintSheet, type PrintTable } from "@/shared/components/print/print-sheet";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { RelatedVouchers } from "@/shared/components/voucher/related-vouchers";
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
import { detailFacts, lineDetailsText, VoucherDetailsView } from "@/shared/components/voucher/voucher-details";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { formatDateTime } from "@/shared/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ASSET_STATUS_LABELS } from "@/domains/equipment/types";
import type { EquipmentLine, VoucherBase } from "@/domains/voucher/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

const money = new Intl.NumberFormat("vi-VN");

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
}: {
  /** Chữ riêng cho phần quá trình (phiếu không qua duyệt): tên phần, nhãn mốc gửi, tên từng việc. */
  timeline?: TimelineWording;
  resource: string;
  /** "Phiếu cấp phát", "Phiếu mượn"... */
  kind: string;
  record: VoucherBase | undefined;
  loading: boolean;
  facts: Fact[];
  /** Câu chữ riêng cho các nút duyệt. */
  actions?: Omit<ComponentProps<typeof VoucherActions>, "resource" | "record">;
  /** Nút riêng của loại phiếu (vd. "Xác nhận đã nhận", "Ghi nhận trả"). */
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
  // Huỷ phiếu và Xoá nằm trong menu ⚙ — menu báo việc được chọn, `VoucherActions` mở hộp hỏi lại.
  const [menuAction, setMenuAction] = useState<TuckedAction | null>(null);
  const tucked = useMemo(() => ({ request: menuAction, clear: () => setMenuAction(null) }), [menuAction]);
  return (
    <ShowView>
      <ShowViewHeader
        more={<VoucherMoreMenu resource={resource} record={record} onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction} timelineLabel={wording.title} />}
        actions={
          <>
            {extraActions}
            <VoucherActions resource={resource} record={record} tucked={tucked} {...actions} />
          </>
        }
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

                {/* Trường chứng từ của các bước SAU khi lập phiếu (trả đồ mượn, ghi kết quả sửa chữa…):
                    mỗi giai đoạn một khung, mang tên mục của chính nó. */}
                {[...new Set((config?.sections ?? []).map((s) => s.stage).filter((s): s is string => !!s))].map((stage) => (
                  <VoucherDetailsView key={stage} config={config} details={record?.details} stage={stage} variant={variant}
                    title={stage === "return" ? "Biên bản trả" : (config?.sections.find((s) => s.stage === stage)?.title ?? "Kết quả")} />
                ))}

                <AttachmentsPanel
                  resource={resource}
                  recordId={record?.id}
                  canWrite={record?._can?.write === true}
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
                    {record?.submittedAt ? <SideFact label={wording.submittedAt}>{formatDateTime(record.submittedAt)}</SideFact> : null}
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
                </Card>
              </>
            }
          />
        </div>
      </LoadingOverlay>
    </ShowView>
  );
}

/** Ô chưa khai: trống, hoặc màn của loại phiếu đã tự đổi thành dấu gạch. */
const blankFact = (v: ReactNode) => v === null || v === undefined || v === "" || v === "—" || v === "-";

function Fact({ label, value }: Fact) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Bảng các tài sản trên phiếu. {@code extraColumns} thêm cột riêng của loại phiếu
 * (tình trạng lúc giao, kết quả khi trả...). Gọn để vừa khung không cuộn ngang: mã · tên · vị trí ·
 * trạng thái; số serial nằm dưới tên khi có; nguyên giá / còn lại chỉ ở phiếu nói về GIÁ TRỊ
 * (thanh lý, hao mòn — {@code withValues}); cột Ghi chú chỉ khi có dòng ghi chú.
 */
export function EquipmentLinesTable<L extends EquipmentLine>({
  title = "Thiết bị trên phiếu",
  description,
  lines,
  extraColumns = [],
  resource,
  withValues,
  locationNote,
}: {
  withValues?: boolean;
  /**
   * Dòng nhỏ dưới vị trí — vd. tên trường đang giữ tài sản ở phiếu điều chuyển, vì hai trường đều có "Kho thiết bị".
   */
  locationNote?: (line: L) => ReactNode;
  /** Loại phiếu — để hiện trường chứng từ của từng dòng; vắng thì lấy từ URL. */
  resource?: string;
  title?: string;
  description?: ReactNode;
  lines: L[];
  extraColumns?: { header: string; cell: (line: L) => ReactNode; className?: string }[];
}) {
  const params = useResourceParams();
  const config = useVoucherForm(resource ?? params.resource?.name);
  const hasNotes = lines.some((l) => l.note);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} <span className="text-muted-foreground font-normal">({lines.length})</span>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Mã thiết bị</TableHead>
              <TableHead>Tên</TableHead>
              {withValues ? <TableHead className="text-right">Nguyên giá</TableHead> : null}
              {withValues ? <TableHead className="text-right">Còn lại</TableHead> : null}
              <TableHead>Vị trí</TableHead>
              <TableHead>Trạng thái</TableHead>
              {extraColumns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
              {hasNotes ? <TableHead>Ghi chú</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="text-muted-foreground tabular-nums">{line.lineNo}</TableCell>
                <TableCell className="font-mono text-xs">
                  <Link className="hover:underline" to={`/equipment/show/${line.equipment.id}`}>
                    {line.equipment.code}
                  </Link>
                </TableCell>
                {/* Tên dài được xuống dòng: để nguyên một dòng thì nó chiếm hết bề ngang, cột sau bị bóp hẹp. */}
                <TableCell className="min-w-40 whitespace-normal">
                  <div>{line.equipment.name}</div>
                  {line.equipment.serialNumber ? <div className="text-muted-foreground font-mono text-xs">Serial {line.equipment.serialNumber}</div> : null}
                  {lineDetailsText(config, line.details) ? (
                    <div className="text-muted-foreground text-xs">{lineDetailsText(config, line.details)}</div>
                  ) : null}
                </TableCell>
                {withValues ? <TableCell className="text-right tabular-nums">{line.equipment.originalValue != null ? money.format(line.equipment.originalValue) : "—"}</TableCell> : null}
                {withValues ? <TableCell className="text-right tabular-nums">{line.equipment.remainingValue != null ? money.format(line.equipment.remainingValue) : "—"}</TableCell> : null}
                <TableCell>
                  <div>{line.equipment.room?.name ?? <span className="text-muted-foreground">Kho</span>}</div>
                  {locationNote ? <div className="text-muted-foreground text-xs">{locationNote(line)}</div> : null}
                </TableCell>
                <TableCell>
                  <Badge variant={ASSET_STATUS_VARIANTS[line.equipment.status] ?? "neutral"}>{ASSET_STATUS_LABELS[line.equipment.status] ?? line.equipment.status}</Badge>
                </TableCell>
                {extraColumns.map((c) => (
                  <TableCell key={c.header} className={c.className}>
                    {c.cell(line)}
                  </TableCell>
                ))}
                {hasNotes ? <TableCell className="text-muted-foreground">{line.note ?? "—"}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
