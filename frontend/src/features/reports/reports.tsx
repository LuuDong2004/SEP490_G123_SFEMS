import { ChoiceList, FilterButton, FilterField } from "@/shared/components/data-table/filter-popover";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { useCan, useNotification } from "@refinedev/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Archive, CircleDot, Clock, Download, FileSpreadsheet, History, Layers, Loader2, MapPin, Printer, RefreshCw, School, Settings, Tag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useSettled } from "@/shared/hooks/use-settled";
import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { DateRangePicker, type IsoRange, type YearBounds } from "@/shared/components/form/date-range-picker";
import { useSchoolYear, yearLabel } from "@/shared/hooks/use-school-year";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime, todayLocal } from "@/shared/lib/format";
import { safeDownloadName } from "@/shared/lib/download-filename";
import { cn } from "@/shared/lib/utils";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { Report, ReportAssetFilter, ReportDefinition } from "@/domains/report/types";
import { ReportVisual, type ReportFilter } from "@/features/reports/report-charts";
import { format, numeric, REPORT_FILTERS, rowAction, voucherLink, type RowAction } from "@/features/reports/report-extras";
import { FacilityStandardDialog } from "@/features/reports/facility-standard-dialog";
import { ReportDrillDialog, type ReportDrill } from "@/features/reports/report-drill";
import { SaveSnapshotDialog } from "@/features/reports/snapshots";
import { CSVC_STATISTICS, CsvcStatisticsNotes, CsvcStatisticsTable, csvcCell } from "@/shared/components/facility/csvc-statistics";
import { QueryError } from "@/shared/components/query-error";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { LoadMore } from "@/shared/components/data-table/load-more";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { useShowMore } from "@/shared/hooks/use-infinite-scroll";
import { CampusFilterButton } from "@/shared/components/campus/campus";

const number = new Intl.NumberFormat("vi-VN", { useGrouping: false });
// Số đếm, số lượng không có dấu ngăn nghìn (trưởng nhóm 24/11/2026). Tiền vẫn có: 2.500.000.000 đ dễ đọc hơn 2500000000.
const money = new Intl.NumberFormat("vi-VN");

/** Cách gộp theo phạm vi nhiều trường — vô nghĩa với tài khoản trường. */
const SCOPE_GROUPS = new Set(["school"]);

/** Số dòng hiện thêm mỗi lần cuộn tới đáy bảng chi tiết. */
const ROWS_STEP = 50;

type Named = { id: number; name: string };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Một báo cáo (chọn ở menu "Báo cáo", đường dẫn `/reports/:name`): chọn kỳ, xem chỉ số
 * và biểu đồ, xem bảng, xuất Excel hoặc in / lưu PDF.
 *
 * <p>Một màn cho mọi báo cáo — server trả về cột có kiểu, màn hình chỉ vẽ. Thanh ngữ cảnh
 * dưới tiêu đề nói báo cáo đang gộp trên PHẠM VI nào (toàn ngành, địa bàn, một trường) và
 * kỳ nào: cùng một báo cáo cho ba cấp người xem, nên con số thiếu hai thứ ấy là con số
 * không đọc được. Dòng tổng chỉ cộng các cột số; một cột "tỷ lệ %" cộng lại thì vô nghĩa
 * nên bị bỏ qua.
 */
