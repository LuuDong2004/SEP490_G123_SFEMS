import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRightLeft, BookOpen, ShoppingCart, CircleAlert, CircleCheck, CircleDot, Download, Ellipsis, Gauge, History, ListChecks, Lock, MapPin,
  Search, SlidersHorizontal, Trash2, TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { StatTile } from "@/shared/components/charts/charts";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { QueryError } from "@/shared/components/query-error";
import { errorMessage } from "@/shared/lib/api-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { ADJUST_KIND_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SCHOOL_ADJUST_LABELS, type YearRow, type YearStandard } from "@/domains/school-year/types";

import { AdjustDialog, AdjustHistoryDialog } from "./adjust-dialog";
import { SurplusDialog } from "./gap-dialogs";
import { useSchoolYear } from "@/shared/hooks/use-school-year";

const num = new Intl.NumberFormat("vi-VN");
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const QK = "year_standards";

type View = "all" | "shortTt" | "shortAdj" | "adjusted" | "outside" | "expired";

export function useYearStandard(schoolId: number | null | undefined, yearId: number | null, campusId: number | null) {
  return useQuery({
    queryKey: [QK, schoolId ?? "own", yearId, campusId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get(QK, {
      signal,
      timeout: 60_000,
      searchParams: {
        yearId: String(yearId),
        ...(schoolId ? { schoolId: String(schoolId) } : {}),
        ...(campusId != null ? { campusId: String(campusId) } : {}),
      },
    }).json<YearStandard>(),
  });
}

/** Đủ / thiếu một cột: "Đủ" xanh, "Thiếu n" đỏ, chưa tính được "—". */
function Gap({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return value === 0 ? <span className="text-success-text font-medium">Đủ</span>
    : <span className="text-destructive-text font-medium tabular-nums">Thiếu {num.format(value)}</span>;
}

/**
 * Chuẩn tối thiểu theo năm học của MỘT trường (màn D): ô chọn năm học và điểm trường; hai cột theo thông tư / theo điều
 * chỉnh, tỷ lệ đáp ứng hai số. Cả trường = cộng các điểm trường. Năm đã chốt đọc bản chốt (dải xanh), năm cũ chưa chốt
 * tính lại (dải vàng). Trường áp dụng điều chỉnh trên từng dòng (khi đã chọn một điểm trường).
 */
export function YearStandardView({ schoolId, onBack }: { schoolId?: number | null; onBack?: () => void }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { id: yearId } = useSchoolYear();
  const [campusId, setCampusId] = useState<number | null>(null);
  const { data: d, isLoading, isError, error, refetch, isFetching } = useYearStandard(schoolId, yearId, campusId);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [subject, setSubject] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Đổi năm trên header thì về trang 1 của bảng.
  useEffect(() => setPage(1), [yearId]);
  const [pageSize, setPageSize] = useState(50);
  const [adjusting, setAdjusting] = useState<YearRow | null>(null);
  const [history, setHistory] = useState<YearRow | null>(null);
  const [removing, setRemoving] = useState<YearRow | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  // Xử lý dòng thiếu (bước 5): chỉ trường mình — đưa vào đề xuất mua sắm, điều chuyển nội bộ giữa các điểm trường.
  const own = !schoolId;
  const canPropose = (useCan({ resource: "purchase_proposals", action: "create" }).data?.can ?? false) && own;
  const canTransfer = own;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [transferring, setTransferring] = useState<YearRow | null>(null);

  const rows = useMemo(() => d?.rows ?? [], [d]);
  const subjects = useMemo(() => [...new Set(rows.map((r) => r.subjectName ?? "Dùng chung"))], [rows]);
  const term = fold(q.trim());
  const shown = rows
    .filter((r) => !subject || (r.subjectName ?? "Dùng chung") === subject)
    .filter((r) => view === "all"
      || (view === "shortTt" && (r.shortageTt ?? 0) > 0)
      || (view === "shortAdj" && (r.shortageAdjusted ?? 0) > 0)
      || (view === "adjusted" && r.adjustment && r.adjustment.kind !== "OUTSIDE" && r.adjustment.status !== "EXPIRED")
      || (view === "outside" && r.adjustment?.kind === "OUTSIDE" && r.adjustment.status !== "EXPIRED")
      || (view === "expired" && r.adjustment?.status === "EXPIRED"))
    .filter((r) => !term || fold(`${r.name} ${r.catalogCode ?? ""} ${r.normCode}`).includes(term));
  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);
  const multi = (d?.campuses.length ?? 0) > 1;
  const showOutside = rows.some((r) => r.outsideNeed != null);
  const refresh = () => qc.invalidateQueries({ queryKey: [QK] });
  const needs = (r: YearRow) => (r.shortageAdjusted ?? 0) > 0 || (r.adjustment?.kind === "OUTSIDE" && r.adjustment.status !== "EXPIRED");
  const toProposal = async (normIds: number[]) => {
    if (!d) return;
    setBusy(true);
    try {
      const r = await kyInstance.post("year_standards/proposal", {
        json: { schoolYearId: d.schoolYearId, lines: normIds.map((normId) => ({ normId, campusId: d.campusId })) },
      }).json<{ proposalId: number; lines: number }>();
      notify?.({ type: "success", message: `Đã lập đề xuất mua sắm nháp ${r.lines} dòng` });
      setSelected(new Set());
      navigate(`/purchase-proposals/edit/${r.proposalId}`);
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const post = async (path: string, ok: string) => {
    setBusy(true);
    try {
      await kyInstance.post(path).json();
      notify?.({ type: "success", message: ok });
      await refresh();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing?.adjustment) return;
    setBusy(true);
    try {
      await kyInstance.delete(`school_norm_adjustments/${removing.adjustment.id}`).json();
      setRemoving(null);
      await refresh();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    if (!d) return;
    const head = ["Mã TB danh mục", "Thiết bị", "Môn", "Điểm trường", "Chuẩn TT", "Theo điều chỉnh", "Đang có", "Hỏng", "Mất",
      "Chờ ghi giảm", "Thiếu theo TT", "Thiếu theo điều chỉnh", "Ngoài TT", "Điều chỉnh", "Lý do"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = shown.map((r) => [r.catalogCode ?? r.normCode, r.name, r.subjectName, r.campusName ?? "Cả trường", r.requiredTt,
      r.requiredAdjusted, r.current, r.broken, r.lost, r.pendingDisposal, r.shortageTt, r.shortageAdjusted, r.outsideNeed,
      r.adjustment ? SCHOOL_ADJUST_LABELS[r.adjustment.kind] : "", r.adjustment?.reason].map(cell).join(","));
    const blob = new Blob(["﻿" + [head.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `Chuẩn tối thiểu - ${d.schoolName} - ${d.schoolYearName}.csv`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (isError && !d) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  const cols = 9 + (showOutside ? 1 : 0) + (canPropose ? 1 : 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Về bảng tổng hợp">
            <ArrowLeft />
          </Button>
        ) : null}
        {onBack && d ? <span className="me-1 font-semibold">{d.schoolName}</span> : null}
        {multi && d ? (
          <IconFilter labeled icon={<MapPin />} label="điểm trường" prefix="Điểm trường" allLabel="Cả trường"
            value={campusId == null ? null : String(campusId)} onChange={(v) => { setCampusId(v == null ? null : Number(v)); setPage(1); }}
            groups={[{ items: d.campuses.filter((c) => c.id != null).map((c) => ({ key: String(c.id), label: c.name })) }]} />
        ) : null}
        <div className="relative w-full min-w-0 sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm thiết bị…" className="ps-9" />
        </div>
        <IconFilter icon={<CircleDot />} label="tình trạng" allLabel="Tất cả" total={rows.length} value={view === "all" ? null : view}
          onChange={(v) => { setView((v ?? "all") as View); setPage(1); }}
          groups={[{ items: [
            { key: "shortTt", label: "Thiếu theo thông tư", count: rows.filter((r) => (r.shortageTt ?? 0) > 0).length },
            { key: "shortAdj", label: "Thiếu theo điều chỉnh", count: rows.filter((r) => (r.shortageAdjusted ?? 0) > 0).length },
            { key: "adjusted", label: "Có điều chỉnh", count: d?.adjusted },
            { key: "outside", label: "Ngoài thông tư", count: d?.outside },
            { key: "expired", label: "Điều chỉnh hết hiệu lực", count: rows.filter((r) => r.adjustment?.status === "EXPIRED").length },
          ] }]} />
        <IconFilter icon={<BookOpen />} label="môn" allLabel="Mọi môn" value={subject} onChange={(v) => { setSubject(v); setPage(1); }}
          groups={[{ items: subjects.map((s) => ({ key: s, label: s })) }]} />
        <span className="flex-1" />
        {canPropose && selected.size ? (
          <Button type="button" disabled={busy} onClick={() => void toProposal([...selected])}>
            <ShoppingCart />
            Đưa {selected.size} dòng vào đề xuất
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={!d} onClick={exportCsv}>
          <Download />
          Xuất CSV
        </Button>
      </div>
      {d?.source === "CLOSED" ? (
        <div className="bg-success-subtle text-success-text flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
          <Lock className="size-4" />
          Đã chốt {d.closedAt} — số liệu theo bản chốt
        </div>
      ) : d?.source === "RECOMPUTED" ? (
        <div className="bg-warning-subtle text-warning-text flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
          <TriangleAlert className="size-4" />
          Chưa chốt — tính lại theo lớp, phân công của năm học và thiết bị tại ngày cuối năm học; phòng theo hiện tại
        </div>
      ) : null}
      {d ? (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <StatTile flat icon={<ListChecks />} label="Thiết bị phải có" value={<WithUnit value={num.format(d.counted)} unit="loại" />} />
            <StatTile flat tone="success" icon={<CircleCheck />} label="Đáp ứng theo TT · theo điều chỉnh"
              value={<span className="tabular-nums">{d.percentTt}% · {d.percentAdjusted}%</span>} />
            <StatTile flat tone="destructive" icon={<CircleAlert />} label="Còn thiếu theo điều chỉnh"
              value={<WithUnit value={num.format(d.shortageAdjusted)} unit={`chiếc (TT: ${num.format(d.shortageTt)})`} />} />
            <StatTile flat tone="warning" icon={<SlidersHorizontal />} label="Điều chỉnh · ngoài TT"
              value={<span className="tabular-nums">{d.adjusted} · {d.outside}</span>} />
          </div>
        </Card>
      ) : null}
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canPropose ? (
                  <TableHead className="w-10">
                    <Checkbox aria-label="Chọn mọi dòng thiếu đang lọc" checked={shown.some(needs) && shown.filter(needs).every((r) => selected.has(r.normId))}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(shown.filter(needs).map((r) => r.normId)) : new Set())} />
                  </TableHead>
                ) : null}
                <TableHead className="min-w-[14rem]">Thiết bị</TableHead>
                <TableHead className="text-right">Chuẩn TT</TableHead>
                <TableHead className="text-right">Theo điều chỉnh</TableHead>
                {showOutside ? <TableHead className="text-right">Ngoài TT</TableHead> : null}
                <TableHead className="text-right">Đang có</TableHead>
                <TableHead className="text-right">Hỏng / mất</TableHead>
                <TableHead className="text-right">Chờ ghi giảm</TableHead>
                <TableHead>Theo TT</TableHead>
                <TableHead>Theo điều chỉnh</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !d ? <TableSkeletonRows cols={cols} /> : shown.length === 0 ? (
                <TableEmpty colSpan={cols} icon={<Gauge />} filtered={rows.length > 0}
                  title={rows.length ? "Không có thiết bị khớp bộ lọc" : "Chưa có danh mục tối thiểu cho cấp học này"} />
              ) : pageRows.map((r, i) => {
                const prev = pageRows[i - 1];
                const group = (r.subjectName ?? "Dùng chung") !== (prev ? prev.subjectName ?? "Dùng chung" : null);
                const adj = r.adjustment;
                const canAct = d.canAdjust;
                return [
                  group ? (
                    <TableRow key={`g-${r.normId}`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={cols} className="py-1.5 text-xs font-semibold tracking-wide uppercase">
                        {r.subjectName ?? "Dùng chung"}
                      </TableCell>
                    </TableRow>
                  ) : null,
                  <TableRow key={`${r.campusId ?? "all"}-${r.normId}`} className={cn("group/row", LIFT_ROW)}>
                    {canPropose ? (
                      <TableCell>
                        {needs(r) ? (
                          <Checkbox aria-label={`Chọn ${r.name}`} checked={selected.has(r.normId)}
                            onCheckedChange={(v) => setSelected((p) => {
                              const n = new Set(p);
                              if (v === true) n.add(r.normId); else n.delete(r.normId);
                              return n;
                            })} />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell className="max-w-[24rem]">
                      <div className="truncate font-medium" title={r.name}>{r.name}</div>
                      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="font-mono">{r.catalogCode ?? r.normCode}</span>
                        {adj ? (
                          <Badge variant={adj.status === "EXPIRED" ? "destructive" : adj.status === "PENDING_RECONFIRM" ? "warning" : ADJUST_KIND_VARIANTS[adj.kind]}
                            title={adj.reason}>
                            {adj.status === "EXPIRED" ? "Hết hiệu lực — chọn lại" : SCHOOL_ADJUST_LABELS[adj.kind]}
                            {adj.status === "PENDING_RECONFIRM" ? " · chờ xác nhận lại" : ""}
                          </Badge>
                        ) : null}
                        {r.warning ? <span className="text-warning-text truncate" title={r.warning}>{r.warning}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.requiredTt == null ? "—" : num.format(r.requiredTt)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.requiredAdjusted !== r.requiredTt && "text-primary font-semibold")}>
                      {r.requiredAdjusted == null ? "—" : num.format(r.requiredAdjusted)}
                    </TableCell>
                    {showOutside ? <TableCell className="text-right tabular-nums">{r.outsideNeed == null ? "" : num.format(r.outsideNeed)}</TableCell> : null}
                    <TableCell className="text-right tabular-nums">{num.format(r.current)}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">{r.broken} / {r.lost}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">{r.pendingDisposal || ""}</TableCell>
                    <TableCell><Gap value={r.shortageTt} /></TableCell>
                    <TableCell><Gap value={r.shortageAdjusted} /></TableCell>
                    <TableCell className="py-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Thao tác">
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {canAct ? (
                            <DropdownMenuItem onSelect={() => setAdjusting(r)}>
                              <SlidersHorizontal />
                              {r.allowedKind === "NONE" ? "Nhu cầu ngoài thông tư" : adj && adj.status !== "EXPIRED" ? "Sửa điều chỉnh" : "Điều chỉnh"}
                            </DropdownMenuItem>
                          ) : null}
                          {canAct && adj?.status === "PENDING_RECONFIRM" ? (
                            <DropdownMenuItem disabled={busy} onSelect={() => void post(`school_norm_adjustments/${adj.id}/reconfirm`, "Đã xác nhận lại điều chỉnh")}>
                              <CircleCheck />
                              Xác nhận lại
                            </DropdownMenuItem>
                          ) : null}
                          {canAct && adj ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(r)}>
                              <Trash2 />
                              Bỏ điều chỉnh
                            </DropdownMenuItem>
                          ) : null}
                          {canPropose && needs(r) ? (
                            <DropdownMenuItem disabled={busy} onSelect={() => void toProposal([r.normId])}>
                              <ShoppingCart />
                              Đưa vào đề xuất mua sắm
                            </DropdownMenuItem>
                          ) : null}
                          {canTransfer && multi && d.campusId != null && d.current && (r.shortageAdjusted ?? 0) > 0 ? (
                            <DropdownMenuItem onSelect={() => setTransferring(r)}>
                              <ArrowRightLeft />
                              Điểm trường thừa
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onSelect={() => setHistory(r)}>
                            <History />
                            Lịch sử điều chỉnh
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>,
                ];
              })}
            </TableBody>
          </Table>
        </div>
        {shown.length > pageSize || page > 1 ? (
          <div className="border-t px-3 py-2">
            <DataTablePagination currentPage={page} pageCount={Math.max(1, Math.ceil(shown.length / pageSize))}
              setCurrentPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={shown.length}
              pageSizeLabel="Số thiết bị mỗi trang" />
          </div>
        ) : null}
      </div>
      {adjusting && d ? (
        <AdjustDialog row={adjusting} yearId={d.schoolYearId} campusId={d.campusId}
          onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); void refresh(); }} />
      ) : null}
      {transferring && d?.campusId != null ? (
        <SurplusDialog row={transferring} campusId={d.campusId} onClose={() => setTransferring(null)} />
      ) : null}
      {history && d ? (
        <AdjustHistoryDialog row={history} schoolId={schoolId ?? null} campusId={d.campusId} onClose={() => setHistory(null)} />
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing ? (
          <ConfirmContent tone="danger" title={`Bỏ điều chỉnh "${removing.name}"?`} description="Dòng tính lại theo thông tư."
            cancelLabel="Không bỏ" confirmLabel="Bỏ điều chỉnh" busy={busy} onConfirm={() => void remove()} />
        ) : null}
      </AlertDialog>
    </div>
  );
}
