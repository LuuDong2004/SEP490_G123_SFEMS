import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useCan, useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
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
import { formatPlainDate, DEFAULT_PAGE_SIZE, todayLocal } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CountCells } from "@/features/organization/inventory-sessions/breakdown";
import { COUNT_HEADS, sumCounts, type CampaignDiscrepancyRow, type CampaignProgress, type DiscrepancyCounts, type InventoryCampaign } from "@/domains/inventory/types";
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
      h.display({ id: "body", header: "Cơ quan phát động", cell: ({ row }) => row.original.managingBody.name }),
      h.accessor("cutoffDate", { id: "cutoffDate", header: "Chốt số liệu", enableSorting: true, cell: ({ getValue }) => formatPlainDate(getValue()) }),
      h.accessor("deadline", {
        id: "deadline",
        header: "Hạn nộp",
        enableSorting: true,
        cell: ({ row }) => (
          <span className={row.original.overdue ? "text-destructive" : undefined}>{formatPlainDate(row.original.deadline)}</span>
        ),
      }),
      h.display({
        id: "state",
        header: "Tình trạng",
        cell: ({ row }) => (row.original.closed ? <Badge variant="neutral">Đã đóng</Badge> : <Badge variant="info">Đang mở</Badge>),
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
  const table = useTable<InventoryCampaign>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    refineCoreProps: { syncWithLocation: true, pagination: { pageSize: DEFAULT_PAGE_SIZE } },
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

function CampaignFields({ control, creating }: { control: any; creating: boolean }) {
  // Lưới chuẩn của hộp thoại: 2 cột — tên và hướng dẫn chiếm 2 cột, hai ngày mỗi ô 1 cột.
  return (
    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
      {creating ? (
        <p className="bg-warning-subtle text-warning-text rounded-md px-3 py-2 text-sm sm:col-span-2">
          Trường đang kiểm kê cả trường hoặc một phòng sẽ phải hoàn tất đợt hiện tại trước khi lập biên bản cho đợt mới.
        </p>
      ) : null}
      <TextField control={control} name="title" label="Tên đợt" rule="NAME" rules={{ required: "Nhập tên đợt" }}
        placeholder="VD: Kiểm kê cuối năm học 2025-2026" className="sm:col-span-2" />
      <DateField control={control} name="cutoffDate" label="Ngày chốt số liệu" rules={{ required: "Chọn ngày", deps: ["deadline"] }} />
      <DateField control={control} name="deadline" label="Hạn các trường nộp biên bản"
        rules={{ required: "Chọn ngày", validate: notBefore("cutoffDate", "Hạn nộp không được trước ngày chốt số liệu") }} />
      <TextareaField control={control} name="note" label="Hướng dẫn gửi các trường" rule="LONG_TEXT" max={1000} rows={4} className="max-w-none sm:col-span-2"
        placeholder="VD: Kiểm kê toàn bộ thiết bị còn trong hệ thống, nộp biên bản có chữ ký hiệu trưởng" />
    </div>
  );
}

/**
 * Phát động / sửa đợt là HỘP THOẠI trên danh sách đợt (ít ô — cùng khuôn với các phiếu ít ô): route
 * `create` / `edit/:id` lồng dưới danh sách, đóng hộp là về danh sách. Phát động xong mở màn đợt để theo dõi tiến độ.
 */
function CampaignDialog({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const close = () => navigate("/inventory-campaigns", { replace: true });
  return (
    <FormDialog
      resource="inventory_campaigns"
      title="đợt kiểm kê"
      fullTitle={mode === "create" ? "Phát động đợt kiểm kê" : "Sửa đợt kiểm kê"}
      submitLabel="Phát động"
      state={{ open: true, id: mode === "edit" && id ? Number(id) : undefined }}
      onOpenChange={(open) => { if (!open) close(); }}
      defaultValues={{ title: "", cutoffDate: todayLocal(), deadline: "", note: "" }}
      onSaved={(record) => { if (mode === "create" && record?.id != null) navigate(`/inventory-campaigns/show/${record.id}`); }}
    >
      {(control) => <CampaignFields control={control} creating={mode === "create"} />}
    </FormDialog>
  );
}

export const InventoryCampaignCreate = () => <CampaignDialog mode="create" />;
export const InventoryCampaignEdit = () => <CampaignDialog mode="edit" />;

/**
 * Chi tiết đợt và bảng tiến độ: mỗi trường trong phạm vi, phiếu kiểm kê của nó
 * đang ở đâu. Chỉ các trường người xem được thấy — UBND xem đợt toàn thành phố
 * thì chỉ thấy trường trên địa bàn mình.
 */
/** Trường đang ở đâu trong đợt, suy từ phiếu kiểm kê của nó. */
type Stage = "done" | "pending" | "drafting" | "none";
const stageOf = (status?: string | null): Stage =>
  !status ? "none" : status === "APPROVED" || status === "COMPLETED" ? "done" : status === "PENDING" ? "pending" : "drafting";
const STAGES: { key: Stage | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "done", label: "Đã duyệt" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "drafting", label: "Đang kiểm" },
  { key: "none", label: "Chưa bắt đầu" },
];
/** Trường cần cơ quan xử lý trước đứng trên: chờ duyệt, đang kiểm, đã duyệt, rồi mới tới chưa bắt đầu. */
const STAGE_ORDER: Record<Stage, number> = { pending: 0, drafting: 1, done: 2, none: 3 };

export const InventoryCampaignShow = () => {
  const { result: record } = useShow<InventoryCampaign>({});
  const { data } = useQuery({
    queryKey: ["inventory_campaigns", record?.id, "progress"],
    enabled: record?.id != null,
    queryFn: ({ signal }) => kyInstance.get(`inventory_campaigns/${record?.id}/progress`, { signal }).json<CampaignProgress>(),
  });
  const p = data && typeof data === "object" && "total" in data ? data : undefined;
  // Số chênh lệch theo trường — chỉ của biên bản người xem mở được, cần quyền đọc phiếu kiểm kê.
  const canReadSessions = useCan({ resource: "inventory_sessions", action: "list" }).data?.can ?? false;
  const { data: diffData } = useQuery({
    queryKey: ["inventory_campaigns", record?.id, "discrepancies"],
    enabled: record?.id != null && canReadSessions,
    queryFn: ({ signal }) => kyInstance.get(`inventory_campaigns/${record?.id}/discrepancies`, { signal }).json<CampaignDiscrepancyRow[]>(),
  });
  const diffs = useMemo(() => new Map((Array.isArray(diffData) ? diffData : []).map((d) => [d.schoolId, d])), [diffData]);
  const showDiffs = canReadSessions && diffs.size > 0;
  const diffTotals = useMemo(() => {
    const opened = [...diffs.values()].filter((d) => d.counts);
    return opened.length
      ? { counts: sumCounts(opened.map((d) => d.counts as DiscrepancyCounts)), surplus: opened.reduce((n, d) => n + d.surplus, 0), schools: opened.length }
      : null;
  }, [diffs]);
  const done = p ? Math.round((p.completed / Math.max(p.total, 1)) * 100) : 0;
  const [stage, setStage] = useState<Stage | "all">("all");
  const [term, setTerm] = useState("");
  const all = useMemo(
    () => (p?.schools ?? []).map((s) => ({ ...s, stage: stageOf(s.status) })).sort((x, y) => STAGE_ORDER[x.stage] - STAGE_ORDER[y.stage]),
    [p],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, done: 0, pending: 0, drafting: 0, none: 0 };
    for (const s of all) c[s.stage]++;
    return c;
  }, [all]);
  const q = term.trim().toLowerCase();
  const rows = all.filter((s) => (stage === "all" || s.stage === stage) && (!q || s.schoolName.toLowerCase().includes(q)));
  return (
    <ShowView>
      <ShowViewHeader />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardDescription>{record?.managingBody.name}</CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
              {record?.title}
              {record ? <Badge variant={record.closed ? "neutral" : "info"}>{record.closed ? "Đã đóng" : "Đang mở"}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="text-sm font-medium"><div className="text-muted-foreground text-xs font-normal">Chốt số liệu</div>{formatPlainDate(record?.cutoffDate)}</div>
            <div className="text-sm font-medium"><div className="text-muted-foreground text-xs font-normal">Hạn nộp</div>{formatPlainDate(record?.deadline)}</div>
            <div className="text-sm font-medium">
              <div className="text-muted-foreground text-xs font-normal">Đã duyệt biên bản</div>
              {p ? `${p.completed}/${p.total} trường (${done}%)` : "…"}
            </div>
            {record?.note ? <div className="sm:col-span-3 whitespace-pre-line text-sm">{record.note}</div> : null}
            <Progress value={done} className="sm:col-span-3" />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          {/* Lọc theo tình trạng: đợt toàn thành phố có gần nghìn trường, phần lớn "chưa bắt đầu". */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            {STAGES.map((s) => (
              <Button key={s.key} type="button" size="sm" variant={stage === s.key ? "default" : "outline"} className="rounded-full" onClick={() => setStage(s.key)}>
                {s.label}
                <span className="tabular-nums opacity-70">{counts[s.key] ?? 0}</span>
              </Button>
            ))}
            <div className="relative ms-auto w-64 max-w-full">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm trường…" className="pl-8" aria-label="Tìm trường" />
            </div>
          </div>
          <div className="max-h-[35rem] overflow-y-auto">
            <Table>
              <TableHeader>
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
                  <TableEmpty colSpan={showDiffs ? 10 : 3} loading={!p} title="Không có trường nào khớp." />
                ) : rows.map((s) => (
                  <TableRow key={s.schoolId} className={cn("group/row", LIFT_ROW)}>
                    <TableCell className="px-4">{s.schoolName}</TableCell>
                    <TableCell className="px-4 font-mono text-xs">
                      {/* Biên bản còn ở trường (nháp, chờ hiệu trưởng) thì cơ quan chưa mở được — hiện số, không gắn đường dẫn. */}
                      {s.sessionId && s.canOpen ? (
                        <Link className="text-primary hover:underline" to={`/inventory-sessions/show/${s.sessionId}`}>{s.sessionCode ?? "Nháp"}</Link>
                      ) : s.sessionId ? (
                        <span className="text-muted-foreground" title="Biên bản còn ở trường — mở được khi trường duyệt xong.">{s.sessionCode ?? "Nháp"}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      {s.status ? <VoucherStatusBadge status={s.status as VoucherStatus} /> : <span className="text-muted-foreground">Chưa bắt đầu</span>}
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
                        <TableCell colSpan={7} className="text-muted-foreground pe-4 text-right">—</TableCell>
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
        </Card>
      </div>
    </ShowView>
  );
};
