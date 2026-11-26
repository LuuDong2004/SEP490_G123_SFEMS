import { useCan, useGetIdentity, useNotification } from "@refinedev/core";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { useSettled } from "@/shared/hooks/use-settled";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime, formatPlainDate } from "@/shared/lib/format";
import { safeDownloadName } from "@/shared/lib/download-filename";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { LoadingText } from "@/shared/components/spinner";

type SnapshotRow = {
  id: number; reportName: string; title: string; subtitle: string | null; rowCount: number; note: string | null;
  level: string; createdByName: string | null; createdById: number | null; createdAt: string;
};
type Column = { key: string; label: string; type: string };
type Snapshot = SnapshotRow & { columns: Column[]; rows: Record<string, unknown>[] };

const number = new Intl.NumberFormat("vi-VN", { useGrouping: false });
// Số đếm, số lượng không có dấu ngăn nghìn (trưởng nhóm 24/11/2026). Tiền vẫn có: 2.500.000.000 đ dễ đọc hơn 2500000000.
const money = new Intl.NumberFormat("vi-VN");
const cell = (v: unknown, type: string) => {
  if (v == null || v === "") return "";
  if (type === "money") return money.format(Number(v));
  if (type === "number") return number.format(Number(v));
  if (type === "date") return formatPlainDate(String(v));
  return String(v);
};
const LEVEL_LABELS: Record<string, string> = { CITY: "Cấp Sở", BODY: "Cơ quan quản lý", SCHOOL: "Trường" };

/**
 * Hộp "Lưu bản số liệu" của màn báo cáo (mở từ menu ⚙): chụp lại số liệu đúng lúc lập, với đúng bộ lọc đang
 * xem, kèm ghi chú (vd "Nộp Sở quý III"). Bản lưu không sửa được — mở lại ở "Báo cáo đã lưu".
 */
