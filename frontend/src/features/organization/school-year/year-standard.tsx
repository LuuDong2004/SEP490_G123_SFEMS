import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ShoppingCart,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  FileSpreadsheet,
  Loader2,
  Gauge,
  History,
  ListChecks,
  Lock,
  MapPin,
  Filter,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { StatTile } from "@/shared/components/charts/charts";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { downloadXlsx, type XlsxColumn } from "@/shared/api/xlsx-export";
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
import { useSchoolYear } from "@/shared/hooks/use-school-year";

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const QK = "year_standards";

type View = "all" | "shortTt" | "shortAdj" | "full" | "adjusted" | "outside" | "expired";

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
/** Cột số của bảng chuẩn: cùng bề rộng, căn phải. */
const NUM_COL = "w-32 text-right";

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
  // Xử lý dòng thiếu (bước 5): chỉ trường mình — đưa vào đề xuất mua sắm.
  const own = !schoolId;
  const canPropose = (useCan({ resource: "purchase_proposals", action: "create" }).data?.can ?? false) && own;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Dòng đã tích thuộc bảng đang xem: đổi điểm trường / năm học thì bỏ chọn — không mang dòng của điểm này sang điểm khác.
  useEffect(() => setSelected(new Set()), [campusId, yearId]);

  const rows = useMemo(() => d?.rows ?? [], [d]);
  const subjects = useMemo(() => [...new Set(rows.map((r) => r.subjectName ?? "Dùng chung"))], [rows]);
  const term = fold(q.trim());
  const shown = rows
    .filter((r) => !subject || (r.subjectName ?? "Dùng chung") === subject)
    .filter((r) => view === "all"
      || (view === "shortTt" && (r.shortageTt ?? 0) > 0)
      || (view === "shortAdj" && (r.shortageAdjusted ?? 0) > 0)
      || (view === "full" && r.shortageAdjusted === 0)
      || (view === "adjusted" && r.adjustment && r.adjustment.kind !== "OUTSIDE" && r.adjustment.status !== "EXPIRED")
      || (view === "outside" && r.adjustment?.kind === "OUTSIDE" && r.adjustment.status !== "EXPIRED")
      || (view === "expired" && r.adjustment?.status === "EXPIRED"))
    .filter((r) => !term || fold(`${r.name} ${r.catalogCode ?? ""} ${r.normCode}`).includes(term));
  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);
  const multi = (d?.campuses.length ?? 0) > 1;
  const showOutside = rows.some((r) => r.outsideNeed != null);
  // Trường chưa điều chỉnh dòng nào: cột "sau điều chỉnh" trùng số với cột theo thông tư — ẩn đi.
  const showAdjusted = rows.some((r) => r.requiredAdjusted !== r.requiredTt || r.shortageAdjusted !== r.shortageTt);
  const refresh = () => qc.invalidateQueries({ queryKey: [QK] });
  const needs = (r: YearRow) => (r.shortageAdjusted ?? 0) > 0 || (r.adjustment?.kind === "OUTSIDE" && r.adjustment.status !== "EXPIRED");
  const toProposal = async (normIds: number[]) => {
    if (!d) return;
    setBusy(true);
    try {
      // Điểm trường của chính dòng được tích (dòng cộng cả trường không có điểm trường = mọi điểm đang thiếu thiết bị đó);
      // máy chủ gộp các phần cùng thiết bị thành một dòng đề xuất.
      const byNorm = new Map(rows.map((r) => [r.normId, r]));
      const lines = normIds.map((normId) => ({ normId, campusId: byNorm.get(normId)?.campusId ?? d.campusId }));
      const r = await kyInstance.post("year_standards/proposal", {
        json: { schoolYearId: d.schoolYearId, lines },
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
  /**
   * Xuất Excel ĐÚNG bảng đang hiện: cùng các cột trên màn (cột điều chỉnh, ngoài thông tư chỉ khi màn có), cùng các dòng
   * đang lọc — không mã danh mục, không cột ẩn. Môn là một cột vì trên màn nó là nhãn mở đầu nhóm.
   */
  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    if (!d) return;
    const columns: XlsxColumn[] = [
      { key: "subject", label: "Môn" },
      { key: "name", label: "Thiết bị" },
      ...(multi && d.campusId == null ? [{ key: "campus", label: "Điểm trường" }] : []),
      { key: "requiredTt", label: showAdjusted ? "Cần theo TT" : "Cần có", type: "number" as const },
      ...(showAdjusted ? [{ key: "requiredAdjusted", label: "Cần sau điều chỉnh", type: "number" as const }] : []),
      ...(showOutside ? [{ key: "outsideNeed", label: "Ngoài TT", type: "number" as const }] : []),
      { key: "current", label: "Đang có", type: "number" as const },
      { key: "shortageTt", label: showAdjusted ? "Thiếu theo TT" : "Còn thiếu", type: "number" as const },
      ...(showAdjusted ? [{ key: "shortageAdjusted", label: "Thiếu sau điều chỉnh", type: "number" as const }] : []),
    ];
    setExporting(true);
    try {
      await downloadXlsx({
        resource: "year_standards",
        filename: `Chuẩn tối thiểu - ${d.schoolName} - ${d.schoolYearName}.xlsx`,
        title: `Thiết bị dạy học tối thiểu · ${d.schoolName}`,
        subtitle: d.schoolYearName,
        columns,
        rows: shown.map((r) => ({
          subject: r.subjectName ?? "Dùng chung", name: r.name, campus: r.campusName ?? "Cả trường",
          requiredTt: r.requiredTt, requiredAdjusted: r.requiredAdjusted, outsideNeed: r.outsideNeed,
          current: r.current, shortageTt: r.shortageTt, shortageAdjusted: r.shortageAdjusted,
        })),
        detail: `${d.schoolName} · ${d.schoolYearName} · ${shown.length} dòng`,
      });
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e), description: "Không xuất được Excel" });
    } finally {
      setExporting(false);
    }
  };

  if (isError && !d) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  // Không cột Hỏng / mất (trưởng nhóm 24/11/2026).
  const cols = 5 + (showAdjusted ? 2 : 0) + (showOutside ? 1 : 0) + (canPropose ? 1 : 0);
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
        {/* Nút có chữ (biểu tượng + giá trị đang chọn ▾), không nút tròn: nhìn là biết đang lọc gì. */}
        <IconFilter icon={<Filter />} labeled label="tình trạng" allLabel="Mọi tình trạng" total={rows.length} value={view === "all" ? null : view}
          onChange={(v) => { setView((v ?? "all") as View); setPage(1); }}
          // Gọn (trưởng nhóm 24/11/2026): Còn thiếu / Đủ; các mục về điều chỉnh chỉ hiện khi trường thật sự có.
          groups={[{ items: [
            { key: "shortAdj", label: "Còn thiếu", count: rows.filter((r) => (r.shortageAdjusted ?? 0) > 0).length },
            { key: "full", label: "Đủ", count: rows.filter((r) => r.shortageAdjusted === 0).length },
            ...(d?.adjusted ? [{ key: "adjusted", label: "Có điều chỉnh", count: d.adjusted }] : []),
            ...(d?.outside ? [{ key: "outside", label: "Ngoài thông tư", count: d.outside }] : []),
            ...(rows.some((r) => r.adjustment?.status === "EXPIRED")
              ? [{ key: "expired", label: "Điều chỉnh hết hiệu lực", count: rows.filter((r) => r.adjustment?.status === "EXPIRED").length }] : []),
          ] }]} />
        <IconFilter icon={<BookOpen />} labeled label="môn" allLabel="Mọi môn" value={subject} onChange={(v) => { setSubject(v); setPage(1); }}
          groups={[{ items: subjects.map((s) => ({ key: s, label: s })) }]} />
        <span className="flex-1" />
        {canPropose && selected.size ? (
          <Button type="button" disabled={busy} onClick={() => void toProposal([...selected])}>
            <ShoppingCart />
            Đưa {selected.size} dòng vào đề xuất
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={!d || exporting} onClick={() => void exportXlsx()}>
          {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Xuất Excel
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
            {/* Mỗi ô một số chính — số trường phải đạt (sau điều chỉnh của trường, chưa điều chỉnh thì chính là thông tư);
                số theo thông tư chỉ ghi ở dòng phụ khi hai số khác nhau. "0% · 0%" ghép hai số bằng dấu chấm thì khó đọc. */}
            <StatTile flat icon={<ListChecks />} label="Thiết bị phải có" value={<WithUnit value={num.format(d.counted)} unit="loại" />}
              hint="theo danh mục tối thiểu của thông tư" />
            <StatTile flat tone="success" icon={<CircleCheck />} label="Đã đủ"
              value={<WithUnit value={`${d.percentAdjusted}%`} unit={`${num.format(d.metAdjusted)} / ${num.format(d.counted)} loại`} />}
              hint={d.percentAdjusted !== d.percentTt ? `Theo thông tư, không tính điều chỉnh: ${d.percentTt}%` : "Số loại có đủ số lượng cần"} />
            {/* Đếm LOẠI, không cộng số lượng: các dòng khác đơn vị (ml hoá chất, gam, bộ, tờ…) cộng lại thành một số
                "chiếc" vô nghĩa. Số lượng từng loại xem ở bảng dưới. */}
            <StatTile flat tone="destructive" icon={<CircleAlert />} label="Còn thiếu"
              value={<WithUnit value={num.format(d.counted - d.metAdjusted)} unit="loại" />}
              hint={d.metAdjusted !== d.metTt ? `Theo thông tư, không tính điều chỉnh: ${num.format(d.counted - d.metTt)} loại` : "Số lượng cần mua từng loại xem ở bảng dưới"} />
            <StatTile flat tone="warning" icon={<SlidersHorizontal />} label="Trường điều chỉnh"
              value={d.adjusted ? <WithUnit value={num.format(d.adjusted)} unit="thiết bị" /> : <span className="text-muted-foreground text-lg">Chưa có</span>}
              hint={d.outside ? `Thêm ${num.format(d.outside)} thiết bị ngoài thông tư` : "Tăng, giảm số lượng so với thông tư"} />
          </div>
        </Card>
      ) : null}
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
          <Table>
            {/* Đầu bảng dính khi cuộn — 569 dòng, cuộn xuống là quên cột nào là "Cần có", cột nào là "Đang có". */}
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                {canPropose ? (
                  <TableHead className="w-10">
                    <Checkbox aria-label="Chọn mọi dòng thiếu đang lọc" checked={shown.some(needs) && shown.filter(needs).every((r) => selected.has(r.normId))}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(shown.filter(needs).map((r) => r.normId)) : new Set())} />
                  </TableHead>
                ) : null}
                <TableHead className="min-w-[14rem]">Thiết bị</TableHead>
                {/* Cột số rộng đều nhau, căn phải; cột Thiết bị lấy phần còn lại (không để cột nào giãn lệch). */}
                <TableHead className={NUM_COL}>{showAdjusted ? "Cần theo TT" : "Cần có"}</TableHead>
                {showAdjusted ? <TableHead className={NUM_COL}>Cần sau điều chỉnh</TableHead> : null}
                {showOutside ? <TableHead className={NUM_COL}>Ngoài TT</TableHead> : null}
                <TableHead className={NUM_COL}>Đang có</TableHead>
                <TableHead className={NUM_COL}>{showAdjusted ? "Thiếu theo TT" : "Còn thiếu"}</TableHead>
                {showAdjusted ? <TableHead className={NUM_COL}>Thiếu sau điều chỉnh</TableHead> : null}
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
                    // Nhãn môn mở đầu nhóm: viên màu chính, chữ hoa nhỏ — cùng kiểu với Danh mục thiết bị tối thiểu.
                    <TableRow key={`g-${r.normId}`} className="hover:bg-transparent">
                      <TableCell colSpan={cols} className="py-2">
                        <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
                          {r.subjectName ?? "Dùng chung"}
                        </span>
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
                      {/* Không dòng mã dưới tên: mã nằm trong chú thích khi rê chuột và trong tệp xuất. */}
                      <div className="truncate font-medium" title={`${r.name} · ${r.catalogCode ?? r.normCode}`}>{r.name}</div>
                      {adj || r.warning ? (
                      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                        {adj ? (
                          <Badge variant={adj.status === "EXPIRED" ? "destructive" : adj.status === "PENDING_RECONFIRM" ? "warning" : ADJUST_KIND_VARIANTS[adj.kind]}
                            title={adj.reason}>
                            {adj.status === "EXPIRED" ? "Hết hiệu lực — chọn lại" : SCHOOL_ADJUST_LABELS[adj.kind]}
                            {adj.status === "PENDING_RECONFIRM" ? " · chờ xác nhận lại" : ""}
                          </Badge>
                        ) : null}
                        {r.warning ? <span className="text-warning-text truncate" title={r.warning}>{r.warning}</span> : null}
                      </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.requiredTt == null ? "—" : num.format(r.requiredTt)}</TableCell>
                    {showAdjusted ? (
                      <TableCell className={cn("text-right tabular-nums", r.requiredAdjusted !== r.requiredTt && "text-primary font-semibold")}>
                        {r.requiredAdjusted == null ? "—" : num.format(r.requiredAdjusted)}
                      </TableCell>
                    ) : null}
                    {showOutside ? <TableCell className="text-right tabular-nums">{r.outsideNeed == null ? "" : num.format(r.outsideNeed)}</TableCell> : null}
                    <TableCell className="text-right tabular-nums">{num.format(r.current)}</TableCell>
                    <TableCell className="text-right"><Gap value={r.shortageTt} /></TableCell>
                    {showAdjusted ? <TableCell className="text-right"><Gap value={r.shortageAdjusted} /></TableCell> : null}
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
