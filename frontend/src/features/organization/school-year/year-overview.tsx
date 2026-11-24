import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Filter, Gauge, GraduationCap, Loader2, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PROFILE_STATUS_LABELS, type YearOverviewRow } from "@/domains/school-year/types";

import { useSchoolYear } from "@/shared/hooks/use-school-year";

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
/** Từ bao nhiêu điểm phần trăm giữa hai tỷ lệ thì gọi là chênh lệch lớn. */
const BIG_GAP = 30;

/** Lọc theo hồ sơ năm học và theo kết quả đối chiếu — đúng các cột còn trên bảng. */
type Pick = "draft" | "closed" | "full" | "short" | "noData";

/**
 * Chuẩn tối thiểu theo năm học của các trường (Sở): tỷ lệ đáp ứng theo thông tư và theo điều chỉnh, số dòng điều
 * chỉnh, số dòng ngoài thông tư; lọc trường có điều chỉnh, có dòng ngoài thông tư, chênh lệch lớn. Bấm một trường mở chuẩn
 * của trường đó.
 */
function matches(r: YearOverviewRow, pick: Pick) {
  switch (pick) {
    case "draft": return r.status !== "CLOSED";
    case "closed": return r.status === "CLOSED";
    case "full": return r.hasEquipment && r.shortItemsAdjusted === 0;
    case "short": return r.hasEquipment && r.shortItemsAdjusted > 0;
    case "noData": return !r.hasEquipment;
  }
}

export function YearOverview({ onOpenSchool }: { onOpenSchool: (id: number) => void }) {
  const { id: yearId } = useSchoolYear();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["year_standards", "overview", yearId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get("year_standards/overview", { signal, timeout: 120_000, searchParams: { yearId: String(yearId) } })
      .json<YearOverviewRow[]>(),
  });
  const rows = useMemo(() => data ?? [], [data]);
  const levels = useMemo(() => [...new Set(rows.map((r) => r.levelName).filter(Boolean) as string[])], [rows]);
  const big = (r: YearOverviewRow) => r.percentAdjusted - r.percentTt >= BIG_GAP;
  const term = fold(q.trim());
  const shown = rows
    .filter((r) => !level || r.levelName === level)
    .filter((r) => !pick || matches(r, pick))
    .filter((r) => !term || fold(r.schoolName).includes(term))
    // Trường đã có thiết bị trước, chênh lệch lớn trước.
    .sort((a, b) => Number(b.hasEquipment) - Number(a.hasEquipment) || (b.percentAdjusted - b.percentTt) - (a.percentAdjusted - a.percentTt));
  // Phân trang ở trình duyệt: danh sách về một lần (lọc, xếp tại chỗ), mỗi trang một khúc.
  const [page, setPage] = useState(1);
  const [size, setSize] = usePersistentState("yearOverview.pageSize", 20);
  const pageCount = Math.max(1, Math.ceil(shown.length / size));
  // Đổi tìm / lọc thì về trang 1; danh sách ngắn lại mà đang ở trang sau cùng thì kéo về trang cuối còn dữ liệu.
  useEffect(() => setPage(1), [q, pick, level, yearId]);
  useEffect(() => setPage((p) => Math.min(p, pageCount)), [pageCount]);
  const pageRows = shown.slice((page - 1) * size, page * size);

  // Số trường đã nhập thiết bị trên số trường của địa bàn — tỷ lệ đáp ứng đã có ở từng dòng.
  const entered = rows.filter((r) => r.hasEquipment);

  const { open: notify } = useNotification();
  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const blob = await kyInstance.get("year_standards/overview.xlsx", { timeout: DOWNLOAD_TIMEOUT, searchParams: { yearId: String(yearId) } }).blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "Thiết bị tối thiểu theo năm học.xlsx" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trường…" className="ps-9" />
        </div>
        {/* Nút có chữ (phễu + "Mọi trường ▾"): hàng công cụ còn rộng, người dùng thấy ngay đang lọc gì. */}
        <IconFilter icon={<Filter />} labeled label="lọc trường" allLabel="Mọi trường" total={rows.length} value={pick}
          onChange={(v) => setPick(v as Pick | null)}
          groups={[
            { items: [
              { key: "draft", label: "Đang khai", count: rows.filter((r) => matches(r, "draft")).length },
              { key: "closed", label: "Đã chốt", count: rows.filter((r) => matches(r, "closed")).length },
            ] },
            { items: [
              { key: "full", label: "Đủ chuẩn", count: rows.filter((r) => matches(r, "full")).length },
              { key: "short", label: "Còn thiếu", count: rows.filter((r) => matches(r, "short")).length },
              { key: "noData", label: "Chưa nhập thiết bị", count: rows.filter((r) => matches(r, "noData")).length },
            ] },
          ]} />
        {levels.length > 1 ? (
          <IconFilter icon={<GraduationCap />} labeled label="cấp học" allLabel="Mọi cấp học" value={level} onChange={setLevel}
            groups={[{ items: levels.map((l) => ({ key: l, label: l })) }]} />
        ) : null}
        <div className="flex items-center gap-3 sm:ms-auto">
          {rows.length ? (
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <span className="text-foreground font-semibold tabular-nums">{num.format(entered.length)}/{num.format(rows.length)}</span> trường đã nhập
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
                {exporting ? <Loader2 className="animate-spin" /> : <Settings />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={exporting || yearId == null} onSelect={() => void exportXlsx()}>
                <FileSpreadsheet />
                Xuất Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
          <Table>
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                <TableHead className="min-w-[12rem]">Trường</TableHead>
                <TableHead className="w-32">Hồ sơ năm học</TableHead>
                <TableHead className="text-right">Đáp ứng theo TT</TableHead>
                <TableHead className="text-right">Theo điều chỉnh</TableHead>
                <TableHead className="text-right">Còn thiếu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeletonRows cols={5} /> : shown.length === 0 ? (
                <TableEmpty colSpan={5} icon={<Gauge />} filtered={rows.length > 0}
                  title={rows.length ? "Không có trường khớp bộ lọc" : "Chưa có trường nào"} />
              ) : pageRows.map((r) => (
                <TableRow key={r.schoolId} className={cn("group/row cursor-pointer", LIFT_ROW)} onClick={() => onOpenSchool(r.schoolId)}>
                  <TableCell className="max-w-[24rem]">
                    {/* Không dòng phụ cấp học: hệ thống một cấp (THPT), dòng nào cũng "Trung học phổ thông". */}
                    <div className="truncate font-medium" title={r.schoolName}>{r.schoolName}</div>
                  </TableCell>
                  <TableCell><Badge variant={PROFILE_STATUS_VARIANTS[r.status]}>{PROFILE_STATUS_LABELS[r.status]}</Badge></TableCell>
                  {r.hasEquipment ? (
                    <>
                      <TableCell className="text-right tabular-nums">{r.percentTt}%</TableCell>
                      <TableCell className={cn("text-right tabular-nums", big(r) && "text-warning-text font-semibold")}>{r.percentAdjusted}%</TableCell>
                      <TableCell className="text-right tabular-nums">{num.format(r.shortItemsAdjusted)} loại</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} className="text-muted-foreground text-right">Chưa nhập thiết bị</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {shown.length > 0 ? (
          <div className="shrink-0 border-t px-3 py-1.5">
            <DataTablePagination currentPage={page} pageCount={pageCount} setCurrentPage={setPage}
              pageSize={size} setPageSize={(s) => { setSize(s); setPage(1); }} total={shown.length} pageSizeLabel="Số trường mỗi trang" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
