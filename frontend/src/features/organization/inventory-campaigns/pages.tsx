import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useCan, useCustom, useCustomMutation, useInvalidate, useNotification, useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";
import { createColumnHelper } from "@tanstack/react-table";
import { Check, CornerUpLeft, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { FormDialog } from "@/shared/components/catalog/form-dialog";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments, usePendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { formatPlainDate, DEFAULT_PAGE_SIZE, todayLocal } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Segmented } from "@/shared/components/segmented";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { customResult } from "@/shared/hooks/use-custom-result";
import { CAMPAIGN_STATE_VARIANTS, VOUCHER_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Textarea } from "@/shared/ui/textarea";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CountCells } from "@/features/organization/inventory-sessions/breakdown";
import {
  CAMPAIGN_APPROVAL_LABELS, CAMPAIGN_STAGE_LABELS, CAMPAIGN_STATE_LABELS, COUNT_HEADS, campaignStageOf, campaignStateOf, sumCounts,
  type CampaignDiscrepancyRow, type CampaignProgress, type CampaignStage, type DiscrepancyCounts, type InventoryCampaign,
} from "@/domains/inventory/types";
import type { VoucherStatus } from "@/domains/voucher/types";
import { notBefore } from "@/features/organization/vouchers/date-range";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const InventoryCampaignList = () => {
  const columns = useMemo(() => {
    const h = createColumnHelper<InventoryCampaign>();
    return [
      h.accessor("title", { id: "title", header: "Đợt kiểm kê", enableSorting: true }),
      h.accessor("documentNo", { id: "documentNo", header: "Số công văn", cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">Chưa có số</span> }),
      h.display({ id: "body", header: "Cơ quan phát động", cell: ({ row }) => row.original.managingBody.name }),
      h.accessor("cutoffDate", { id: "cutoffDate", header: "Ngày hiệu lực", enableSorting: true, cell: ({ getValue }) => formatPlainDate(getValue()) }),
      h.accessor("deadline", {
        id: "deadline",
        header: "Ngày kết thúc",
        enableSorting: true,
        cell: ({ row }) => (
          <span className={row.original.overdue ? "text-destructive" : undefined}>{formatPlainDate(row.original.deadline)}</span>
        ),
      }),
      h.display({
        id: "state",
        header: "Tình trạng",
        cell: ({ row }) => <CampaignStateBadge campaign={row.original} />,
      }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            {row.original._can?.write ? <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {row.original._can?.delete ? <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" /> : null}
          </RowActions>
        ),
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, []);
  // Đợt của năm học đang làm việc (ô năm học trên header) — 306.
  const { id: yearId } = useSchoolYear();
  const table = useTable<InventoryCampaign>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      filters: { permanent: yearId != null ? [{ field: "schoolYear.id", operator: "eq", value: yearId }] : [] },
      queryOptions: { enabled: yearId != null },
    },
  });
  return (
    <ListView>
      <ListViewHeader />
      <DataTable table={table} toolbar={<ListToolbar table={table} search={<DataTableQuickFilter table={table} />} />} />
      {/* Hộp thoại phát động / sửa đợt (route lồng dưới danh sách). */}
      <Outlet />
    </ListView>
  );
};

/** Nhãn tình trạng của đợt — chữ ở `domains/inventory`, màu ở `status-variants`. */
function CampaignStateBadge({ campaign }: { campaign: InventoryCampaign }) {
  // Chưa duyệt (nháp, chờ duyệt) thì nhãn duyệt; đã duyệt (phát động) thì tình trạng theo ngày.
  if (campaign.status !== "APPROVED") {
    return <Badge variant={VOUCHER_STATUS_VARIANTS[campaign.status]}>{CAMPAIGN_APPROVAL_LABELS[campaign.status]}</Badge>;
  }
  const state = campaignStateOf(campaign, todayLocal());
  return <Badge variant={CAMPAIGN_STATE_VARIANTS[state]}>{CAMPAIGN_STATE_LABELS[state]}</Badge>;
}

/** Một dòng thông tin của đợt — cùng dáng ô "Thông tin phiếu" (nhãn mờ, giá trị đậm); chưa khai thì ghi "Chưa có". */
function Fact({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  const blank = value == null || value === "";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className={cn("text-sm font-medium", blank && "text-muted-foreground font-normal")}>{blank ? "Chưa có" : value}</dd>
    </div>
  );
}

/**
 * Trình / duyệt / trả lại đợt (308) — một hộp xác nhận; trả lại bắt buộc ghi lý do, duyệt ghi ý kiến nếu muốn. Duyệt xong
 * đợt được phát động: các trường thấy đợt và nhận thông báo.
 */
function CampaignStepButton({ campaign, step }: { campaign: InventoryCampaign; step: "submit" | "approve" | "return" }) {
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const { mutateAsync, mutation } = useCustomMutation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const text = {
    submit: { label: "Trình duyệt", icon: <Send />, title: "Trình Lãnh đạo Sở duyệt đợt kiểm kê?",
      desc: "Đã trình thì không sửa được nữa, trừ khi Lãnh đạo Sở trả lại. Duyệt xong đợt mới tới các trường.", ok: "Đã trình đợt kiểm kê" },
    approve: { label: "Duyệt", icon: <Check />, title: "Duyệt và phát động đợt kiểm kê?",
      desc: "Các trường thấy đợt và nhận thông báo để lập phiếu kiểm kê. Đã duyệt thì không sửa, xoá được nữa.", ok: "Đã duyệt, phát động đợt kiểm kê" },
    return: { label: "Trả lại", icon: <CornerUpLeft />, title: "Trả lại đợt kiểm kê?",
      desc: "Ghi rõ cần sửa gì để chuyên viên biết.", ok: "Đã trả lại đợt kiểm kê" },
  }[step];
  const busy = mutation.isPending;
  async function run() {
    try {
      await mutateAsync({ url: `${API_URL}/inventory_campaigns/${campaign.id}/${step}`, method: "post",
        values: step === "submit" ? {} : { note: note.trim() || null }, successNotification: false, errorNotification: false });
      notify?.({ type: "success", message: text.ok });
      setOpen(false);
      await invalidate({ resource: "inventory_campaigns", invalidates: ["list", "detail"], id: campaign.id });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    }
  }
  return (
    <>
      <Button type="button" variant={step === "return" ? "outline" : "default"} onClick={() => { setNote(""); setOpen(true); }}>
        {text.icon}
        {text.label}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <ConfirmContent tone={step === "return" ? "warning" : "neutral"} icon={text.icon} title={text.title} description={text.desc}
          cancelLabel="Chưa, để sau" confirmLabel={text.label} busy={busy} keepOpen
          confirmDisabled={step === "return" && !!textError("REASON", "Lý do", note.trim() || "", 500, 5) || (step === "return" && !note.trim())} onConfirm={() => void run()}>
          {step === "submit" ? null : (
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")}
              placeholder={step === "return" ? "Lý do trả lại (bắt buộc)" : "Ý kiến (không bắt buộc)"} />
          )}
        </ConfirmContent>
      </AlertDialog>
    </>
  );
}

/** Ngày dd/mm/yyyy của một ngày lịch "yyyy-MM-dd". */
const day = (iso?: string | null) => (iso ? formatPlainDate(iso) : "");

/** Công văn, kế hoạch kiểm kê kèm theo đợt: Sở tải lên, các trường tải về. */
const FILE_HINT = "Công văn, kế hoạch kiểm kê (PDF, Word, Excel, ảnh) — tối đa 10 MB mỗi tệp.";

function CampaignFields({ control, yearName, yearStart, nextStart, files }: {
  control: any;
  yearName: string | null;
  yearStart: string | null;
  nextStart: string | null;
  files: React.ReactNode;
}) {
  // Hộp hẹp một cột: tên; hai ngày đứng cạnh nhau theo bề rộng ô ngày (không giãn chừa khoảng trống); nội dung; tệp.
  return (
    <div className="grid gap-y-5">
      <TextField control={control} name="documentNo" label="Số công văn" rule="DOC_NO" placeholder="VD: 1234/SGDĐT-KHTC" className="max-w-64" />
      <TextField control={control} name="title" label="Tên đợt" rule="NAME" rules={{ required: "Nhập tên đợt" }}
        placeholder={`VD: Kiểm kê cuối ${yearName ? yearName.toLowerCase() : "năm học"}`} />
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <DateField control={control} name="cutoffDate" label="Ngày hiệu lực"
          rules={{
            required: "Chọn ngày",
            deps: ["deadline"],
            // Cùng luật với máy chủ: ngày hiệu lực (ngày chốt số liệu đối chiếu sổ) thuộc năm học của đợt.
            validate: (v: string) => !v || !yearStart || (v >= yearStart && (!nextStart || v < nextStart))
              || `Ngày hiệu lực phải trong ${yearName ?? "năm học"} (${day(yearStart)} – trước ${day(nextStart)})`,
          }} />
        <DateField control={control} name="deadline" label="Ngày kết thúc"
          rules={{ required: "Chọn ngày", validate: {
            order: notBefore("cutoffDate", "Ngày kết thúc không được trước ngày hiệu lực"),
            // Cùng luật InventoryCampaignService.MAX_MONTHS: một đợt kéo dài tối đa 12 tháng.
            span: (v: unknown, values: any) => {
              if (!v || !values?.cutoffDate) return true;
              const limit = new Date(String(values.cutoffDate));
              limit.setMonth(limit.getMonth() + 12);
              return new Date(String(v)) <= limit || "Đợt kiểm kê kéo dài tối đa 12 tháng";
            },
          } }} />
      </div>
      <TextareaField control={control} name="note" label="Nội dung" rule="LONG_TEXT" max={1000} rows={3} className="max-w-none"
        placeholder="VD: Kiểm kê toàn bộ thiết bị đang có, nộp biên bản có chữ ký hiệu trưởng" />
      {files}
    </div>
  );
}

/**
 * Phát động / sửa đợt là HỘP THOẠI hẹp trên danh sách đợt: route `create` / `edit/:id` lồng dưới danh sách, đóng hộp
 * là về danh sách. Phát động xong đẩy tệp đã chọn lên rồi mở màn đợt để theo dõi tiến độ. Hộp sửa đính kèm ngay.
 * Đợt mới thuộc năm học đang làm việc (306).
 */
function CampaignDialog({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { year, years } = useSchoolYear();
  const pending = usePendingAttachments("inventory_campaigns");
  const close = () => navigate("/inventory-campaigns", { replace: true });
  const nextStart = year ? years.filter((y) => y.startDate > year.startDate).map((y) => y.startDate).sort()[0] ?? null : null;
  const today = todayLocal();
  // Ngày hiệu lực gợi ý: hôm nay nếu nằm trong năm học, không thì ngày kết thúc năm học.
  const inYear = !!year && today >= year.startDate && (!nextStart || today < nextStart);
  const editId = mode === "edit" && id ? Number(id) : undefined;
  return (
    <FormDialog
      resource="inventory_campaigns"
      title="đợt kiểm kê"
      fullTitle={mode === "create" ? "Lập đợt kiểm kê" : "Sửa đợt kiểm kê"}
      // Lập là nháp (308): mở màn đợt để trình Lãnh đạo Sở duyệt — duyệt rồi mới phát động tới các trường.
      submitLabel={mode === "create" ? "Lưu nháp" : "Lưu thay đổi"}
      size="sm"
      state={{ open: true, id: editId }}
      onOpenChange={(open) => { if (!open) close(); }}
      defaultValues={{
        title: "", documentNo: "", cutoffDate: inYear || !year ? today : year.endDate, deadline: "", note: "",
        schoolYear: { id: year?.id ?? null },
      }}
      onSaved={async (record) => {
        if (mode !== "create" || record?.id == null) return;
        await pending.uploadTo(record.id);
        navigate(`/inventory-campaigns/show/${record.id}`);
      }}
    >
      {(control, record) => (
        <CampaignFields control={control}
          yearName={record?.schoolYear?.name ?? year?.name ?? null}
          yearStart={record?.schoolYear ? years.find((y) => y.id === record.schoolYear.id)?.startDate ?? null : year?.startDate ?? null}
          nextStart={record?.schoolYear ? null : nextStart}
          files={editId != null
            ? <AttachmentsPanel field compact resource="inventory_campaigns" recordId={editId} canWrite title="Tệp đính kèm" hint={FILE_HINT} />
            : <PendingAttachments field compact files={pending.files} onChange={pending.setFiles} title="Tệp đính kèm" hint={FILE_HINT} />} />
      )}
    </FormDialog>
  );
}

export const InventoryCampaignCreate = () => <CampaignDialog mode="create" />;
export const InventoryCampaignEdit = () => <CampaignDialog mode="edit" />;

/**
 * Chi tiết đợt và bảng tiến độ: mỗi trường trong phạm vi, phiếu kiểm kê của nó đang ở đâu. Cùng cách chia với máy chủ
 * (`campaignStageOf`); trường cần Sở xử lý trước đứng trên.
 */
const STAGE_ORDER: Record<CampaignStage, number> = { pending: 0, rejected: 1, drafting: 2, done: 3, none: 4 };
const STAGE_KEYS: CampaignStage[] = ["done", "pending", "drafting", "rejected", "none"];

export const InventoryCampaignShow = () => {
  const { result: record } = useShow<InventoryCampaign>({});
  const { result: progressResult } = useCustom<CampaignProgress>({
    url: `${API_URL}/inventory_campaigns/${record?.id}/progress`,
    method: "get",
    queryOptions: { enabled: record?.id != null },
  });
  const p = customResult(progressResult?.data, "total");
  // Số chênh lệch theo trường — chỉ của biên bản người xem mở được, cần quyền đọc phiếu kiểm kê.
  const canReadSessions = useCan({ resource: "inventory_sessions", action: "list" }).data?.can ?? false;
  const { result: diffResult } = useCustom<CampaignDiscrepancyRow[]>({
    url: `${API_URL}/inventory_campaigns/${record?.id}/discrepancies`,
    method: "get",
    queryOptions: { enabled: record?.id != null && canReadSessions },
  });
  const diffData = diffResult?.data;
  const diffs = useMemo(() => new Map((Array.isArray(diffData) ? diffData : []).map((d) => [d.schoolId, d])), [diffData]);
  const showDiffs = canReadSessions && diffs.size > 0;
  const diffTotals = useMemo(() => {
    const opened = [...diffs.values()].filter((d) => d.counts);
    return opened.length
      ? { counts: sumCounts(opened.map((d) => d.counts as DiscrepancyCounts)), surplus: opened.reduce((n, d) => n + d.surplus, 0), schools: opened.length }
      : null;
  }, [diffs]);
  const done = p ? Math.round((p.completed / Math.max(p.total, 1)) * 100) : 0;
  const [stage, setStage] = useState<CampaignStage | "all">("all");
  const [term, setTerm] = useState("");
  const all = useMemo(
    () => (p?.schools ?? []).map((s) => ({ ...s, stage: campaignStageOf(s.status) })).sort((x, y) => STAGE_ORDER[x.stage] - STAGE_ORDER[y.stage]),
    [p],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, done: 0, pending: 0, drafting: 0, rejected: 0, none: 0 };
    for (const s of all) c[s.stage]++;
    return c;
  }, [all]);
  const q = term.trim().toLowerCase();
  const rows = all.filter((s) => (stage === "all" || s.stage === stage) && (!q || s.schoolName.toLowerCase().includes(q)));
  const paged = usePagedRows(rows, { resetKey: `${stage}|${q}`, sizeKey: "campaignProgress", pageSizeLabel: "Số trường mỗi trang" });
  return (
    // Màn đợt kéo kín chiều cao vùng làm việc: thẻ tiến độ giãn tới đáy, lọc ra ít trường vẫn là một khối liền.
    <ShowView className="flex-1">
      {/* Nút theo trạng thái duyệt: nháp thì Sửa + Trình duyệt; chờ duyệt thì lãnh đạo Trả lại / Duyệt; đã duyệt thì khoá
          (fragment rỗng để khung không tự vẽ nút Sửa). */}
      <ShowViewHeader actions={record ? (
        <>
          {record._can?.write ? <EditButton recordItemId={record.id} /> : null}
          {record._can?.submit ? <CampaignStepButton campaign={record} step="submit" /> : null}
          {record._can?.approve ? <CampaignStepButton campaign={record} step="return" /> : null}
          {record._can?.approve ? <CampaignStepButton campaign={record} step="approve" /> : null}
        </>
      ) : <></>} />
      {record?.status === "DRAFT" && record.approvalNote ? (
        <section className="border-returned/25 bg-returned-subtle flex gap-3 rounded-xl border p-4">
          <span aria-hidden className="bg-returned flex size-9 shrink-0 items-center justify-center rounded-full text-white [&_svg]:size-4.5">
            <CornerUpLeft />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-returned-text font-semibold">Đợt bị Lãnh đạo Sở trả lại, cần sửa</h2>
            <p className="border-returned border-l-[3px] ps-3 text-sm break-words whitespace-pre-line">{record.approvalNote}</p>
          </div>
        </section>
      ) : null}
      <div className="flex flex-1 flex-col gap-4">
        {/* Một khối liền, cùng khuôn "Thông tin phiếu": đầu thẻ là tên đợt; giữa là các
            dòng thông tin (nhãn mờ trên, giá trị đậm dưới); cuối thẻ, ngăn bằng đường kẻ, là tệp đính kèm chạy hết bề ngang. */}
        <Card className="@container gap-0 py-0">
          <div className="grid gap-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div className="grid min-w-0 gap-1">
                <div className="text-muted-foreground text-sm">{record?.managingBody.name}</div>
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {record?.title}
                  {record ? <CampaignStateBadge campaign={record} /> : null}
                </h2>
              </div>
            </div>
            <dl className="grid gap-x-8 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-5">
              <Fact label="Năm học" value={record?.schoolYear?.name.replace(/^Năm học\s*/i, "")} />
              <Fact label="Số công văn" value={record?.documentNo} />
              <Fact label="Ngày hiệu lực" value={formatPlainDate(record?.cutoffDate)} />
              <Fact label="Ngày kết thúc" value={formatPlainDate(record?.deadline)} />
              {/* Tiến độ là một dòng thông tin như các dòng khác; số theo từng tình trạng đã có ở bộ lọc của bảng dưới. */}
              <Fact label="Đã duyệt biên bản" value={p ? `${p.completed}/${p.total} trường (${done}%)` : "…"} />
              <Fact label="Nội dung" value={record?.note} className="@md:col-span-2 @3xl:col-span-5 [&_dd]:font-normal [&_dd]:whitespace-pre-line" />
            </dl>
          </div>
          {/* Công văn, kế hoạch Sở gửi kèm: trường xem / tải về, Sở thêm bớt ngay tại đây. */}
          {record?.id != null ? (
            <div className="border-t px-5 py-4">
              <AttachmentsPanel field compact resource="inventory_campaigns" recordId={record.id}
                canWrite={!!record._can?.write} title="Tệp đính kèm" hint={FILE_HINT} />
            </div>
          ) : null}
        </Card>
        <Card className="flex flex-1 flex-col gap-0 py-0">
          {/* Lọc theo tình trạng: đợt toàn thành phố có gần nghìn trường, phần lớn "chưa bắt đầu". */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Segmented label="Lọc theo tình trạng" value={stage} onChange={setStage} size="sm"
              options={[
                { value: "all" as const, label: `Tất cả · ${counts.all ?? 0}` },
                ...STAGE_KEYS.filter((k) => k !== "rejected" || (counts.rejected ?? 0) > 0)
                  .map((k) => ({ value: k, label: `${CAMPAIGN_STAGE_LABELS[k]} · ${counts[k] ?? 0}` })),
              ]} />
            <div className="relative ms-auto w-64 max-w-full">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm trường…" className="pl-8" aria-label="Tìm trường" />
            </div>
          </div>
          <div ref={paged.boxRef} className="max-h-[35rem] overflow-y-auto [&>[data-slot=table-container]]:overflow-visible">
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0 z-10">
                <TableRow>
                  <TableHead className="px-4">Trường</TableHead>
                  <TableHead className="px-4">Phiếu kiểm kê</TableHead>
                  <TableHead className="px-4">Tình trạng</TableHead>
                  {showDiffs ? (
                    <>
                      {COUNT_HEADS.map((h) => <TableHead key={h} className="text-right">{h}</TableHead>)}
                      <TableHead className="pe-4 text-right">Thừa</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={showDiffs ? 3 + COUNT_HEADS.length + 1 : 3} loading={!p} title="Không có trường nào khớp." />
                ) : paged.visible.map((s) => (
                  <TableRow key={s.schoolId} className={cn("group/row", LIFT_ROW)}>
                    <TableCell className="px-4">{s.schoolName}</TableCell>
                    <TableCell className="px-4 font-mono text-xs">
                      {/* Biên bản còn ở trường (nháp, chờ hiệu trưởng) thì cơ quan chưa mở được — hiện số, không gắn đường dẫn. */}
                      {s.sessionId && s.canOpen ? (
                        <Link className="text-primary hover:underline" to={`/inventory-sessions/show/${s.sessionId}`}>{s.sessionCode ?? "Nháp"}</Link>
                      ) : s.sessionId ? (
                        <span className="text-muted-foreground" title="Biên bản còn ở trường — mở được khi trường duyệt xong.">{s.sessionCode ?? "Nháp"}</span>
                      ) : (
                        <span className="text-muted-foreground font-sans text-sm">Chưa lập phiếu</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      {s.status ? <VoucherStatusBadge status={s.status as VoucherStatus} /> : <span className="text-muted-foreground">{CAMPAIGN_STAGE_LABELS.none}</span>}
                      {s.facilityTotal ? (
                        <div className="text-muted-foreground mt-1 text-xs tabular-nums">Hạng mục CSVC: {s.facilityChecked ?? 0}/{s.facilityTotal}</div>
                      ) : null}
                    </TableCell>
                    {showDiffs ? (() => {
                      const d = diffs.get(s.schoolId);
                      return d?.counts ? (
                        <>
                          <CountCells row={d.counts} />
                          <TableCell className="pe-4 text-right tabular-nums">{d.surplus || <span className="text-muted-foreground">0</span>}</TableCell>
                        </>
                      ) : (
                        // Chưa có biên bản thì chưa có số đối chiếu: một dòng chữ trên cả khối cột số, không rải dấu gạch từng ô.
                        <TableCell colSpan={COUNT_HEADS.length + 1} className="text-muted-foreground pe-4 text-center text-sm">
                          {s.sessionId ? "Đang kiểm, chưa có số liệu đối chiếu" : "Chưa có số liệu đối chiếu"}
                        </TableCell>
                      );
                    })() : null}
                  </TableRow>
                ))}
                {showDiffs && diffTotals && rows.length > 0 ? (
                  <TableRow className="bg-surface-subtle font-medium">
                    <TableCell className="px-4" colSpan={3}>Cộng {diffTotals.schools} biên bản</TableCell>
                    <CountCells row={diffTotals.counts} />
                    <TableCell className="pe-4 text-right tabular-nums">{diffTotals.surplus}</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {/* Thanh lật trang ở ĐÁY thẻ (thẻ giãn kín màn), không treo ngay dưới dòng cuối của trang ít dòng. */}
          <div className="mt-auto">{paged.pager}</div>
        </Card>
      </div>
    </ShowView>
  );
};
