import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ClipboardCheck, FileSpreadsheet, GraduationCap, Loader2, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { HelpHint } from "@/shared/components/form/help-hint";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { AdequacySummary, SchoolStandardRow } from "@/domains/procurement/types";
import { QueryError } from "@/shared/components/query-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

const LEVELS = [
  { code: "TH", label: "Tiểu học" },
  { code: "THCS", label: "Trung học cơ sở" },
  { code: "THPT", label: "Trung học phổ thông" },
];

type DataState = "none" | "partial" | "ready";
/** Trường đang ở đâu trên đường nhập liệu: chưa nhập thiết bị → thiếu dữ liệu nền → đủ dữ liệu. */
function dataState(r: SchoolStandardRow): DataState {
  if (!r.hasEquipment) return "none";
  return r.unknown > 0 ? "partial" : "ready";
}
const STATE_LABEL: Record<DataState, string> = { none: "Chưa nhập thiết bị", partial: "Thiếu dữ liệu nền", ready: "Đủ dữ liệu" };
const STATE_VARIANT: Record<DataState, "neutral" | "warning" | "success"> = { none: "neutral", partial: "warning", ready: "success" };

// Hai nhóm lọc, không trộn: NHẬP LIỆU (trường đã có số liệu chưa) và KẾT QUẢ (trong số đã nhập, thiếu hay đủ).
const STATUS_FILTERS = [
  { value: "entered", group: "data", label: "Đã nhập thiết bị" },
  { value: "none", group: "data", label: "Chưa nhập thiết bị" },
  { value: "all", group: "data", label: "Tất cả trường" },
  { value: "short", group: "result", label: "Còn thiếu" },
  { value: "full", group: "result", label: "Đủ 100%" },
  { value: "surplus", group: "result", label: "Có thiết bị thừa" },
  { value: "partial", group: "result", label: "Thiếu dữ liệu nền" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];
function matches(r: SchoolStandardRow, f: StatusFilter) {
  switch (f) {
    case "entered": return r.hasEquipment;
    case "short": return r.hasEquipment && r.shortItems > 0;
    case "full": return r.hasEquipment && r.norms > 0 && r.met === r.norms;
    case "surplus": return r.surplusItems > 0;
    case "partial": return dataState(r) === "partial";
    case "none": return !r.hasEquipment;
    default: return true;
  }
}

/**
 * Thiết bị dạy học tối thiểu trên ĐỊA BÀN — màn của Sở / UBND / quản trị.
 *
 * <p>MỘT bảng như mọi danh sách: hàng công cụ (ô tìm, nút chọn chế độ xem, nút lọc cấp học và tình trạng — số bên cạnh mục là số
 * trường —, bánh răng có Xuất Excel) và phân trang. Bấm một trường mở chuẩn của trường đó. Không có điều chuyển thiết bị
 * giữa các trường (ngoài phạm vi, trưởng nhóm 24/11/2026).
 *
 * <p>Mọi tỷ lệ chỉ tính trên trường ĐÃ nhập thiết bị: trường chưa nhập thì "thiếu" của nó là thiếu dữ
 * liệu, tính vào là cả địa bàn về 0%. Trường chưa nhập là một mục lọc riêng.
 */
export function StandardOverview({ onOpenSchool }: { onOpenSchool: (id: number) => void }) {
  const { open: notify } = useNotification();
  const fillBox = useFillHeight();
  const [term, setTerm] = useState("");
  const [chosenLevel, setLevel] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("entered");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("standard.pageSize", 20, "local");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["purchase_proposals", "adequacy-summary"],
    queryFn: ({ signal }) => kyInstance.get("purchase_proposals/adequacy-summary", { signal }).json<AdequacySummary>(),
  });
  const s = data && "rows" in data ? data : undefined;
  const all = useMemo(() => s?.rows ?? [], [s]);

  // Chỉ những cấp học CÓ trường trong phạm vi người xem: UBND phường quản lý tiểu học, THCS — một mục
  // "Trung học phổ thông" với 0 trường chỉ làm người ta tưởng mình quản cả THPT.
  const ownLevels = useMemo(() => LEVELS.filter((l) => all.some((r) => r.levelCode === l.code)), [all]);
  const level = s && !ownLevels.some((l) => l.code === chosenLevel) ? "all" : chosenLevel;
  const showLevel = ownLevels.length > 1;

  const inLevel = useMemo(() => all.filter((r) => level === "all" || r.levelCode === level), [all, level]);
  const entered = useMemo(() => inLevel.filter((r) => r.hasEquipment), [inLevel]);
  const percent = pct(entered.reduce((n, r) => n + r.met, 0), entered.reduce((n, r) => n + r.norms, 0));

  const counts = useMemo(() => {
    const c = {} as Record<StatusFilter, number>;
    for (const f of STATUS_FILTERS) c[f.value] = inLevel.filter((r) => matches(r, f.value)).length;
    return c;
  }, [inLevel]);
  const levelCounts = useMemo(() => {
    const c: Record<string, number> = { all: all.filter((r) => matches(r, status)).length };
    for (const l of ownLevels) c[l.code] = all.filter((r) => r.levelCode === l.code && matches(r, status)).length;
    return c;
  }, [all, ownLevels, status]);

  const q = fold(term.trim());
  const rows = useMemo(
    () => inLevel.filter((r) => matches(r, status) && (!q || fold(`${r.schoolName} ${r.schoolCode} ${r.district ?? ""}`).includes(q))),
    [inLevel, status, q],
  );

  const list = rows;
  useEffect(() => setPage(1), [term, status, level, pageSize]);
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const from = (current - 1) * pageSize;

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const blob = await kyInstance.get("purchase_proposals/adequacy-summary.xlsx", { timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "Đáp ứng thiết bị tối thiểu.xlsx" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setExporting(false);
    }
  };

  if (isError && !s) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  if (isLoading || !s) return <Skeleton className="h-96 w-full" />;

  const head = "text-overline text-muted-foreground";
  return (
    <div ref={fillBox.ref} style={{ height: fillBox.height }} className="flex min-h-0 flex-col">
      <section className="bg-card shadow-e1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
          {/* Ô tìm rộng cố định, chế độ xem đứng trước các nút lọc: đổi chế độ thì nút lọc tình trạng ẩn đi mà không ô nào xê dịch. */}
          <div className="relative w-full min-w-0 sm:w-80">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9"
              placeholder="Tìm trường, mã trường, địa bàn…" aria-label="Tìm" />
          </div>
          {showLevel ? (
            <IconFilter icon={<GraduationCap />} label="cấp học" allLabel="Mọi cấp học" total={levelCounts.all}
              value={level === "all" ? null : level} onChange={(v) => setLevel(v ?? "all")}
              groups={[{ items: ownLevels.map((l) => ({ key: l.code, label: l.label, count: levelCounts[l.code] })) }]} />
          ) : null}
          {/* Mặc định chỉ xem trường đã nhập thiết bị, không tính là đang lọc. Số bên cạnh mục là số trường. */}
          <IconFilter icon={<ClipboardCheck />} label="tình trạng" baseline="entered" value={status} onChange={(v) => v && setStatus(v as StatusFilter)}
              groups={([["data", "Nhập liệu"], ["result", "Kết quả đối chiếu"]] as const).map(([group, heading]) => ({
                heading,
                items: STATUS_FILTERS.filter((f) => f.group === group).map((f) => ({ key: f.value, label: f.label, count: counts[f.value] })),
              }))} />
          <div className="flex items-center gap-3 sm:ms-auto">
            {/* Con số chung của địa bàn: một dòng chữ, không cần cả một hàng ô chỉ số. */}
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              Đáp ứng <span className="text-foreground font-semibold tabular-nums">{percent}%</span> · {num.format(entered.length)}/{num.format(inLevel.length)} trường đã nhập
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
                  {exporting ? <Loader2 className="animate-spin" /> : <Settings />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled={exporting} onSelect={() => void exportXlsx()}>
                  <FileSpreadsheet />
                  Xuất Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="scrollbar-fade min-h-0 flex-1 overflow-auto [&_tbody_tr:last-child]:border-b">
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0 z-10">
                <TableRow>
                  <TableHead className={cn(head, "w-12 ps-4")}>STT</TableHead>
                  <TableHead className={head}>Trường</TableHead>
                  {showLevel ? <TableHead className={cn(head, "w-40")}>Cấp học</TableHead> : null}
                  <TableHead className={cn(head, "w-56")}>Đáp ứng</TableHead>
                  <TableHead className={cn(head, "w-24 text-right")}>Thiếu <HelpHint>Số thiết bị còn thiếu so với định mức</HelpHint></TableHead>
                  <TableHead className={cn(head, "w-24 text-right")}>Thừa <HelpHint>Số thiết bị có nhiều hơn định mức</HelpHint></TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={showLevel ? 7 : 6} title={status === "entered" && entered.length === 0 ? "Chưa có trường nào nhập thiết bị." : "Không có trường nào khớp."} />
                ) : rows.slice(from, from + pageSize).map((r, i) => {
                  const st = dataState(r);
                  return (
                    <TableRow key={r.schoolId} className={cn("group/row", LIFT_ROW, "cursor-pointer")} onClick={() => onOpenSchool(r.schoolId)}>
                      <TableCell className="text-muted-foreground ps-4 tabular-nums">{from + i + 1}</TableCell>
                      <TableCell className="whitespace-normal">
                        {/* Chỉ tên trường, nhãn trạng thái đứng cạnh — không có dòng địa bàn bên dưới (ô tìm vẫn tìm theo địa bàn). */}
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{r.schoolName}</span>
                          {st === "partial" ? (
                            <Badge
                              variant={STATE_VARIANT[st]}
                              title={`${r.unknown} thiết bị chưa tính được vì trường chưa khai đủ lớp, sĩ số hoặc giáo viên dạy môn`}
                            >
                              {STATE_LABEL[st]}
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      {showLevel ? <TableCell className="text-muted-foreground">{r.level ?? "—"}</TableCell> : null}
                      <TableCell>
                        {r.hasEquipment ? (
                          <div className="flex items-center gap-2.5">
                            <Progress value={r.percent} className="h-2 flex-1" />
                            <span className="w-24 text-right text-xs tabular-nums">
                              <span className="font-semibold">{r.percent}%</span>
                              <span className="text-muted-foreground"> · {r.met}/{r.norms}</span>
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">Chưa nhập thiết bị</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.hasEquipment && r.shortItems ? <span className="text-destructive-text font-semibold">{num.format(r.shortItems)}</span> : <span className="text-muted-foreground">–</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.surplusItems ? <span className="text-info-text font-semibold">{num.format(r.surplusItems)}</span> : <span className="text-muted-foreground">–</span>}
                      </TableCell>
                      <TableCell><ChevronRight className="text-muted-foreground size-4" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        </div>

        <div className="shrink-0 border-t px-3 py-1.5">
          <DataTablePagination currentPage={current} pageCount={pageCount} setCurrentPage={setPage} pageSize={pageSize} setPageSize={setPageSize}
            total={list.length} />
        </div>
      </section>
    </div>
  );
}