export const Reports = () => {
  const { open: notify } = useNotification();
  const mayExport = useCan({ resource: "reports", action: "export" }).data?.can ?? false;
  const year = new Date().getFullYear();
  const { name } = useParams<{ name: string }>();
  // Kỳ của báo cáo nằm TRONG năm học đang làm việc (ô năm học trên header). Mặc định cả năm học (tới hôm nay nếu năm
  // đang chạy); chưa có năm học trong danh mục thì như cũ — từ đầu năm dương lịch tới hôm nay.
  const { year: workingYear, past: pastYear } = useSchoolYear();
  const today = iso(new Date());
  const bounds: YearBounds | undefined = workingYear
    ? { from: workingYear.startDate, to: workingYear.endDate, label: `Năm học ${yearLabel(workingYear)}` }
    : undefined;
  const yearRange = (): IsoRange => bounds
    ? { from: bounds.from, to: bounds.to > today ? (today < bounds.from ? bounds.from : today) : bounds.to }
    : { from: `${year}-01-01`, to: today };
  // Nhớ theo từng năm học: đổi năm trên header là về cả năm học đó, quay lại năm cũ thì đúng kỳ vừa chọn.
  const [rangeBy, setRangeBy] = useState<Record<string, IsoRange>>({});
  const yearKey = String(workingYear?.id ?? "none");
  const range = rangeBy[yearKey] ?? yearRange();
  const setRange = (next: IsoRange) => setRangeBy((m) => ({ ...m, [yearKey]: next }));
  const { from, to } = range;
  // Năm ngân sách mặc định theo năm học trên header (2026–2027 → 2027); đổi năm học thì về năm đó.
  const [budgetBy, setBudgetBy] = useState<Record<string, string>>({});
  const budgetYear = budgetBy[yearKey] ?? (workingYear?.endDate ? workingYear.endDate.slice(0, 4) : String(year + 1));
  const setBudgetYear = (v: string) => setBudgetBy((m) => ({ ...m, [yearKey]: v }));
  const [busy, setBusy] = useState(false);
  // Chiều tổng hợp nhớ theo TỪNG báo cáo: chuyển sang báo cáo khác rồi quay lại thì vẫn đúng chiều vừa chọn.
  const [groupBy, setGroupBy] = useState<Record<string, string>>({});
  // Ô chọn riêng (vd. loại bảng theo dõi) cũng nhớ theo từng báo cáo.
  const [choiceBy, setChoiceBy] = useState<Record<string, string>>({});
  // Lọc theo cột (môn, loại phòng, kết luận…) — trên các dòng đã tải, nhớ theo từng báo cáo.
  const [rowFilterBy, setRowFilterBy] = useState<Record<string, Record<string, string>>>({});
  /** Mục vừa bấm trên biểu đồ — mở hộp số liệu chi tiết của riêng mục đó. */
  const [drill, setDrill] = useState<ReportDrill | null>(null);
  const [saving, setSaving] = useState(false);
  const [standardOf, setStandardOf] = useState<{ id: number; name: string } | null>(null);
  // Số liệu chi tiết mặc định thu gọn — biểu đồ nói trước, bấm "Xem chi tiết" mới mở bảng; nhớ theo từng báo cáo.
  const [detailBy, setDetailBy] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  // Trường đang lọc dùng chung cho mọi báo cáo — chuyển báo cáo vẫn trên trường đó.
  const [schoolId, setSchoolIdRaw] = useState<number | null>(null);
  // Cơ sở: chỉ có nghĩa khi phạm vi là MỘT trường nhiều cơ sở — đổi trường thì bỏ chọn.
  const [campusId, setCampusId] = useState<number | null>(null);
  const setSchoolId = (id: number | null) => {
    setSchoolIdRaw(id);
    setCampusId(null);
  };
  // Lọc theo tài sản: loại thiết bị, trạng thái, tình trạng — giữ khi chuyển báo cáo, chỉ gửi khi báo cáo nhận.
  const [typeId, setTypeId] = useState<number | null>(null);
  const [assetFilter, setAssetFilter] = useState<{ status?: string; condition?: string }>({});
  // Tài khoản trường chỉ thấy trường mình: lọc theo trường là câu hỏi không có lựa chọn nào.
  const { perspective } = usePerspective();
  const canFilter = perspective !== "school";

  const defs = useQuery({
    queryKey: ["reports", "definitions"],
    queryFn: ({ signal }) => kyInstance.get("reports", { signal }).json<ReportDefinition[]>(),
  });
  const definitions = Array.isArray(defs.data) ? defs.data : [];
  const current = definitions.find((d) => d.name === name);
  // Đường dẫn cũ tới báo cáo đã bỏ: về báo cáo đầu tiên thay vì một trang trống.
  const gone = defs.isSuccess && !!name && !current;
  useEffect(() => {
    if (gone) navigate("/reports/equipment-by-school", { replace: true });
  }, [gone, navigate]);

  // Tài khoản trường chỉ có MỘT trường: gộp theo đơn vị luôn ra đúng một dòng — bỏ khỏi ô chọn.
  const groups = (current?.groups ?? []).filter((g) => canFilter || !SCOPE_GROUPS.has(g.key));
  const group = (name && groupBy[name]) || groups[0]?.key;
  const choices = current?.choices ?? [];
  const choice = (name && choiceBy[name]) || choices[0]?.key;
  const filters = current?.filters ?? [];
  const accepts = (key: ReportAssetFilter["key"]) => filters.some((f) => f.key === key);
  const hasControls = groups.length > 0 || choices.length > 0 || filters.length > 0 || !!current?.period || !!current?.year || canFilter
    || !!(name && REPORT_FILTERS[name]?.length);

  const params: Record<string, string> = {};
  if (current?.period) Object.assign(params, { from, to });
  if (current?.year) params.year = budgetYear;
  // Năm học đã qua: số liệu dựng lại tại cuối năm đó. Báo cáo không dựng lại được thì ghi rõ là số hiện tại.
  if (current?.byYear && pastYear && workingYear) params.yearId = String(workingYear.id);
  const nowOnly = pastYear && !!current && !current.byYear && !current.period && !current.year;
  if (group && groups.length) params.group = group;
  if (choice && choices.length) params.choice = choice;
  if (schoolId != null) params.schoolId = String(schoolId);
  if (campusId != null) params.campusId = String(campusId);
  if (accepts("type") && typeId != null) params.typeId = String(typeId);
  if (accepts("status") && assetFilter.status) params.status = assetFilter.status;
  if (accepts("condition") && assetFilter.condition) params.condition = assetFilter.condition;

  // Bấm lướt qua các tab / đổi lọc liên tục: chỉ gọi máy chủ khi lựa chọn đứng yên một nhịp (useSettled).
  const requestKey = JSON.stringify([current?.name, params]);
  const settling = useSettled(requestKey) !== requestKey;
  const report = useQuery({
    queryKey: ["reports", current?.name, params],
    enabled: !!current && !settling,
    // Đổi kỳ thì số cũ đứng yên tới khi số mới về, thay vì bảng trắng xoá rồi hiện lại.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => kyInstance.get(`reports/${current!.name}`, { signal,  searchParams: params }).json<Report>(),
  });
  // Chỉ giữ số cũ của CHÍNH báo cáo này — chuyển sang báo cáo khác thì không giữ số của báo cáo trước.
  const loaded = report.data && "rows" in report.data && report.data.name === current?.name ? report.data : undefined;
  const columnFilters = (name && REPORT_FILTERS[name]) || [];
  const active = (name && rowFilterBy[name]) || {};
  const setRowFilter = (key: string, value: string | null) => name && setRowFilterBy((all) => {
    const next = { ...(all[name] ?? {}) };
    if (value == null) delete next[key];
    else next[key] = value;
    return { ...all, [name]: next };
  });
  // Mọi phần bên dưới (ô số, biểu đồ, bảng, bản in) đọc các dòng ĐÃ lọc theo cột.
  const r = loaded && Object.keys(active).length
    ? { ...loaded, rows: loaded.rows.filter((row) => Object.entries(active).every(([k, v]) => String(row[k] ?? "") === v)) }
    : loaded;
  // Các điều kiện chọn một giá trị trong danh sách ngắn (trạng thái, tình trạng, cột…). Trường và loại thiết bị là ô riêng.
  const picks: { key: string; label: string; value: string | null; base: string | null; options: { value: string; label: string }[]; set: (v: string | null) => void }[] = [
    // Luôn có một lựa chọn (mục đầu là mặc định): bấm lại mục đang chọn thì về mục đầu.
    ...(choices.length ? [{
      key: "choice", label: name === "equipment-ledger" ? "Loại bảng" : "Trạng thái", value: choice ?? null, base: choices[0]?.key ?? null,
      options: choices.map((c) => ({ value: c.key, label: c.label })),
      set: (v: string | null) => name && setChoiceBy((c) => ({ ...c, [name]: v ?? choices[0]?.key ?? "" })),
    }] : []),
    ...filters.filter((f) => f.key !== "type").map((f) => ({
      key: f.key, label: f.label, value: assetFilter[f.key as "status" | "condition"] ?? null, base: null,
      options: f.options.map((o) => ({ value: o.key, label: o.label })),
      set: (v: string | null) => setAssetFilter((a) => ({ ...a, [f.key]: v ?? undefined })),
    })),
    ...columnFilters.map((f) => ({
      key: f.key, label: f.label.charAt(0).toUpperCase() + f.label.slice(1), value: active[f.key] ?? null, base: null,
      options: [...new Set((loaded?.rows ?? []).map((row) => row[f.key]).filter((v) => v != null && v !== "").map(String))]
        .sort((a, b) => a.localeCompare(b, "vi")).map((v) => ({ value: v, label: v })),
      set: (v: string | null) => setRowFilter(f.key, v),
    })),
  ];
  const filter: ReportFilter | undefined = loaded && columnFilters.length
    ? { active, set: setRowFilter, all: loaded.rows as ReportFilter["all"] }
    : undefined;

  async function exportXlsx() {
    if (!current) return;
    setBusy(true);
    try {
      const blob = await kyInstance.get(`reports/${current.name}/export`, { searchParams: params, timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeDownloadName(current.title)} - ${todayLocal()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  // Cột không cộng dồn được (số người khác nhau…) lấy số Tổng máy chủ tính sẵn (`totals`), còn lại cộng các dòng.
  const totals = r?.columns.map((c, i) =>
    i === 0 ? "Tổng" : r.totals?.[c.key] != null ? r.totals[c.key]
      // "Số trường" của từng nhóm: một trường có ở nhiều nhóm, cộng lại ra số trường không có thật.
      : c.type === "money" || (c.type === "number" && c.key !== "schools" && !c.label.includes("%"))
        ? r.rows.reduce((s, row) => s + (Number(row[c.key]) || 0), 0)
        : null,
  );
  // Phụ đề của server: "<phạm vi> · <kỳ>" — mỗi phần một nhãn.
  const [scope, ...periodParts] = (r?.subtitle ?? "").split(" · ");
  // Cột tên (trường, thiết bị, loại phiếu...) đậm; cột mã nhỏ và mờ — mắt tìm theo tên, không theo mã.
  // Bấm dòng: mở hồ sơ / phiếu; Ctrl / Cmd mở tab mới để không mất bộ lọc của báo cáo.
  const openRow = (act: RowAction, newTab: boolean) => {
    if ("standard" in act) return setStandardOf(act.standard);
    if (newTab) window.open(act.to, "_blank");
    else navigate(act.to);
  };
  const nameColumn = r?.columns.find((c) => c.type === "text" && !c.key.endsWith("code"))?.key;
  // Gọi như hàm, không như component: cần biết báo cáo có phần hình hay không để khỏi vẽ một khung rỗng.
  // Một dòng (vd. tài khoản trường gộp theo đơn vị) thì biểu đồ chỉ là một thanh — ô số và bảng đã nói hết.
  // Riêng chuẩn CSVC của MỘT trường vẫn có biểu đồ (theo mức, theo khối); "Xem chi tiết" mở bản đánh giá từng loại.
  const oneSchool = name === "facility-standard" && r?.rows.length === 1 ? rowAction(name, r.rows[0]) : null;
  // Bấm cột của một trường ở báo cáo chuẩn CSVC: mở thẳng bản đánh giá từng loại của trường đó.
  const openDrill = (d: ReportDrill) => {
    const act = name === "facility-standard" && d.record ? rowAction(name, d.record) : null;
    if (act) openRow(act, false);
    else setDrill(d);
  };
  const charts = r && (r.rows.length > 1 || oneSchool) ? ReportVisual({ report: r, part: "charts", filter, onDrill: openDrill }) : null;
  // Báo cáo không có biểu đồ (sổ, danh sách chi tiết) thì bảng chính là nội dung — luôn mở.
  const detailOpen = !charts || !!(name && detailBy[name]);
  // Không có biểu đồ thì bảng chi tiết là nội dung chính: thẻ kéo kín phần còn lại của màn như các danh sách, bảng cuộn
  // bên trong, bảng trống thì chữ đứng giữa khung (không bẹp thành một dải dưới bộ lọc).
  const fillDetail = useFillHeight(16, 1024, 320);
  // Cuộn tới đâu hiện thêm tới đó, không phân trang; đổi báo cáo hay bộ lọc thì về đầu.
  const more = useShowMore(r?.rows.length ?? 0, ROWS_STEP);
  const resetRows = useRef(more.reset);
  resetRows.current = more.reset;
  const scrollBox = useRef<HTMLDivElement>(null);
  const rowsKey = requestKey + JSON.stringify(active);
  useEffect(() => {
    resetRows.current();
    scrollBox.current?.scrollTo({ top: 0 });
  }, [rowsKey]);
  // Mở chi tiết: đưa cả khung lên ngay dưới thanh tab — tiêu đề, tên cột và dòng tổng luôn nằm trong màn.
  const detailCard = useRef<HTMLDivElement | null>(null);
  const hasCharts = !!charts;
  const measureFill = fillDetail.ref;
  const cardRef = useCallback((el: HTMLDivElement | null) => {
    detailCard.current = el;
    measureFill(hasCharts ? null : el);
  }, [hasCharts, measureFill]);
  const detailFills = !charts && fillDetail.height != null;
  // Biểu số liệu CSVC: bảng theo mẫu Sở (tiêu đề ba hàng, khối in đậm), xuất Excel đúng bố cục mẫu.
  const csvc = name === CSVC_STATISTICS;

  return (
    <ListView>
      {/* Tiêu đề đã ở thanh tab; các nút (Làm mới, Lưu bản này, Xuất) nằm cuối hàng bộ lọc — không dựng một hàng chỉ có nút. */}
      {/* `contents`: phần đầu chỉ có tiêu đề ẩn — khối rỗng sẽ ăn thêm một khoảng cách dưới thanh tab. */}
      <div className="contents print:hidden">
        <ListViewHeader />
      </div>
      {r ? (
        <PrintSheet
          title={r.title}
          subtitle={r.subtitle}
          table={{
            headers: r.columns.map((c) => c.label),
            alignRight: r.columns.map((c, i) => (numeric(c.type) ? i : -1)).filter((i) => i >= 0),
            rows: (csvc ? r.rows.filter((row) => row.kind !== "note") : r.rows)
              .map((row) => r.columns.map((c) => (csvc ? csvcCell(row, c.key, c.type) : format(row[c.key], c.type)))),
          }}
          signers={["Người lập biểu", "Thủ trưởng đơn vị"]}
        />
      ) : null}
      <div className="space-y-4 print:hidden">
        {/* MỘT hàng ngữ cảnh: bên trái báo cáo đang gộp trên phạm vi nào (và mô tả trong dấu "?"), bên phải mọi bộ
            chọn — chiều gộp, kỳ, nút Bộ lọc. Hai hàng có đường kẻ giữa thì nửa phải
            hàng trên và hàng dưới đều trống. */}
        {/* Không có bộ chọn nào (tài khoản trường, báo cáo không theo kỳ): chỉ còn nhãn phạm vi — không cần khung. */}
        <Card className={cn("flex flex-row flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 lg:flex-nowrap",
          !hasControls && "border-0 bg-transparent px-0 py-0 shadow-none")}>
          {/* Nhãn bên trái tự xuống dòng trong phần của nó; bộ chọn và nút bên phải luôn một hàng (màn lớn). */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {scope ? (
              <Badge variant="info" className="gap-1.5">
                <MapPin className="size-3.5" />
                {scope}
              </Badge>
            ) : null}
            {/* Báo cáo theo kỳ: kỳ đã ghi trên ô chọn khoảng ngày, không lặp lại ở đây. */}
            {(current?.period ? [] : periodParts).map((part) => (
              <Badge key={part} variant="neutral" className="gap-1.5">
                <CalendarDays className="size-3.5" />
                {part.charAt(0).toUpperCase() + part.slice(1)}
              </Badge>
            ))}
            {nowOnly ? (
              <Badge variant="warning" className="gap-1.5">
                <CalendarDays className="size-3.5" />
                Số liệu hiện tại, không theo năm học
              </Badge>
            ) : null}
            {/* Số liệu chốt lúc nào: lần đọc gần nhất từ máy chủ — Làm mới để lấy số mới. */}
            {loaded && report.dataUpdatedAt ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
                <Clock className="size-3.5" />
                Số liệu lúc {formatDateTime(new Date(report.dataUpdatedAt).toISOString())}
              </span>
            ) : null}
            {report.isFetching || settling ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
          </div>
          {/* Kỳ, cách gộp, trường, loại thiết bị đứng thẳng trên hàng: bấm là chọn được, không phải mở "Bộ lọc" rồi mở tiếp
              một ô chọn bên trong. Danh sách ngắn (trạng thái, tình trạng): một cái thì đứng thẳng, từ hai cái mới gom vào
              "Bộ lọc" (mở ra tích ngay). */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap [&_[data-slot=select-trigger]]:rounded-full">
            {current?.period ? (
              <DateRangePicker value={range} onChange={setRange} bounds={bounds} className="w-auto" />
            ) : current?.year ? (
              <div className="flex items-center" title="Năm ngân sách" role="group" aria-label="Năm ngân sách">
                <Button type="button" variant="outline" size="icon" className="size-9 rounded-e-none" aria-label="Năm trước"
                  onClick={() => setBudgetYear(String(Number(budgetYear) - 1))}>
                  <ChevronLeft />
                </Button>
                <div className="bg-field flex h-9 items-center gap-1.5 border-y px-3 text-sm tabular-nums">
                  <CalendarDays className="text-muted-foreground size-4" />
                  <span className="text-muted-foreground">Năm</span>
                  <span className="font-medium">{budgetYear}</span>
                </div>
                <Button type="button" variant="outline" size="icon" className="size-9 rounded-s-none" aria-label="Năm sau"
                  onClick={() => setBudgetYear(String(Number(budgetYear) + 1))}>
                  <ChevronRight />
                </Button>
              </div>
            ) : null}
            {groups.length ? (
              <Select value={group} onValueChange={(v) => name && setGroupBy((g) => ({ ...g, [name]: v }))}>
                <SelectTrigger className="h-9 w-auto" aria-label="Gộp theo">
                  <Layers className="text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <CampusFilterButton labeled schoolId={schoolId} value={campusId} onChange={setCampusId} />
            {canFilter ? (
              <AsyncCombobox<Named>
                resource="schools"
                icon={<School />}
                labeled
                modal={false}
                value={schoolId}
                onChange={setSchoolId}
                labelOf={(sc) => sc.name}
                placeholder="Mọi trường"
                searchPlaceholder="Gõ tên trường..."
                clearLabel="Mọi trường"
              />
            ) : null}
            {accepts("type") ? (
              <AsyncCombobox<Named>
                resource="equipment_types"
                icon={<Tag />}
                labeled
                modal={false}
                value={typeId}
                onChange={setTypeId}
                labelOf={(t) => t.name}
                placeholder="Mọi loại thiết bị"
                searchPlaceholder="Gõ tên loại thiết bị..."
                clearLabel="Mọi loại thiết bị"
              />
            ) : null}
            {picks.length === 1 ? picks.map((f) => (
              <IconFilter key={f.key} icon={<CircleDot />} label={f.label.toLowerCase()} labeled modal={false}
                allLabel={f.base == null ? `Mọi ${f.label.toLowerCase()}` : undefined} baseline={f.base ?? undefined}
                groups={[{ items: f.options.map((o) => ({ key: o.value, label: o.label })) }]}
                value={f.value} onChange={f.set} />
            )) : picks.length ? (
              <FilterButton align="end" count={picks.filter((f) => f.value != null && f.value !== f.base).length}
                onClear={() => picks.forEach((f) => f.set(f.base))}>
                {picks.map((f) => (
                  <FilterField key={f.key} label={f.label} icon={CircleDot} active={f.value != null && f.value !== f.base}>
                    <ChoiceList value={f.value} options={f.options} onChange={f.set} />
                  </FilterField>
                ))}
              </FilterButton>
            ) : null}
          </div>
          {hasControls ? <span className="bg-border hidden h-6 w-px sm:block" aria-hidden /> : null}
          {/* Một nút chính (Xuất: Excel, In / PDF); Làm mới và Lưu bản số liệu gập vào menu ⚙ như các màn khác. */}
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" disabled={!r || busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Download />}
                  Xuất
                  <ChevronDown className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {mayExport ? (
                  <DropdownMenuItem onSelect={() => void exportXlsx()}>
                    <FileSpreadsheet /> {csvc ? "Excel mẫu Sở (.xlsx)" : "Excel (.xlsx)"}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => window.print()}>
                  <Printer /> In / lưu PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác" title="Thao tác khác">
                  <Settings />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* Đọc lại số liệu với đúng bộ lọc đang chọn (không phải tải lại cả trang). */}
                <DropdownMenuItem disabled={!current || report.isFetching} onSelect={() => void report.refetch()}>
                  <RefreshCw className={report.isFetching ? "animate-spin" : undefined} /> Làm mới số liệu
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!r} className="items-start" onSelect={() => setSaving(true)}>
                  <Archive className="mt-0.5" />
                  <span>
                    <span className="block">Lưu bản số liệu</span>
                    <span className="text-muted-foreground block text-xs">Giữ số liệu lúc này để xem lại sau</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/report-snapshots")}>
                  <History /> Báo cáo đã lưu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {r ? <ReportVisual report={r} part="stats" filter={filter} /> : null}

        {/* Biểu đồ cao theo màn: lấp phần trống dưới đáy khi bảng chi tiết đang thu gọn, không dưới 18rem. Khung cũng cao
            theo đó (`min-h`, `*:flex-1`). Trừ khi chỉ có MỘT vòng tròn kiểu thanh ngang (`DonutBreakdown bars`, gắn
            `data-fit`): khung cao vừa nội dung — kéo cao thì vòng nằm giữa một khoảng trắng lớn (góp ý của người dùng). */}
        {charts ? <Card className="min-h-[calc(var(--chart-h)+7.5rem)] gap-0 py-0 [--chart-h:max(18rem,calc(100dvh-34.75rem))] *:flex-1 has-[[data-fit]]:min-h-0">{charts}</Card> : null}

        <Card ref={cardRef} style={detailFills ? { height: fillDetail.height } : undefined}
          className={cn("scroll-mt-32 gap-0 overflow-hidden py-0", detailFills && "flex flex-col print:!h-auto")}>
          <div className={cn("flex shrink-0 items-center justify-between gap-3 px-5 py-3", detailOpen && "border-b")}>
            <div className="flex min-w-0 items-baseline gap-3">
              <h3 className="text-sm font-semibold">Số liệu chi tiết</h3>
              <p className="text-muted-foreground truncate text-xs">
                {oneSchool && charts ? "Đánh giá từng loại cơ sở vật chất" : r ? `${number.format(r.rows.length)} dòng${detailOpen && !csvc && more.hasMore ? ` · đang hiện ${number.format(more.count)}` : ""}${detailOpen ? " · lần xuất, in được ghi vào nhật ký hoạt động" : ""}` : ""}
              </p>
            </div>
            {charts ? (
              <Button type="button" size="sm" variant={detailOpen ? "ghost" : "outline"} aria-expanded={detailOpen}
                onClick={() => {
                  if (!name) return;
                  if (oneSchool) return openRow(oneSchool, false);
                  setDetailBy((d) => ({ ...d, [name]: !detailOpen }));
                  if (!detailOpen) setTimeout(() => detailCard.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}>
                {detailOpen ? "Thu gọn" : "Xem chi tiết"}
                {oneSchool ? null : <ChevronDown className={cn("transition-transform", detailOpen && "rotate-180")} />}
              </Button>
            ) : null}
          </div>
          {detailOpen ? <CardContent className={cn("animate-in fade-in slide-in-from-top-1 p-0 duration-300", detailFills && "flex min-h-0 flex-1 flex-col")}>
            {/* Khung này là vùng cuộn DUY NHẤT: khung bọc sẵn của `Table` cũng cuộn thì tên cột dính vào nó và trôi theo dòng. */}
            <div ref={scrollBox} className={cn("overflow-auto [&>[data-slot=table-container]]:overflow-visible print:max-h-none",
              detailFills ? "min-h-0 flex-1" : "max-h-[max(20rem,calc(100dvh-13.5rem))]")}>
              {csvc && r ? <CsvcStatisticsTable report={r} /> : (
              <Table>
                <TableHeader className="bg-surface-subtle sticky -top-px z-10">
                  <TableRow>
                    {(r?.columns ?? []).map((c) => (
                      <TableHead key={c.key} className={cn("h-auto whitespace-normal py-2.5 leading-snug text-balance min-[1800px]:whitespace-nowrap", numeric(c.type) && "text-right")}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!r && (report.isError || defs.isError) ? (
                    <TableRow>
                      <TableCell colSpan={99} className="p-0">
                        <QueryError className="border-0" error={report.error ?? defs.error}
                          onRetry={() => void (report.isError ? report.refetch() : defs.refetch())}
                          retrying={report.isFetching || defs.isFetching} />
                      </TableCell>
                    </TableRow>
                  ) : !r && (report.isLoading || defs.isLoading || settling) ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={99}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : r && r.rows.length === 0 ? (
                    <TableEmpty colSpan={r.columns.length} title="Không có dữ liệu trong phạm vi và kỳ đã chọn"
                      description="Đổi kỳ, địa bàn hoặc bộ lọc để xem số liệu khác." />
                  ) : (
                    (r?.rows ?? []).slice(0, more.count).map((row, i) => {
                      // Bấm dòng: mở hồ sơ tài sản / phòng, hoặc xem đánh giá chuẩn CSVC của trường.
                      // Ctrl / Cmd + bấm mở tab mới để không mất bộ lọc của báo cáo.
                      const act = current ? rowAction(current.name, row) : null;
                      const voucher = voucherLink(row);
                      return (
                      <TableRow key={i} className={cn(LIFT_ROW, act && "cursor-pointer")}
                        title={act?.title}
                        onClick={act ? (ev) => openRow(act, ev.ctrlKey || ev.metaKey) : undefined}>
                        {r!.columns.map((c) => {
                          // Số 0 mờ đi: một bảng toàn số 0 thì con số thật không nổi lên được.
                          const zero = numeric(c.type) && Number(row[c.key]) === 0;
                          return (
                            <TableCell
                              key={c.key}
                              className={cn(
                                numeric(c.type) && "text-right tabular-nums",
                                zero && "text-muted-foreground/60",
                                c.key === nameColumn && "font-medium",
                                c.key.endsWith("code") && "text-muted-foreground text-xs",
                              )}
                            >
                              {c.key === "voucher_code" && voucher && row[c.key] ? (
                                <Link to={voucher} className="text-primary hover:underline" title="Mở phiếu"
                                  onClick={(ev) => ev.stopPropagation()}>
                                  {format(row[c.key], c.type)}
                                </Link>
                              ) : format(row[c.key], c.type)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {r && r.rows.length > 1 && totals?.some((t) => typeof t === "number") ? (
                  <TableFooter className="sticky -bottom-px z-10">
                    <TableRow>
                      {r.columns.map((c, i) => (
                        <TableCell key={c.key} className={numeric(c.type) ? "text-right font-semibold tabular-nums" : "font-semibold"}>
                          {typeof totals![i] === "number" ? (c.type === "money" ? money : number).format(totals![i] as number) : totals![i] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
              )}
              {csvc ? null : <LoadMore attach={more.attach} hasMore={more.hasMore} />}
            </div>
            {csvc && r ? <CsvcStatisticsNotes report={r} /> : null}
          </CardContent> : null}
        </Card>
      </div>
      {current ? <SaveSnapshotDialog name={current.name} params={params} open={saving} onOpenChange={setSaving} /> : null}
      {r && drill ? <ReportDrillDialog report={r} drill={drill} onClose={() => setDrill(null)} onOpenRow={openRow} /> : null}
      {standardOf ? <FacilityStandardDialog school={standardOf} onClose={() => setStandardOf(null)} /> : null}
    </ListView>
  );
};