export function SaveSnapshotDialog({ name, params, open, onOpenChange: setOpen }: {
  name: string;
  params: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { open: notify } = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Mỗi lần mở là một ghi chú mới.
  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  async function save() {
    setBusy(true);
    try {
      const r = await kyInstance.post(`reports/${name}/snapshots`, { searchParams: params, json: { note } }).json<SnapshotRow>();
      await queryClient.invalidateQueries({ queryKey: ["report_snapshots"] });
      setOpen(false);
      notify?.({ type: "success", message: `Đã lưu bản báo cáo (${number.format(r.rowCount)} dòng)` });
      navigate(`/report-snapshots/show/${r.id}`);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Lưu bản số liệu</DialogTitle>
            <DialogDescription>Chụp lại số liệu đúng lúc này, với bộ lọc đang chọn. Bản lưu không sửa được; xem lại ở "Báo cáo đã lưu".</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="snapshot-note">Ghi chú</Label>
            <Input id="snapshot-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Vd: Nộp Sở quý III/2026" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Huỷ</Button>
            <Button type="button" onClick={() => void save()} disabled={busy}>Lưu bản này</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}

/** Danh sách báo cáo đã lưu mà người xem được phép thấy (theo nơi lập). */
export const ReportSnapshotList = () => {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("reportSnapshots.pageSize", 20, "local");
  const needle = useSettled(q.trim(), 300);
  useEffect(() => setPage(1), [needle, pageSize]);
  const { data, isLoading } = useQuery({
    queryKey: ["report_snapshots", "list", needle, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await kyInstance.get("report_snapshots", { signal,
        searchParams: { _start: String((page - 1) * pageSize), _end: String(page * pageSize), ...(needle ? { q: needle } : {}) } });
      return { rows: await res.json<SnapshotRow[]>(), total: Number(res.headers.get("X-Total-Count") ?? 0) };
    },
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <ListView>
      <ListViewHeader canCreate={false} />
      <FillBox>
      <Card className="min-h-0 flex-1 gap-3 px-4 py-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên báo cáo, ghi chú, người lập…" className="max-w-sm" />
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead>Lưu lúc</TableHead><TableHead>Báo cáo</TableHead><TableHead>Ghi chú</TableHead>
                <TableHead>Người lập</TableHead><TableHead className="text-right">Số dòng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={5} loading={isLoading} filtered={!!q.trim()}
                  title={q.trim() ? undefined : "Chưa có bản báo cáo nào được lưu"}
                  description={q.trim() ? undefined : "Mở một báo cáo, bấm ⚙ rồi \"Lưu bản số liệu\"."} />
              ) : null}
              {rows.map((r) => (
                <TableRow key={r.id} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <Link to={`/report-snapshots/show/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    {r.subtitle ? <div className="text-muted-foreground text-xs">{r.subtitle}</div> : null}
                  </TableCell>
                  <TableCell>{r.note ?? <span className="text-muted-foreground">Không có ghi chú</span>}</TableCell>
                  <TableCell>
                    {r.createdByName ?? <span className="text-muted-foreground">Không rõ</span>}
                    <Badge variant="outline" className="ms-1.5">{LEVEL_LABELS[r.level] ?? r.level}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{number.format(r.rowCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {total > 10 ? (
            <div className="-mx-4 -mb-4 shrink-0 border-t px-3 py-1.5">
              <DataTablePagination currentPage={page} pageCount={pageCount} setCurrentPage={setPage} pageSize={pageSize}
                setPageSize={setPageSize} total={total} pageSizeLabel="Số bản mỗi trang" />
            </div>
          ) : null}
      </Card>
      </FillBox>
    </ListView>
  );
};

/** Một bản đã lưu: đúng số liệu lúc lưu, In / Xuất Excel không tính lại. */
export const ReportSnapshotShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const { data: me } = useGetIdentity<{ id: number }>();
  const mayExport = useCan({ resource: "reports", action: "export" }).data?.can ?? true;
  const [removing, setRemoving] = useState(false);
  const { data: s } = useQuery({ queryKey: ["report_snapshots", "one", id], queryFn: ({ signal }) => kyInstance.get(`report_snapshots/${id}`, { signal }).json<Snapshot>() });

  async function exportXlsx() {
    const blob = await kyInstance.get(`report_snapshots/${id}/export`, { timeout: DOWNLOAD_TIMEOUT }).blob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${safeDownloadName(s?.title)} - bản lưu ${id}.xlsx` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function remove() {
    try {
      await kyInstance.delete(`report_snapshots/${id}`).json();
      await queryClient.invalidateQueries({ queryKey: ["report_snapshots"] });
      notify?.({ type: "success", message: "Đã xoá bản lưu" });
      navigate("/report-snapshots");
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    }
  }

  const numericIdx = (s?.columns ?? []).map((c, i) => (c.type === "number" || c.type === "money" ? i : -1)).filter((i) => i >= 0);
  return (
    <ListView>
      <div className="print:hidden">
        <ListViewHeader canCreate={false}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {mayExport ? <Button type="button" variant="outline" disabled={!s} onClick={() => void exportXlsx()}><FileSpreadsheet />Xuất Excel</Button> : null}
              {s && me && s.createdById === me.id ? (
                <Button type="button" variant="ghost" onClick={() => setRemoving(true)}><Trash2 />Xoá bản lưu</Button>
              ) : null}
            </div>
          } />
      </div>
      {s ? (
        <>
          <PrintSheet title={s.title} subtitle={`${s.subtitle ?? ""} · Bản lưu lúc ${formatDateTime(s.createdAt)}`}
            table={{ headers: s.columns.map((c) => c.label), alignRight: numericIdx, rows: s.rows.map((r) => s.columns.map((c) => cell(r[c.key], c.type))) }}
            signers={["Người lập biểu", "Thủ trưởng đơn vị"]} />
          <Card className="gap-3 px-4 py-4 print:hidden">
            <div>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="text-muted-foreground text-sm">
                {s.subtitle ? `${s.subtitle} · ` : ""}Lưu lúc {formatDateTime(s.createdAt)} bởi {s.createdByName ?? "người dùng không rõ"}
                {s.note ? <> · <span className="text-foreground">{s.note}</span></> : null}
              </p>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>{s.columns.map((c) => <TableHead key={c.key} className={numericIdx.includes(s.columns.indexOf(c)) ? "text-right" : undefined}>{c.label}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {s.rows.map((r, i) => (
                    <TableRow key={i} className={cn("group/row", LIFT_ROW)}>
                      {s.columns.map((c) => (
                        <TableCell key={c.key} className={c.type === "number" || c.type === "money" ? "text-right tabular-nums" : undefined}>{cell(r[c.key], c.type)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : <LoadingText />}
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <ConfirmContent tone="danger" title="Xoá bản báo cáo đã lưu?" description="Bản lưu mất hẳn; số liệu sống của báo cáo không đổi."
          cancelLabel="Không xoá" confirmLabel="Xoá" onConfirm={() => { setRemoving(false); void remove(); }} />
      </AlertDialog>
    </ListView>
  );
};
