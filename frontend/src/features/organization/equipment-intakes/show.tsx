import { useOne, useShow } from "@refinedev/core";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  CornerUpLeft,
  FilePen,
  History,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { DocumentSheet } from "@/shared/components/print/document-sheet";
import { useVoucherView } from "@/shared/hooks/use-voucher-view";
import { useVoucherEvents } from "@/shared/hooks/use-voucher-events";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { RelatedVouchers } from "@/shared/components/voucher/related-vouchers";
import { VoucherActions, type TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { VoucherMoreMenu } from "@/shared/components/voucher/voucher-more-menu";
import { VoucherViewSwitch } from "@/shared/components/voucher/voucher-view-switch";
import { lineDetailsText, VoucherDetailsView } from "@/shared/components/voucher/voucher-details";
import { CompletionList, SideFact, SideSection, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { VoucherTimelineDialog, useVoucherEventCount } from "@/shared/components/voucher/voucher-timeline";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { formatDateTime, formatPlainDate, formatEditedAt } from "@/shared/lib/format";
import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { FUNDING_LABELS } from "@/domains/equipment/types";
import { TRACKING_LABELS } from "@/domains/equipment-intake/types";
import type { EquipmentIntake, IntakeLine } from "@/domains/equipment-intake/types";
import type { Details, VoucherFormConfig } from "@/domains/voucher/form-types";
import type { VoucherStatus } from "@/domains/voucher/types";
import { LINES_GRID, LineStatus } from "./lines-editor";
import { AssetCodeList, AssetCodesCell } from "./asset-codes";
import { useIntakeAssets } from "./use-intake-assets";

/**
 * Bảng dòng của phiếu ĐÃ ghi tăng: thêm cột "Mã tài sản" đứng đầu — người đối chiếu (dán tem, so hoá đơn)
 * cần thấy mã ngay trên phiếu, không phải bấm sang danh sách thiết bị (góp ý của tester). Chỉ màn xem có
 * cột này; form lập phiếu vẫn theo LINES_GRID, vì lúc đó chưa có mã nào.
 */
const COMPLETED_GRID =
  "grid grid-cols-[1.75rem_minmax(11rem,14rem)_minmax(12rem,1fr)_7.5rem_5.5rem_8rem_3.25rem] items-center gap-x-5 [&>*]:min-w-0";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { IntakeSourceLink } from "./origin-field";
import { intakeReadiness, lineIssues } from "./readiness";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");

/** Phiếu đang ở đâu trong vòng đời, nói bằng một câu — thẻ trạng thái ở cột phải. */
const STAGE: Record<VoucherStatus, { icon: ReactNode; tone: string; text: string }> = {
  DRAFT: {
    icon: <FilePen />,
    tone: "bg-neutral-subtle text-neutral-text",
    text: "Chưa ghi tăng. Trình để lãnh đạo trường duyệt.",
  },
  PENDING: {
    icon: <Clock />,
    tone: "bg-warning-subtle text-warning-text",
    text: "Đã trình, chờ duyệt. Duyệt xong thì tài sản mới được ghi tăng.",
  },
  APPROVED: {
    icon: <CheckCircle2 />,
    tone: "bg-info-subtle text-info-text",
    text: "Đã duyệt.",
  },
  COMPLETED: {
    icon: <PackageCheck />,
    tone: "bg-success-subtle text-success-text",
    text: "Đã ghi tăng. Phiếu không sửa được nữa.",
  },
  REJECTED: {
    icon: <XCircle />,
    tone: "bg-destructive-subtle text-destructive-text",
    text: "Bị từ chối, không ghi tăng.",
  },
  CANCELLED: {
    icon: <Ban />,
    tone: "bg-neutral-subtle text-neutral-text",
    text: "Đã huỷ, không ghi tăng.",
  },
};

/** Màn Thiết bị, bảng Chi tiết, lọc sẵn đúng tài sản của phiếu này (chip "Đang xem: phiếu …"). */
function assetsLink(record: { id: number; code?: string | null }) {
  return `/equipment?drill=intake.id:${record.id}&drillLabel=${encodeURIComponent(`phiếu ${record.code ?? "ghi tăng"}`)}`;
}

/** Nút "⋯" của hồ sơ phiếu: xem tài sản đã sinh, in tem, tải lại — như menu ⋯ của hồ sơ thiết bị. */
function IntakeMoreMenu({ record, onTimeline, onAction, onPrint }: {
  /** In phiếu: bản in là tờ ở dạng Văn bản, nên màn chuyển sang dạng đó rồi mới in. */
  onPrint: () => void;
  record: EquipmentIntake | undefined;
  onTimeline: () => void;
  /** Huỷ phiếu / Xoá: việc ít dùng nằm cuối menu, hộp hỏi lại do `VoucherActions` mở. */
  onAction: (action: TuckedAction) => void;
}) {
  const navigate = useNavigate();
  const generated = record?.status === "COMPLETED" ? record.generatedCount ?? 0 : 0;
  return (
    <VoucherMoreMenu resource="equipment_intakes" record={record} onTimeline={onTimeline} onAction={onAction}
      timelineButton printLabel="In phiếu" onPrint={onPrint}>
      {generated > 0 && record ? (
        <>
          <DropdownMenuItem onSelect={() => navigate(assetsLink(record))}>
            <CheckCircle2 />
            Xem tài sản đã ghi tăng
            <span className="text-muted-foreground ms-auto text-xs tabular-nums">{generated}</span>
          </DropdownMenuItem>
        </>
      ) : null}
    </VoucherMoreMenu>
  );
}

/** Chứng từ HIỆU LỰC của một dòng: của dòng, không thì của đầu phiếu (phiếu lập trước khi chứng từ đi theo dòng). */
function effective(line: IntakeLine, head: EquipmentIntake | undefined) {
  return {
    supplier: line.supplier ?? head?.supplier,
    documentNo: line.documentNo ?? head?.documentNo,
    documentDate: line.documentDate ?? head?.documentDate,
    fundingSource: line.fundingSource ?? head?.fundingSource,
    acquisitionMethod: line.acquisitionMethod ?? head?.acquisitionMethod,
    warrantyMonths: line.warrantyMonths ?? head?.warrantyMonths,
  };
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", wide && "sm:col-span-2")}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium break-words">{children ?? <span className="text-muted-foreground font-normal">—</span>}</dd>
    </div>
  );
}

/** Hộp chi tiết một dòng (chỉ xem) — cùng các mục với hộp sửa dòng của form. */
function LineShowDialog({ line, head, config, issues, canWrite, onClose }: {
  line: IntakeLine;
  head: EquipmentIntake | undefined;
  config: VoucherFormConfig | undefined;
  issues: string[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const doc = effective(line, head);
  const mismatch = line.receivedQuantity !== line.documentQuantity;
  const extra = lineDetailsText(config, (line as any).details);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="form" className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dòng {line.lineNo} — {line.catalog?.name ?? line.name}</DialogTitle>
          <DialogDescription>
            {line.catalog?.code ? <span className="font-mono">{line.catalog.code}</span> : null}
            {line.trackingType ? ` · ${TRACKING_LABELS[line.trackingType]}` : ""}
          </DialogDescription>
        </DialogHeader>
        {issues.length ? (
          <div className="bg-warning-subtle text-warning-text rounded-md px-3 py-2 text-sm">
            <span className="font-medium">Còn thiếu trước khi trình:</span> {issues.join(" · ")}
          </div>
        ) : null}
        <section className="space-y-3">
          <h4 className="text-overline text-muted-foreground">Số lượng, giá và vị trí</h4>
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Tên trên chứng từ" wide>{line.name}</Fact>
            <Fact label="SL hoá đơn">{line.documentQuantity}</Fact>
            <Fact label="SL thực nhận">
              <span className={mismatch ? "text-warning-text" : undefined}>{line.receivedQuantity}</span>
              {(line.packUnit?.name ?? line.unit?.name) ? <span className="text-muted-foreground font-normal"> {line.packUnit?.name ?? line.unit?.name}</span> : null}
            </Fact>
            {line.packUnit && line.packSize != null ? (
              <>
                <Fact label="Quy cách">{`1 ${line.packUnit.name} = ${Number(line.packSize).toLocaleString("vi-VN")} ${line.unit?.name ?? ""}`}</Fact>
                <Fact label="Vào sổ">{`${Number(line.stockQuantity ?? 0).toLocaleString("vi-VN")} ${line.unit?.name ?? ""}`}</Fact>
              </>
            ) : null}
            <Fact label="Đơn giá">{line.unitPrice != null ? `${money.format(line.unitPrice)} đ` : null}</Fact>
            <Fact label="Thành tiền">{line.amount != null ? `${money.format(line.amount)} đ` : null}</Fact>
            <Fact label="Vị trí nhận">{line.room?.name ?? "Kho"}</Fact>
            {head?.status === "COMPLETED" ? <Fact label="Đã ghi tăng">{line.generatedCount} hồ sơ</Fact> : null}
            {line.varianceReason ? <Fact label="Lý do lệch" wide>{line.varianceReason}</Fact> : null}
            <Fact label="Model">{line.model}</Fact>
            <Fact label="Hãng sản xuất">{line.manufacturer}</Fact>
            {line.expiryDate ? <Fact label="Hạn sử dụng">{formatPlainDate(line.expiryDate)}</Fact> : null}
          </dl>
        </section>
        <section className="space-y-3">
          <h4 className="text-overline text-muted-foreground">Chứng từ và nguồn</h4>
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Nhà cung cấp" wide>{doc.supplier}</Fact>
            <Fact label="Số hoá đơn / hợp đồng">{doc.documentNo}</Fact>
            <Fact label="Ngày hoá đơn">{doc.documentDate ? formatPlainDate(doc.documentDate) : null}</Fact>
            <Fact label="Nguồn kinh phí">
              {doc.fundingSource ? `${FUNDING_LABELS[doc.fundingSource] ?? doc.fundingSource}${line.fundingNote ? `: ${line.fundingNote}` : ""}` : null}
            </Fact>
            <Fact label="Bảo hành">{doc.warrantyMonths != null ? `${doc.warrantyMonths} tháng` : null}</Fact>
            {doc.acquisitionMethod ? <Fact label="Hình thức mua sắm">{`${doc.acquisitionMethod.name}${line.acquisitionNote ? `: ${line.acquisitionNote}` : ""}`}</Fact> : null}
          </dl>
        </section>
        {extra ? (
          <section className="space-y-2">
            <h4 className="text-overline text-muted-foreground">Thông tin bổ sung của dòng</h4>
            <p className="text-sm">{extra}</p>
          </section>
        ) : null}
        {line.id != null ? (
          <AttachmentsPanel
            resource="equipment_intake_lines"
            title="Hoá đơn của dòng"
            recordId={line.id}
            canWrite={canWrite}
            compact
            description="Hoá đơn, hợp đồng của dòng hàng này. Xem lại được ở từng tài sản sau khi nhập."
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const INSPECTION_LABELS: Record<string, string> = { PASSED: "Đạt", PARTIAL: "Đạt một phần", FAILED: "Không đạt" };

/**
 * Phiếu ghi tăng trình bày như VĂN BẢN — tờ phiếu để ký, đóng dấu, lưu hồ sơ: quốc hiệu, tên trường, số
 * và ngày, bên giao - bên nhận, bảng thiết bị (số theo chứng từ và số thực nhận), tổng tiền, bốn chữ ký.
 * Cùng dữ liệu với dạng làm việc, không có nút nào: việc trên phiếu vẫn làm ở thanh đầu trang.
 */
function IntakeDocument({ record, config }: { record: EquipmentIntake; config: VoucherFormConfig | undefined }) {
  const d = (record.details ?? {}) as Record<string, any>;
  const named = (v: any) => (v && typeof v === "object" ? v.name : v) as string | undefined;
  const lines = record.lines ?? [];
  const suppliers = [...new Set(lines.map((l) => effective(l, record).supplier).filter(Boolean))];
  const invoices = [...new Set(lines.map((l) => effective(l, record).documentNo).filter(Boolean))];
  const fundings = [...new Set(lines.map((l) => effective(l, record).fundingSource).filter(Boolean))] as string[];
  const hasVariance = lines.some((l) => l.receivedQuantity !== l.documentQuantity);
  // Nhật ký phiếu: lần trình và lần duyệt GẦN NHẤT (phiếu bị trả lại rồi trình lại thì lấy lần sau cùng).
  const { data: eventData } = useVoucherEvents("equipment_intakes", record.id);
  const events = Array.isArray(eventData) ? eventData : [];
  const last = (action: string) => [...events].reverse().find((e) => e.action === action);
  const submitted = last("SUBMIT");
  const approved = last("APPROVE");
  // Thủ kho của biên bản: hàng ghi tăng luôn về kho, nên là CÁN BỘ PHỤ TRÁCH phòng kho nhận hàng — cùng người
  // mà hồ sơ tài sản ghi làm người quản lý (EquipmentLifecycle.keeperOf). Phiếu không còn ô khai tay (góp ý của
  // tester: khai tay là chỗ để biên bản nói khác hồ sơ); phiếu cũ đã khai thì giữ người đã khai.
  const storedKeeper = named(d.warehouseKeeper);
  const storeRoomId = lines.find((l) => l.room?.id)?.room?.id;
  const { result: storeRoom } = useOne<{ managingStaff?: { name?: string } | null }>({
    resource: "rooms",
    id: storeRoomId,
    queryOptions: { enabled: !storedKeeper && storeRoomId != null },
    errorNotification: false,
  });
  const keeper = storedKeeper ?? storeRoom?.managingStaff?.name;
  const qty = (l: IntakeLine) => (hasVariance ? [l.documentQuantity, l.receivedQuantity] : [l.receivedQuantity]);
  // Trường chứng từ đã điền mà tờ phiếu chưa có chỗ riêng (cấu hình thêm trường mới) vẫn hiện ra.
  const known = new Set(["deliveredBy", "deliveryRepresentative", "receiverName", "receiverPosition", "warehouseKeeper", "inspectionResult", "handoverMinutesNo"]);
  const extra = (config?.sections ?? []).flatMap((sec) => sec.fields)
    .filter((f) => !known.has(f.key) && d[f.key] != null && d[f.key] !== "")
    .map((f) => ({ label: f.label, value: named(d[f.key]) }));
  return (
    <DocumentSheet
      unit={record.school?.name}
      title="Phiếu ghi tăng tài sản"
      number={record.code}
      date={record.intakeDate}
      facts={[
        { label: "Nguồn hình thành", value: record.originSource ? `${record.originSource.name}${record.originNote ? ` (${record.originNote})` : ""}` : null },
        { label: "Nguồn kinh phí", value: fundings.map((f) => FUNDING_LABELS[f] ?? f).join(", ") || null },
        { label: "Nhà cung cấp", value: suppliers.join("; ") || null, wide: suppliers.join("; ").length > 40 },
        { label: "Hoá đơn, hợp đồng số", value: invoices.join(", ") || null },
        { label: "Người giao", value: [d.deliveredBy, d.deliveryRepresentative ? `đại diện ${d.deliveryRepresentative}` : null].filter(Boolean).join(", ") || null },
        { label: "Người nhận", value: [d.receiverName, d.receiverPosition].filter(Boolean).join(", ") || null },
        { label: "Kết quả kiểm tra", value: d.inspectionResult ? (INSPECTION_LABELS[d.inspectionResult] ?? d.inspectionResult) : null },
        { label: "Biên bản bàn giao số", value: d.handoverMinutesNo },
        ...extra,
        { label: "Ghi chú", value: record.note, wide: true },
      ]}
      // Người lập phiếu là TÀI KHOẢN đã lập — tên tài khoản demo dài ("Cán bộ thiết bị THCS Bình An (demo)")
      // vẫn nằm gọn trong cột chữ ký vì họ tên được xuống dòng.
      table={{
        headers: ["STT", "Tên thiết bị", "Mã", "ĐVT", ...(hasVariance ? ["SL chứng từ", "SL thực nhận"] : ["Số lượng"]), "Đơn giá", "Thành tiền"],
        rows: lines.map((l, i) => [
          i + 1,
          l.name || l.catalog?.name,
          l.catalog?.code ?? "",
          l.unit?.name ?? "",
          ...qty(l),
          l.unitPrice != null ? money.format(l.unitPrice) : "",
          l.amount != null ? money.format(l.amount) : "",
        ]),
        footer: [
          "",
          "Tổng cộng (đồng)",
          "",
          "",
          ...(hasVariance ? [lines.reduce((s, l) => s + l.documentQuantity, 0), record.totalReceived ?? 0] : [record.totalReceived ?? 0]),
          "",
          record.lines?.some((l) => l.unitPrice != null) ? money.format(Number(record.totalAmount ?? 0)) : "",
        ],
        alignCenter: [0, 3],
        alignRight: hasVariance ? [4, 5, 6, 7] : [4, 5, 6],
        grow: 1,
      }}
      // Chữ ký theo ĐÚNG quy trình của hệ thống: cán bộ thiết bị lập và trình, lãnh đạo trường duyệt (lần
      // duyệt đó là lúc ghi tăng). Hai người ấy làm việc trên hệ thống nên chỗ ký là dấu "đã trình / đã duyệt"
      // kèm thời điểm lấy từ nhật ký phiếu, không phải một ô trống chờ ký tay. Người giao là người ngoài,
      // ký tay; thủ kho là cán bộ phụ trách kho nhận hàng, chỉ có mặt khi kho đã khai người phụ trách.
      signers={[
        { title: "Người giao", name: d.deliveredBy },
        ...(keeper ? [{ title: "Thủ kho", name: keeper }] : []),
        {
          title: "Người lập phiếu",
          hint: "(Cán bộ thiết bị)",
          name: submitted?.actorName ?? record.createdBy?.name,
          stamp: submitted ? `Đã trình ${formatDateTime(submitted.createdAt)}` : null,
        },
        {
          title: "Lãnh đạo trường",
          hint: "(Duyệt, ghi tăng)",
          name: approved?.actorName,
          stamp: approved ? `Đã duyệt ${formatDateTime(approved.createdAt)}` : record.status === "PENDING" ? "Chờ duyệt" : null,
        },
      ]}
    />
  );
}

/**
 * Hồ sơ phiếu nhập — CÙNG BỐ CỤC hai cột với form Lập / Sửa: trái là bảng hàng nhận gọn (bấm dòng
 * xem chi tiết, chứng từ, hoá đơn của dòng), Biên bản giao nhận, tệp đính kèm; phải là thẻ tóm tắt
 * dính khi cuộn — thông tin phiếu, tổng tiền, và với phiếu nháp là "cần hoàn thiện". Thao tác phụ
 * (xem tài sản, in tem, tải lại) nằm trong nút ⚙ trên đầu trang.
 *
 * <p>Lần duyệt cuối là thời điểm ghi tăng — nên nút "Duyệt" nói rõ hệ quả: tài sản ra đời và
 * phiếu khoá lại.
 */
export const EquipmentIntakeShow = () => {
  const { result: record, query } = useShow<EquipmentIntake>({});
  const completed = record?.status === "COMPLETED";
  const draft = record?.status === "DRAFT";
  const config = useVoucherForm("equipment_intakes");
  const stage = record ? STAGE[record.status] : null;
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [opened, setOpened] = useState<number | null>(null);
  const [codesOpen, setCodesOpen] = useState<Set<number>>(() => new Set());
  const toggleCodes = (lineId: number) =>
    setCodesOpen((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  const eventCount = useVoucherEventCount("equipment_intakes", record?.id);
  const catalogOf = (l: any) => ({ trackingType: l?.trackingType, unit: l?.unit, assetCategory: l?.assetCategory });
  const rule = useOriginRules().ruleOf(record?.originSource?.id);
  const readiness = intakeReadiness((record ?? {}) as Parameters<typeof intakeReadiness>[0], catalogOf, config, rule);
  const missing = readiness.filter((i) => !i.ok);
  const lines = record?.lines ?? [];
  const assets = useIntakeAssets(record?.id, completed, record?.lines);
  const showCodes = completed && assets.canRead;
  const grid = showCodes ? COMPLETED_GRID : LINES_GRID;
  const issuesOf = (l: IntakeLine) => (draft ? lineIssues(l, catalogOf(l), config, record?.fundingSource, rule) : []);
  const canWrite = record?._can?.write === true;
  // Hai dạng xem của cùng một phiếu: "Làm việc" (bảng, thẻ, nút) và "Văn bản" (tờ phiếu như bản in).
  // Nhớ theo người dùng — ai quen đọc phiếu như tờ giấy thì lần sau mở ra vẫn là tờ giấy.
  const [view, setView] = useVoucherView("intake");
  // Huỷ phiếu và Xoá nằm trong menu ⚙ — menu báo việc được chọn, `VoucherActions` mở hộp hỏi lại.
  const [menuAction, setMenuAction] = useState<TuckedAction | null>(null);
  const tucked = useMemo(() => ({ request: menuAction, clear: () => setMenuAction(null) }), [menuAction]);

  const alerts = (
    <>
      {draft && record?.returnNote ? (
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
    </>
  );

  const main = view === "document" ? (
    <>
      {alerts}
      {record ? <IntakeDocument record={record} config={config} /> : null}
      <VoucherTimelineDialog resource="equipment_intakes" id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} />
    </>
  ) : (
    <>
      {alerts}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="px-4 pt-4 pb-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            Hàng nhận
            <HelpHint>
              {completed
                ? "Bấm vào dòng để xem chứng từ, hoá đơn."
                : "Bấm vào dòng để xem chứng từ, hoá đơn. Tài sản được ghi tăng khi lãnh đạo trường duyệt phiếu."}
            </HelpHint>
          </h3>
        </div>
        <div className="overflow-x-auto border-t">
          <div className={showCodes ? "min-w-[58rem]" : "min-w-[44rem]"}>
            <div className={cn(grid, "bg-surface-subtle text-overline text-muted-foreground border-b px-3 py-2")}>
              <span className="text-center">#</span>
              {showCodes ? <span>Mã tài sản</span> : null}
              <span>Thiết bị</span>
              <span className="text-right">Đơn giá</span>
              <span className="text-right">SL</span>
              <span className="text-right">Thành tiền</span>
              {/* Phiếu đã ghi tăng KHÔNG có cột "Tăng": nó lặp lại đúng cột SL. Chỉ khi số ghi tăng khác số
                  nhận thì con số đó hiện thành dòng nhỏ dưới SL. */}
              <span className="text-center" title={draft ? "Đủ để trình chưa" : undefined}>{draft ? "Đủ" : ""}</span>
            </div>
            {lines.map((line, i) => {
              const supplier = effective(line, record).supplier;
              const mismatch = line.receivedQuantity !== line.documentQuantity;
              return (
                <div
                  key={line.id ?? line.lineNo}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpened(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpened(i);
                    }
                  }}
                  className={cn(grid, "hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer border-b px-3 py-3 text-sm outline-none last:border-b-0")}
                >
                  <span className="text-muted-foreground text-center tabular-nums">{line.lineNo}</span>
                  {showCodes ? (
                    <AssetCodesCell
                      assets={line.id != null ? assets.byLine.get(line.id) : undefined}
                      loading={assets.loading}
                      open={line.id != null && codesOpen.has(line.id)}
                      onToggle={() => line.id != null && toggleCodes(line.id)}
                    />
                  ) : null}
                  {/* Một dòng chữ: tên thiết bị. Mã, cách quản lý, nhà cung cấp nằm ở chú thích khi rê chuột và
                      trong hộp chi tiết của dòng — như bảng dòng của form. */}
                  <div
                    className="truncate font-medium"
                    title={[line.name || line.catalog?.name, line.catalog?.code, line.trackingType ? TRACKING_LABELS[line.trackingType] : null, supplier].filter(Boolean).join(" · ")}
                  >
                    {line.name || line.catalog?.name}
                  </div>
                  <span className="text-right tabular-nums">{line.unitPrice != null ? money.format(line.unitPrice) : "—"}</span>
                  <div className="text-right tabular-nums">
                    <span className={cn("font-medium", mismatch && "text-warning-text")}>{line.receivedQuantity}</span>
                    {mismatch ? <div className="text-warning-text text-[0.6875rem]">HĐ {line.documentQuantity}</div> : null}
                    {completed && line.generatedCount !== line.receivedQuantity ? (
                      <div className="text-warning-text text-[0.6875rem]">ghi tăng {line.generatedCount}</div>
                    ) : null}
                  </div>
                  <span className="text-right font-medium tabular-nums">{line.amount != null ? money.format(line.amount) : "—"}</span>
                  {draft ? (
                    <LineStatus issues={issuesOf(line)} />
                  ) : (
                    <span />
                  )}
                  {showCodes && line.id != null && codesOpen.has(line.id) && (assets.byLine.get(line.id)?.length ?? 0) > 1 ? (
                    <AssetCodeList assets={assets.byLine.get(line.id)!} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <VoucherDetailsView config={config} details={(record?.details ?? undefined) as Details | undefined} draft={draft} title="Biên bản giao nhận" />

      <RelatedVouchers
        links={record?.source?.id != null
          ? [{ direction: "source", resource: record.source.resource, id: record.source.id, code: record.source.code, status: null, name: null }]
          : []}
      />

      <AttachmentsPanel
        resource="equipment_intakes"
        recordId={record?.id}
        canWrite={canWrite}
        compact
        description="Biên bản giao nhận và giấy tờ chung của phiếu. Hoá đơn của dòng nào thì bấm vào dòng đó để xem."
      />

      {opened != null && lines[opened] ? (
        <LineShowDialog
          line={lines[opened]}
          head={record}
          config={config}
          issues={issuesOf(lines[opened])}
          canWrite={canWrite}
          onClose={() => setOpened(null)}
        />
      ) : null}
      <VoucherTimelineDialog resource="equipment_intakes" id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} />
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection
        title="Phiếu ghi tăng"
        aside={
          <Button type="button" variant="ghost" size="sm" className="-me-2 h-7" onClick={() => setTimelineOpen(true)}>
            <History />
            Quá trình{eventCount ? ` (${eventCount})` : ""}
          </Button>
        }
      >
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi duyệt</span>}
        </SideFact>
        <SideFact label="Người lập">{record?.createdBy?.name}</SideFact>
        <SideFact label="Trường">{record?.school?.name}</SideFact>
        <SideFact label="Ngày nhập">{formatPlainDate(record?.intakeDate)}</SideFact>
        <SideFact label="Năm học">{record?.schoolYear?.name ?? <span className="text-warning-text font-normal">Chưa chọn</span>}</SideFact>
        <SideFact label="Nguồn hình thành">
          {record?.originSource
            ? `${record.originSource.name}${record.originNote ? `: ${record.originNote}` : ""}`
            : <span className="text-warning-text font-normal">Chưa chọn</span>}
        </SideFact>
        {record?.fundingSource ? <SideFact label="Nguồn kinh phí">{FUNDING_LABELS[record.fundingSource] ?? record.fundingSource}</SideFact> : null}
        {record?.source ? <SideFact label="Lập từ"><IntakeSourceLink source={record.source} /></SideFact> : null}
        {record?.note ? <SideFact label="Ghi chú">{record.note}</SideFact> : null}
        {record?.cancelReason ? <SideFact label="Lý do huỷ">{record.cancelReason}</SideFact> : null}
        {stage ? (
          <p className={cn("flex items-start gap-2 rounded-md px-2.5 py-2 text-xs [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0", stage.tone)}>
            {stage.icon}
            {completed && record?.confirmedAt ? `Đã ghi tăng lúc ${formatDateTime(record.confirmedAt)}. Phiếu không sửa được nữa.` : stage.text}
          </p>
        ) : null}
      </SideSection>

      <SideSection title="Tổng cộng">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{record?.lines?.some((l) => l.unitPrice != null) ? `${money.format(Number(record?.totalAmount ?? 0))} đ` : "—"}</div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {record?.lineCount ?? 0} dòng · {record?.totalReceived ?? 0} đơn vị
          {completed ? ` · đã sinh ${record?.generatedCount ?? 0} hồ sơ` : ""}
        </p>
        {completed && (record?.generatedCount ?? 0) > 0 && record ? (
          // Chưa có màn In tem QR trong hệ thống: chỉ còn nút Xem tài sản.
          <div className="grid gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link to={assetsLink(record)}>
                <CheckCircle2 />
                Xem tài sản
              </Link>
            </Button>
          </div>
        ) : null}
      </SideSection>

      {draft ? (
        <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : "Kiểm tra trước khi trình"}>
          <CompletionList
            showDone
            items={readiness.map((i) => ({ ...i, onClick: !i.ok && i.lines?.length ? () => setOpened(i.lines![0]) : undefined }))}
          />
          {missing.length && canWrite ? <p className="text-muted-foreground text-xs">Bấm Sửa trên đầu trang để hoàn thiện.</p> : null}
        </SideSection>
      ) : null}

      <SideSection>
        <dl className="text-muted-foreground space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt>Lập lúc</dt>
            <dd className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Sửa lần cuối</dt>
            <dd className="text-foreground">{formatEditedAt(record)}</dd>
          </div>
        </dl>
      </SideSection>
    </Card>
  );

  return (
    <ShowView>
      <ShowViewHeader
        meta={
          record ? (
            <>
              <VoucherStatusBadge status={record.status} step={record.approvalStep} returned={!!record.returnNote} />
            </>
          ) : null
        }
        more={
          <IntakeMoreMenu record={record} onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction}
            onPrint={() => {
              setView("document");
              setTimeout(() => window.print(), 300);
            }} />
        }
        actions={
          <>
            {/* Dạng xem và nút In đứng ở cụm bên phải, cạnh nút ⚙ — cùng chỗ với mọi thao tác của trang. */}
            {record ? (
              <VoucherViewSwitch view={view} onChange={setView} />
            ) : null}
          <VoucherActions
            resource="equipment_intakes"
            record={record}
            invalidates={["equipment", "equipment_items"]}
            tucked={tucked}
            text={{
              approve: {
                label: "Duyệt và ghi tăng",
                title: "Duyệt phiếu và ghi tăng tài sản?",
                description: (
                  <div className="space-y-2">
                    <p>
                      Mỗi thiết bị quản lý từng cái sẽ có một mã riêng. Vật tư tiêu hao thì mỗi dòng một mã chung cho cả lô.
                    </p>
                    <p>
                      Tổng <span className="text-foreground font-medium">{record?.totalReceived ?? 0}</span> đơn vị trên{" "}
                      <span className="text-foreground font-medium">{record?.lineCount ?? 0}</span> dòng. Sau khi duyệt,
                      phiếu KHÔNG sửa được nữa.
                    </p>
                  </div>
                ),
                confirm: "Duyệt và ghi tăng",
                done: "Đã duyệt, tài sản đã được ghi tăng",
              },
            }}
          />          </>
        }
      />

      <LoadingOverlay loading={query.isLoading}>
        <VoucherTwoColumn main={main} side={side} />
      </LoadingOverlay>
    </ShowView>
  );
};
