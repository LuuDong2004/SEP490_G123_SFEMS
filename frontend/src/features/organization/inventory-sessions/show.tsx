import { Textarea } from "@/shared/ui/textarea";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { MobileQrButton } from "./mobile-qr";
import { CatalogPickerDialog } from "@/features/organization/equipment-intakes/catalog-picker";
import { ReturnedNotice } from "@/shared/components/voucher/returned-notice";
import { useInvalidate, useList, useNotification, useShow } from "@refinedev/core";
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Clock,
  DoorOpen,
  FilePen,
  MessageSquareText,
  Lock,
  Plus,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  Undo2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { HelpHint } from "@/shared/components/form/help-hint";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { DocumentSheet } from "@/shared/components/print/document-sheet";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { RelatedVouchers } from "@/shared/components/voucher/related-vouchers";
import { InventoryBreakdown } from "./breakdown";
import { InventoryFollowUps } from "./follow-ups";
import { InventoryFacilityPanel } from "./facility-panel";
import { VoucherActions, type TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { VoucherMoreMenu } from "@/shared/components/voucher/voucher-more-menu";
import { Segmented } from "@/shared/components/segmented";
import { VoucherViewSwitch } from "@/shared/components/voucher/voucher-view-switch";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { detailFacts, VoucherDetailsView } from "@/shared/components/voucher/voucher-details";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { VoucherTimelineDialog } from "@/shared/components/voucher/voucher-timeline";
import { useVoucherView } from "@/shared/hooks/use-voucher-view";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime, formatPlainDate, formatEditedAt } from "@/shared/lib/format";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { Details } from "@/domains/voucher/form-types";
import type { VoucherStatus } from "@/domains/voucher/types";
import { EQUIPMENT_CONDITION_LABELS } from "@/domains/equipment/types";
import {
  DISCREPANCY_LABELS,
  DISCREPANCY_OUTCOMES,
  type InventoryLine,
  type InventorySession,
} from "@/domains/inventory/types";
import { maxLengthOf, numberError, textError } from "@/shared/lib/field-rules";
import { TableEmpty } from "@/shared/components/data-table/table-empty";


const RESOURCE = "inventory_sessions";

const UNSET = "__unset__";
const SAME = "__same__";
/** Dòng mỗi trang của bảng kiểm đếm — phiếu cả trường có hàng trăm dòng, mỗi dòng vài ô nhập. */
const PAGE = 20;
/** Thẻ bên: tổ kiểm kê hiện chừng này người, còn lại bấm "Xem thêm". */
const COUNCIL_SHOWN = 3;

type Draft = { found: string; room: string; condition: string; qty: string; note: string; details: Details };

type Filter = "all" | "unchecked" | "matched" | "diff" | "MISSING" | "WRONG_ROOM" | "CONDITION";
const KIND_FILTERS: readonly Filter[] = ["MISSING", "WRONG_ROOM", "CONDITION"];

function draftOf(line: InventoryLine): Draft {
  return {
    found: line.found == null ? UNSET : line.found ? "yes" : "no",
    // Thấy đúng phòng / đúng tình trạng trên sổ thì là "đúng sổ", dù máy chủ có lưu lại giá trị đó.
    room: line.foundRoom && line.foundRoom.id !== line.expectedRoom?.id ? String(line.foundRoom.id) : SAME,
    condition: line.foundCondition && line.foundCondition !== line.expectedCondition ? line.foundCondition : SAME,
    // Đếm theo số lượng: trống = đủ như sổ.
    qty: line.countedQuantity != null && line.countedQuantity !== line.expectedQuantity ? String(line.countedQuantity) : "",
    note: line.note ?? "",
    details: line.details ?? {},
  };
}

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3, useGrouping: false });
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/**
 * Bề rộng cột của bảng kiểm đếm (`table-fixed`: chữ dài cắt trong ô, cột không xô nhau khi lọc). Lúc XEM, ba cột
 * "Có thấy? / Thấy ở / Tình trạng" gộp thành một cột "Kết quả kiểm" chỉ nói cái KHÁC sổ; lúc KIỂM ĐẾM thì ba cột đó là
 * ô nhập. Cột không ghi bề rộng (tên tài sản) nhận phần còn lại: `min-w` của bảng phải lớn hơn tổng các cột cố định
 * ít nhất 12rem, không thì màn hẹp cột tên co về 0 và các tiêu đề đè lên nhau.
 */
// Mã và tên chung một cột (tên trên, mã dưới), ghi chú là nút nhỏ: bảng vừa khung bên trái của màn 1366px, không cuộn
// ngang (rà soát 27/11/2026 — cột Tình trạng từng bị cắt).
const COLS_VIEW = ["", "w-44", "w-60", "w-40"];
const COLS_EDIT = ["", "w-32", "w-36", "w-32", "w-28", "w-20"];
/** Ô đầu và ô cuối của dòng thẳng mép với chữ trong thẻ. */
const ROW_EDGE = "[&>*:first-child]:ps-4 [&>*:last-child]:pe-4";

/**
 * Nhãn một ô của thanh lọc kết quả: chữ + số đếm. Số có màu theo nhóm (khớp xanh, chênh lệch đỏ) khi ô KHÔNG được
 * chọn; ô đang chọn nằm trên viên màu chính nên số theo màu chữ trắng của viên.
 */
function FilterLabel({ label, count, tone, active }: {
  label: string;
  count: number;
  tone?: "success" | "destructive" | "warning";
  active: boolean;
}) {
  const tones = { success: "text-success-text", destructive: "text-destructive-text", warning: "text-warning-text" };
  return (
    <>
      {label}
      <span className={cn("tabular-nums", count > 0 && "font-semibold", !active && count > 0 && tone ? tones[tone] : undefined)}>{count}</span>
    </>
  );
}

function FoundToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opt = (v: string, label: string, on: string) => (
    <button
      type="button"
      onClick={() => value !== v && onChange(v)}
      aria-pressed={value === v}
      className={cn(
        "h-8 flex-1 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors",
        value === v ? on : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="bg-field flex gap-0.5 rounded-lg border p-0.5">
      {opt("yes", "Có", "bg-success text-success-foreground")}
      {opt("no", "Không", "bg-destructive text-white")}
    </div>
  );
}

/**
 * Bảng kiểm đếm. Mỗi dòng: có thấy không, thấy ở đâu, tình trạng thế nào. Mặc định "như sổ" để
 * cán bộ chỉ sửa những dòng lệch. Bảng CUỘN TRONG KHUNG (không trải vài trăm dòng ra cả trang),
 * lọc được theo ô kết quả phía trên, theo phòng trên sổ và theo mã / tên; thanh lưu nằm ngay dưới.
 */
function CountingPanel({ record, editable, filter, setFilter }: {
  record: InventorySession;
  editable: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  // PHÂN TRANG có nút (trước: cuộn tới đâu vẽ thêm tới đó — cuộn sâu là vài nghìn dòng trên trang, màn giật). Mỗi
  // trang cố định `pageSize` dòng; số dòng mỗi trang nhớ theo máy. Bản nháp giữ qua các trang, lưu một lần.
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(true);
  const mobile = useIsMobile();
  const [pageSize, setPageSize] = usePersistentState<number>("inventory.count.pageSize.v2", PAGE, "local");
  // KIỂM THEO TỪNG PHÒNG: mỗi phòng (theo hệ thống) một dòng tiêu đề có mũi tên, mặc định ĐÓNG — tổ kiểm kê đứng ở
  // phòng nào mở phòng đó. Phòng nhiều thiết bị phân trang ngay trong phòng (`roomPages`), không vẽ cả trăm dòng.
  const [openRooms, setOpenRooms] = useState<Set<string>>(() => new Set());
  const [roomPages, setRoomPages] = useState<Record<string, number>>({});
  const toggleRoom = (key: string) =>
    setOpenRooms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const scrollBox = useRef<HTMLDivElement>(null);
  const { result: rooms } = useList<{ id: number; name: string }>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: record.school.id }],
    pagination: { currentPage: 1, pageSize: 200 },
    queryOptions: { enabled: editable },
  });
  const roomList = useMemo(() => rooms?.data ?? [], [rooms?.data]);

  // Bản nháp ban đầu của từng dòng. Dòng chưa ai đụng giữ NGUYÊN đối tượng này trong `drafts`, nên "đã sửa
  // chưa" chỉ phải so chuỗi JSON cho những dòng đã đổi đối tượng — không phải mọi dòng ở mỗi lần bấm.
  const initial = useMemo(
    () => Object.fromEntries(record.lines.map((l) => [l.id, draftOf(l)])) as Record<number, Draft>,
    [record.lines],
  );
  useEffect(() => {
    setDrafts(initial);
  }, [record.id, record.updatedAt, initial]);

  const dirty = useMemo(
    () => record.lines.filter((l) => {
      const d = drafts[l.id];
      return d && d !== initial[l.id] && JSON.stringify(d) !== JSON.stringify(initial[l.id]);
    }),
    [record.lines, drafts, initial],
  );
  // Ổn định qua các lần vẽ: dòng là `memo`, bấm một dòng chỉ vẽ lại dòng đó (trước: cả 50 dòng, trễ 0,2–0,4 giây).
  const set = useCallback(
    (id: number, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    [],
  );

  // Phòng trên sổ của các dòng — lọc theo đúng chỗ tổ kiểm kê đang đứng.
  const expectedRooms = useMemo(() => {
    const m = new Map<string, { key: string; label: string; count: number }>();
    for (const l of record.lines) {
      const key = l.expectedRoom ? String(l.expectedRoom.id) : "none";
      const room = m.get(key) ?? { key, label: l.expectedRoom?.name ?? "Kho (chưa xếp phòng)", count: 0 };
      room.count += 1;
      m.set(key, room);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [record.lines]);

  const needle = fold(term.trim());
  // Lọc + xếp chỉ theo DỮ LIỆU và bộ lọc — bấm "Có / Không" hay gõ ghi chú (đổi `drafts`) không làm lại.
  const roomKey = (l: InventoryLine) => l.expectedRoom?.name ?? "Kho (chưa xếp phòng)";
  const { visible, roomTotals } = useMemo(() => {
    const visible = record.lines.filter((l) => {
      if (needle && !fold(`${l.equipmentCode} ${l.equipmentName}`).includes(needle)) return false;
      if (roomFilter && (l.expectedRoom ? String(l.expectedRoom.id) : "none") !== roomFilter) return false;
      switch (filter) {
        case "unchecked":
          return l.found == null;
        case "matched":
          return l.found != null && l.discrepancies.length === 0;
        case "diff":
          return l.discrepancies.length > 0;
        case "all":
          return true;
        default:
          return l.discrepancies.includes(filter);
      }
    });

    // Xếp theo PHÒNG TRÊN SỔ rồi mới theo số thứ tự: tổ kiểm kê đi từng phòng, nên các tài sản cùng phòng
    // phải đứng liền nhau; dòng tiêu đề phòng chen vào mỗi khi phòng đổi.
    visible.sort((x, y) => roomKey(x).localeCompare(roomKey(y), "vi") || x.lineNo - y.lineNo);
    const roomTotals = new Map<string, { total: number; checked: number }>();
    for (const l of visible) {
      const t = roomTotals.get(roomKey(l)) ?? { total: 0, checked: 0 };
      t.total += 1;
      if (l.found != null) t.checked += 1;
      roomTotals.set(roomKey(l), t);
    }
    return { visible, roomTotals };
  }, [record.lines, needle, roomFilter, filter]);

  // Các phòng theo thứ tự đã xếp — mỗi phòng giữ dòng của nó.
  const groups = useMemo(() => {
    const m = new Map<string, InventoryLine[]>();
    for (const l of visible) {
      const k = roomKey(l);
      const arr = m.get(k);
      if (arr) arr.push(l);
      else m.set(k, [l]);
    }
    return [...m.entries()].map(([key, lines]) => ({ key, lines }));
  }, [visible]);

  // Đổi bộ lọc là về trang đầu; lưu xong vẫn ở trang đang làm. Đổi trang thì về đầu khung.
  useEffect(() => {
    setPage(1);
    setRoomPages({});
  }, [term, roomFilter, filter, pageSize]);
  // Đang tìm theo mã / tên: kết quả thường vài dòng — mở sẵn các phòng có kết quả cho thấy ngay.
  useEffect(() => {
    if (needle) setOpenRooms(new Set(groups.map((g) => g.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);
  useEffect(() => {
    scrollBox.current?.scrollTo({ top: 0 });
  }, [page, term, roomFilter, filter]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const shown = visible.slice((page - 1) * pageSize, page * pageSize);

  async function save() {
    const payload = dirty
      .filter((l) => drafts[l.id].found !== UNSET)
      .map((l) => {
        const d = drafts[l.id];
        return {
          lineId: l.id,
          found: d.found === "yes",
          foundRoom: d.room === SAME ? null : { id: Number(d.room) },
          foundCondition: d.condition === SAME ? null : d.condition,
          countedQuantity: d.found === "yes" && l.expectedQuantity != null && d.qty.trim() !== "" ? Number(d.qty) : null,
          note: d.note || null,
          details: d.details,
        };
      });
    if (payload.length === 0) return;
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/${record.id}/count`, { json: { lines: payload } });
      open?.({ type: "success", message: `Đã lưu kết quả ${payload.length} dòng` });
      invalidate({ resource: RESOURCE, invalidates: ["detail", "list"], id: record.id });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  // Chỉ áp cho các dòng ĐANG HIỆN chưa kiểm — lọc theo một phòng rồi bấm là "cả phòng này đủ".
  function markFound(lines: InventoryLine[]) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const l of lines) if (next[l.id]?.found === UNSET) next[l.id] = { ...next[l.id], found: "yes" };
      return next;
    });
  }
  const diffCount = record.lines.filter((l) => l.discrepancies.length > 0).length;
  const unchecked = record.summary.total - record.summary.checked;
  const inDiff = filter === "diff" || KIND_FILTERS.includes(filter);
  const kinds = ([
    ["MISSING", record.summary.missing],
    ["WRONG_ROOM", record.summary.wrongRoom],
    ["CONDITION", record.summary.wrongCondition],
  ] as const).filter(([, n]) => n > 0);
  // Tiêu đề phòng chỉ có nghĩa khi bảng trải qua nhiều phòng.
  const grouped = roomTotals.size > 1;
  const cols = editable ? COLS_EDIT : COLS_VIEW;

  const FILTER_LABEL: Record<Filter, string> = {
    all: "Tất cả",
    unchecked: "Chưa kiểm",
    matched: "Khớp",
    diff: "Có chênh lệch",
    MISSING: "Thiếu",
    WRONG_ROOM: "Sai vị trí",
    CONDITION: "Sai tình trạng",
  };

  return (
    <Card className="gap-0 overflow-hidden pt-3 pb-0">
      {/* MỘT hàng theo thứ tự dùng: tìm → lọc phòng, lọc loại chênh lệch (mỗi điều kiện một nút tròn) → nhóm kết quả →
          việc làm cho cả nhóm. */}
      <CardContent className="px-4 pb-3">
        {/* Tiêu đề khối có mũi tên (mặc định mở — chỗ làm việc chính) và nút kiểm kê bằng điện thoại. */}
        <div className={cn("flex items-center justify-between gap-2", expanded && "mb-3")}>
          <StepTitle title="Thiết bị" open={expanded} onToggle={() => setExpanded(!expanded)}
            aside={<span className="tabular-nums">{record.summary.checked.toLocaleString("vi-VN")}/{record.summary.total.toLocaleString("vi-VN")} đã kiểm</span>} />
          {/* Đang ở trên điện thoại thì không cần mã QR để mở trên điện thoại. */}
          {mobile ? null : <MobileQrButton sessionId={record.id} suggest={editable} />}
        </div>
        {expanded ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm mã, tên thiết bị…" className="pl-8" aria-label="Tìm thiết bị" />
          </div>
          {expectedRooms.length > 1 ? (
            <IconFilter icon={<DoorOpen />} label="phòng trong hệ thống" allLabel="Mọi phòng" total={record.lines.length}
              groups={[{ items: expectedRooms }]} value={roomFilter} onChange={setRoomFilter} />
          ) : null}
          {kinds.length > 1 ? (
            <IconFilter icon={<TriangleAlert />} label="loại chênh lệch" allLabel="Mọi chênh lệch" total={diffCount}
              groups={[{ items: kinds.map(([k, n]) => ({ key: k, label: DISCREPANCY_LABELS[k], count: n })) }]}
              value={KIND_FILTERS.includes(filter) ? filter : null}
              onChange={(v) => setFilter((v as Filter | null) ?? "diff")} />
          ) : null}
          {/* Nút chọn chung (`Segmented`): viên màu chính trượt sang ô mới — cùng kiểu với thanh tab, Làm việc / Văn bản. */}
          <Segmented<"all" | "unchecked" | "matched" | "diff">
            label="Lọc theo kết quả"
            value={inDiff ? "diff" : (filter as "all" | "unchecked" | "matched")}
            onChange={setFilter}
            options={[
              { value: "all" as const, hint: "Mọi thiết bị của phiên kiểm kê", label: <FilterLabel label="Tất cả" count={record.summary.total} active={filter === "all"} /> },
              ...(editable || unchecked > 0
                ? [{ value: "unchecked" as const, hint: "Thiết bị chưa được kiểm", label: <FilterLabel label="Chưa kiểm" count={unchecked} tone="warning" active={filter === "unchecked"} /> }]
                : []),
              { value: "matched" as const, hint: "Thực tế khớp hệ thống", label: <FilterLabel label="Khớp" count={record.summary.matched} tone="success" active={filter === "matched"} /> },
              { value: "diff" as const, hint: "Thiếu, thừa, sai vị trí hoặc sai tình trạng", label: <FilterLabel label="Chênh lệch" count={diffCount} tone="destructive" active={inDiff} /> },
            ]}
          />
          {/* Thay nút "Đủ cả N dòng" (đánh dấu hàng nghìn dòng một lần bấm — dễ bấm nhầm): kiểm kê đi từng phòng bằng
              điện thoại; "Đủ cả phòng" vẫn ở từng dòng phòng. */}
        </div>
        ) : null}
      </CardContent>

      {expanded ? (
      <>

      {/* Bảng chung cuộn trong khung: bỏ cuộn riêng của `Table` để tiêu đề dính theo khung này. Khung cao gần kín màn —
          đây là chỗ làm việc chính của phiếu; tổng hợp, thiết bị thừa, tệp ở dưới. */}
      <div ref={scrollBox} className="h-[calc(100svh-17rem)] min-h-80 overflow-auto border-t [&>[data-slot=table-container]]:overflow-visible">
        <Table className={cn("table-fixed", !mobile && (editable ? "min-w-[48rem]" : "min-w-[46rem]"))}>
          {mobile ? null : (
          <colgroup>
            {cols.map((w, i) => <col key={i} className={w || undefined} />)}
          </colgroup>
          )}
          <TableHeader sticky className={mobile ? "hidden" : undefined}>
            <TableRow className={ROW_EDGE}>
              <TableHead>Thiết bị</TableHead>
              <TableHead>Hệ thống ghi</TableHead>
              {editable ? (
                <>
                  <TableHead>Có thấy?</TableHead>
                  <TableHead>Thấy ở</TableHead>
                  <TableHead>Tình trạng</TableHead>
                  <TableHead />
                </>
              ) : (
                <>
                  <TableHead>Kết quả kiểm</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableEmpty colSpan={cols.length} filtered
                title={filter === "all" ? "Không có dòng nào khớp ô tìm" : `Không có dòng nào thuộc nhóm “${FILTER_LABEL[filter]}”`} />
            ) : (
              grouped ? groups.map((g) => {
                const isOpen = openRooms.has(g.key);
                // Đếm theo BẢN NHÁP (cả ô vừa tích chưa lưu) — tích tới đâu số nhảy tới đó.
                const head = {
                  total: g.lines.length,
                  checked: g.lines.filter((l) => (drafts[l.id] ?? initial[l.id])?.found !== UNSET).length,
                };
                const roomPageCount = Math.max(1, Math.ceil(g.lines.length / pageSize));
                const roomPage = Math.min(roomPages[g.key] ?? 1, roomPageCount);
                const roomShown = isOpen ? g.lines.slice((roomPage - 1) * pageSize, roomPage * pageSize) : [];
                const roomUnchecked = editable ? g.lines.filter((l) => drafts[l.id]?.found === UNSET).length : 0;
                const done = head.total > 0 && head.checked === head.total;
                return (
                  <Fragment key={g.key}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={cols.length} className={cn("bg-surface-subtle h-11 py-1 ps-2 pe-3 whitespace-normal", isOpen && "border-primary/30 border-b")}>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleRoom(g.key)} aria-expanded={isOpen}
                            className="hover:text-primary flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left">
                            <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
                            <span className="truncate text-sm font-semibold max-md:line-clamp-2 max-md:whitespace-normal">{g.key}</span>
                            <span className={cn("shrink-0 text-xs tabular-nums", done ? "text-success-text" : "text-muted-foreground")}>
                              {head.checked}/{head.total} đã kiểm
                            </span>
                          </button>
                          {roomUnchecked > 0 ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-xs"
                              title="Đánh dấu “Có, như hệ thống” cho mọi thiết bị chưa kiểm của phòng này"
                              onClick={() => {
                                markFound(g.lines);
                                setOpenRooms((prev) => new Set(prev).add(g.key));
                              }}>
                              <CheckCheck />
                              {/* Điện thoại: chỉ biểu tượng — nhường chỗ cho tên phòng. */}
                              <span className="max-md:sr-only">Đủ cả phòng</span>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {roomShown.map((l) => (
                      <CountRow key={l.id} line={l} draft={drafts[l.id] ?? initial[l.id]} editable={editable} rooms={roomList} onSet={set} mobile={mobile} />
                    ))}
                    {isOpen && roomPageCount > 1 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={cols.length} className="py-1.5 pe-3">
                          <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
                            <span className="tabular-nums">
                              {(roomPage - 1) * pageSize + 1}–{Math.min(roomPage * pageSize, g.lines.length)} / {g.lines.length} · Trang {roomPage}/{roomPageCount}
                            </span>
                            <Button type="button" variant="outline" size="icon-sm" aria-label="Trang trước" disabled={roomPage <= 1}
                              onClick={() => setRoomPages((p) => ({ ...p, [g.key]: roomPage - 1 }))}>
                              <ChevronLeft />
                            </Button>
                            <Button type="button" variant="outline" size="icon-sm" aria-label="Trang sau" disabled={roomPage >= roomPageCount}
                              onClick={() => setRoomPages((p) => ({ ...p, [g.key]: roomPage + 1 }))}>
                              <ChevronRight />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              }) : shown.map((l) => (
                <CountRow key={l.id} line={l} draft={drafts[l.id] ?? initial[l.id]} editable={editable} rooms={roomList} onSet={set} mobile={mobile} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-surface-subtle flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          {grouped ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span className="tabular-nums">{groups.length} phòng · {visible.length.toLocaleString("vi-VN")} thiết bị</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => setOpenRooms(openRooms.size ? new Set() : new Set(groups.map((g) => g.key)))}>
                {openRooms.size ? "Đóng hết" : "Mở hết"}
              </Button>
            </div>
          ) : (
            <DataTablePagination compact currentPage={page} pageCount={pageCount} setCurrentPage={setPage}
              pageSize={pageSize} setPageSize={setPageSize} total={visible.length} pageSizeLabel="Số dòng mỗi trang" />
          )}
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            {dirty.length ? <span className="text-primary text-xs font-medium tabular-nums">{dirty.length} dòng chưa lưu</span> : null}
            <Button type="button" variant="outline" size="sm" disabled={busy || dirty.length === 0}
              onClick={() => setDrafts(initial)}>
              <Undo2 />
              Bỏ thay đổi
            </Button>
            <Button type="button" size="sm" disabled={busy || dirty.length === 0} onClick={() => void save()}>
              <Save />
              {busy ? "Đang lưu…" : `Lưu kết quả${dirty.length ? ` ${dirty.length} dòng` : ""}`}
            </Button>
          </div>
        ) : null}
      </div>
      </>
      ) : null}
    </Card>
  );
}

type RoomOption = { id: number; name: string };

/**
 * Một dòng kiểm đếm — `memo`: chỉ vẽ lại khi CHÍNH dòng này đổi (bản nháp, dữ liệu dòng), không theo dòng khác.
 * Bảng vài nghìn thiết bị bấm "Có / Không" liên tục, vẽ lại cả trang mỗi lần bấm là màn giật.
 */
type RowProps = { l: InventoryLine; d: Draft; onSet: (id: number, patch: Partial<Draft>) => void };

/** Có / Không + số đếm được (hoá chất, vật tư theo lô). */
function FoundPick({ l, d, onSet }: RowProps) {
  return (
    <>
      <FoundToggle value={d.found} onChange={(v) => onSet(l.id, { found: v })} />
      {/* Hoá chất, vật tư theo lô: ghi số đếm được, trống là đủ như sổ. */}
      {l.expectedQuantity != null && d.found === "yes" ? (
        <Input className="h-8 w-14 px-1.5" inputMode="decimal" value={d.qty} placeholder={`${number.format(l.expectedQuantity)}`}
          title={`Số lượng đếm được — hệ thống ghi ${number.format(l.expectedQuantity)}`} aria-label="Số lượng đếm được"
          onChange={(e) => onSet(l.id, { qty: e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".") })} />
      ) : null}
    </>
  );
}

/** Thấy ở phòng nào — mặc định là phòng trên sổ. */
function RoomPick({ l, d, rooms, onSet }: RowProps & { rooms: RoomOption[] }) {
  return (
    <Select value={d.room} onValueChange={(v) => onSet(l.id, { room: v })}>
      <SelectTrigger className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-64">
        {/* Lựa chọn mặc định nói thẳng GIÁ TRỊ trên sổ — "Như sổ" trống không buộc người kiểm nhìn sang cột khác mới biết là phòng nào. */}
        <SelectItem value={SAME}>{l.expectedRoom?.name ?? "Kho"} <span data-suffix className="text-muted-foreground">(đúng hệ thống)</span></SelectItem>
        {rooms.filter((r) => r.id !== l.expectedRoom?.id).map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Tình trạng thấy thực tế — mặc định là tình trạng trên sổ. */
function ConditionPick({ l, d, onSet }: RowProps) {
  return (
    <Select value={d.condition} onValueChange={(v) => onSet(l.id, { condition: v })}>
      <SelectTrigger className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={SAME}>{l.expectedCondition ? EQUIPMENT_CONDITION_LABELS[l.expectedCondition] : "Chưa ghi"} <span data-suffix className="text-muted-foreground">(đúng hệ thống)</span></SelectItem>
        {Object.entries(EQUIPMENT_CONDITION_LABELS).filter(([v]) => v !== l.expectedCondition).map(([v, label]) => (
          <SelectItem key={v} value={v}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ghi chú: nút nhỏ (tô màu khi đã có), bấm mở ô nhập. */
function NotePop({ l, d, onSet }: RowProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Ghi chú"
          title={d.note ? `Ghi chú: ${d.note}` : "Thêm ghi chú"} className={d.note ? "text-primary" : "text-muted-foreground"}>
          <MessageSquareText />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <Input autoFocus value={d.note} placeholder="Ghi chú, nguyên nhân chênh lệch…" maxLength={maxLengthOf("NOTE", 255)}
          onChange={(e) => onSet(l.id, { note: e.target.value })} />
      </PopoverContent>
    </Popover>
  );
}

/** Kết quả kiểm (dạng xem): nhãn chênh lệch + điều khác sổ. */
function ResultText({ l }: { l: InventoryLine }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {l.found == null ? (
        <span className="text-muted-foreground font-normal">Chưa kiểm</span>
      ) : l.discrepancies.length === 0 ? (
        <span className="text-success-text font-normal">Khớp hệ thống</span>
      ) : (
        <>
          {l.discrepancies.map((x) => (
            <Badge key={x} variant={x === "MISSING" ? "destructive" : "warning"}>{DISCREPANCY_LABELS[x]}</Badge>
          ))}
          {(() => {
            // Chỉ nói điều nhãn chưa nói: phòng thực tế và tình trạng khi khác sổ.
            const room = l.found && l.foundRoom && l.foundRoom.id !== l.expectedRoom?.id ? `ở ${l.foundRoom.name}` : null;
            const cond = l.found && l.foundCondition && l.foundCondition !== l.expectedCondition
              ? EQUIPMENT_CONDITION_LABELS[l.foundCondition] : null;
            const qty = l.discrepancies.includes("SHORTAGE") && l.expectedQuantity != null
              ? `đếm ${number.format(l.countedQuantity ?? 0)} / ${number.format(l.expectedQuantity)}` : null;
            const text = [room, cond, qty].filter(Boolean).join(" · ");
            return text ? <span className="text-muted-foreground truncate font-normal" title={text}>{text}</span> : null;
          })()}
        </>
      )}
    </span>
  );
}

const CountRow = memo(function CountRow({ line: l, draft: d, editable, rooms, onSet, mobile }: {
  line: InventoryLine;
  draft: Draft;
  editable: boolean;
  rooms: RoomOption[];
  onSet: (id: number, patch: Partial<Draft>) => void;
  /** Màn nhỏ (điện thoại): một THẺ xếp dọc thay cho năm cột — không cuộn ngang, nút bấm đủ to. */
  mobile?: boolean;
}) {
  const changed = editable && JSON.stringify(d) !== JSON.stringify(draftOf(l));
  const expected = `${l.expectedRoom?.name ?? "Kho"}${l.expectedCondition ? ` · ${EQUIPMENT_CONDITION_LABELS[l.expectedCondition]}` : ""}`;
  const edit = editable ? "h-12 px-2 py-1" : undefined;
  if (mobile) {
    return (
      <TableRow className={cn("hover:bg-transparent", changed && "bg-primary/5")}>
        <TableCell colSpan={editable ? COLS_EDIT.length : COLS_VIEW.length} className="space-y-2 !px-4 py-3 whitespace-normal">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium break-words">{l.equipmentName}</div>
              <div className="text-muted-foreground font-mono text-xs">{l.equipmentCode}</div>
              <div className="text-muted-foreground text-xs">Hệ thống ghi: {expected}</div>
            </div>
            {editable ? <NotePop l={l} d={d} onSet={onSet} /> : null}
          </div>
          {editable ? (
            <>
              <div className="flex items-center gap-2"><FoundPick l={l} d={d} onSet={onSet} /></div>
              {d.found === "yes" ? (
                <div className="grid grid-cols-2 gap-2">
                  <RoomPick l={l} d={d} rooms={rooms} onSet={onSet} />
                  <ConditionPick l={l} d={d} onSet={onSet} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <ResultText l={l} />
              {l.note ? <div className="text-muted-foreground text-xs">{l.note}</div> : null}
            </>
          )}
        </TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow className={cn(ROW_EDGE, !editable && cn("group/row", LIFT_ROW), changed && "bg-primary/5")}>
      {/* Tên trên, mã dưới — một cột thay cho ba (#, mã, tên). Không ghi số thứ tự toàn biên bản: chia theo phòng thì số nhảy cóc, vô nghĩa. */}
      <TableCell className={cn(edit, "min-w-0")}>
        <div className="truncate" title={l.equipmentName}>{l.equipmentName}</div>
        <div className="text-muted-foreground truncate font-mono text-xs font-normal">
          {l.equipmentCode}
        </div>
      </TableCell>
      <TableCell className={cn(edit, "text-muted-foreground truncate font-normal")} title={expected}>{expected}</TableCell>
      {editable ? (
        <>
          <TableCell className={edit}>
            <span className="flex items-center gap-1.5">
              <FoundPick l={l} d={d} onSet={onSet} />
            </span>
          </TableCell>
          <TableCell className={edit}>
            {d.found === "yes" ? (
              <RoomPick l={l} d={d} rooms={rooms} onSet={onSet} />
            ) : (
              <span className="text-muted-foreground">{d.found === "no" ? "Không thấy" : "Chưa kiểm"}</span>
            )}
          </TableCell>
          <TableCell className={edit}>
            {d.found === "yes" ? (
              <ConditionPick l={l} d={d} onSet={onSet} />
            ) : (
              <span className="text-muted-foreground">{d.found === "no" ? "Không thấy" : "Chưa kiểm"}</span>
            )}
          </TableCell>
          <TableCell className={edit}>
            <span className="flex justify-end gap-0.5">
              {/* Ghi chú: nút nhỏ (tô màu khi đã có), bấm mở ô nhập — không chiếm một cột rộng trên mọi dòng. */}
              <NotePop l={l} d={d} onSet={onSet} />
            </span>
          </TableCell>
        </>
      ) : (
        <>
          {/* Một cột: nhãn kết quả + điều khác sổ (thấy ở đâu, tình trạng gì). Khớp thì một chữ nhẹ. */}
          <TableCell>
            <ResultText l={l} />
          </TableCell>
          <TableCell className="text-muted-foreground truncate font-normal" title={l.note || undefined}>
            {l.note || "Không có ghi chú"}
          </TableCell>
        </>
      )}
    </TableRow>
  );
});

/** Tài sản thừa: thấy mà sổ không có. Duyệt biên bản xong sẽ thành một phiếu nhập nháp. */
function SurplusPanel({ record, editable }: { record: InventorySession; editable: boolean }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  // Thiết bị thừa CHỌN TỪ DANH MỤC (hộp chọn như phiếu ghi tăng; không có thì "Thêm ngoài danh mục" ngay trong hộp) —
  // tên là tên trong danh mục, không gõ "tên thực tế" riêng.
  type Row = { catalog: number; label: string; quantity: number; note: string };
  const toRows = (): Row[] => record.surplus.map((s) => ({
    catalog: s.catalog.id,
    label: s.catalog.code ? `${s.catalog.code} · ${s.catalog.name}` : s.catalog.name,
    quantity: s.quantity,
    note: s.note ?? "",
  }));
  const [rows, setRows] = useState(toRows);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    setRows(toRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.updatedAt, record.surplus]);

  async function save() {
    const problem = rows.map((r) =>
      numberError("QUANTITY", "Số lượng", r.quantity) ?? textError("NOTE", "Ghi chú", r.note, 255),
    ).find(Boolean);
    if (problem) {
      open?.({ type: "error", message: problem });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.patch(`${RESOURCE}/${record.id}`, {
        json: {
          surplus: rows.map((r) => ({ catalog: { id: r.catalog }, name: null, quantity: Number(r.quantity) || 1, note: r.note || null })),
        },
      });
      open?.({ type: "success", message: "Đã lưu danh sách thiết bị thừa" });
      invalidate({ resource: RESOURCE, invalidates: ["detail"], id: record.id });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (!editable && record.surplus.length === 0) return null;
  const update = (i: number, patch: Partial<Row>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = new Set(rows.map((r) => r.catalog));
  return (
    <Card id="inventory-surplus" className="py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepTitle
            title="Thiết bị thừa"
            aside={<span className="tabular-nums">{rows.length} dòng</span>}
            hint="Có thật nhưng chưa có trong hệ thống. Chọn đúng thiết bị trong danh mục; không có thì thêm ngoài danh mục ngay trong hộp chọn."
            open={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
          {editable ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setExpanded(true);
                setPicking(true);
              }}>
                <Plus />
                Thêm thiết bị
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
                <Save />
                Lưu
              </Button>
            </div>
          ) : null}
        </div>
        {/* Khung CAO CỐ ĐỊNH: thêm dòng không làm khối dài ra, bảng cuộn bên trong, tiêu đề dính. */}
        {expanded ? (
        <div className="h-72 overflow-auto rounded-lg border [&>[data-slot=table-container]]:overflow-visible">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-28" />
              <col className="w-64" />
              <col className="w-12" />
            </colgroup>
            <TableHeader sticky>
              <TableRow>
                <TableHead className="text-center">#</TableHead>
                <TableHead>Thiết bị (danh mục)</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead><span className="sr-only">Thao tác</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={5} title="Chưa ghi thiết bị thừa nào." />
              ) : rows.map((r, i) => (
                <TableRow key={r.catalog} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="text-muted-foreground text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell><div className="truncate" title={r.label}>{r.label}</div></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {editable ? (
                      <Input className="h-8 text-right tabular-nums" type="number" min={1} value={r.quantity}
                        onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                    ) : r.quantity}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Input className="h-8" value={r.note} placeholder="Ghi chú" maxLength={maxLengthOf("NOTE", 255)} onChange={(e) => update(i, { note: e.target.value })} />
                    ) : (
                      <span className="text-muted-foreground truncate">{r.note || "Không có ghi chú"}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-1">
                    {editable ? (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá dòng"
                        className="text-muted-foreground hover:text-destructive" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        ) : null}
      </CardContent>
      {editable ? (
        <CatalogPickerDialog
          open={picking}
          onOpenChange={setPicking}
          schoolId={record.school.id}
          exclude={chosen}
          title="Chọn thiết bị thừa"
          description="Chọn thiết bị trong danh mục; không có thì bấm Thêm ngoài danh mục."
          onPick={(picked) => {
            setRows((all) => [
              ...all,
              ...picked.filter((c) => !chosen.has(c.id)).map((c) => ({ catalog: c.id, label: `${c.code} · ${c.name}`, quantity: 1, note: "" })),
            ]);
            setPicking(false);
          }}
        />
      ) : null}
    </Card>
  );
}

/**
 * Một khuôn bảng cho biên bản kiểm kê (KK-07) — cả dạng văn bản trên màn lẫn bản in: số lượng sổ ghi / đếm được với
 * hoá chất, vật tư theo lô, kết quả đối chiếu và ghi chú của từng dòng.
 */
const REPORT_HEADERS = ["STT", "Mã thiết bị", "Tên thiết bị", "Hệ thống ghi", "Thực tế", "Kết quả", "Ghi chú"];

function reportRows(record: InventorySession): (string | number)[][] {
  return record.lines.map((l, i) => [
    i + 1,
    l.equipmentCode,
    l.equipmentName,
    `${l.expectedRoom?.name ?? "Kho"}${l.expectedQuantity != null ? ` · SL ${number.format(l.expectedQuantity)}` : ""}`,
    l.found == null ? "Chưa kiểm" : l.found
      ? `${l.foundRoom?.name ?? "Như hệ thống"}${l.expectedQuantity != null ? ` · SL ${number.format(l.countedQuantity ?? l.expectedQuantity)}` : ""}`
      : "Không thấy",
    l.discrepancies.map((x) => DISCREPANCY_LABELS[x]).join(", ") || (l.found != null ? "Khớp" : ""),
    l.note ?? "",
  ]);
}

/** Phiếu kiểm kê ở các trạng thái này khoá số liệu (máy chủ: `InventoryFreeze.COUNTING`). */
const FROZEN: VoucherStatus[] = ["DRAFT", "PENDING"];

/** Câu "đang ở đâu, việc kế tiếp là gì" trong thẻ tóm tắt — thay cho dải mũi tên bước lớn trên đầu trang. */
const STAGE: Record<VoucherStatus, { icon: ReactNode; tone: string; text: string }> = {
  DRAFT: { icon: <FilePen />, tone: "bg-neutral-subtle text-neutral-text", text: "Đang kiểm đếm. Kiểm xong thì trình biên bản." },
  PENDING: { icon: <Clock />, tone: "bg-warning-subtle text-warning-text", text: "Kết quả đã chốt, chờ duyệt." },
  APPROVED: { icon: <CheckCircle2 />, tone: "bg-success-subtle text-success-text", text: "Đã duyệt, kết quả đã ghi vào lịch sử thiết bị." },
  COMPLETED: { icon: <CheckCircle2 />, tone: "bg-success-subtle text-success-text", text: "Đã duyệt, kết quả đã ghi vào lịch sử thiết bị." },
  REJECTED: { icon: <AlertCircle />, tone: "bg-destructive-subtle text-destructive-text", text: "Biên bản bị từ chối." },
  CANCELLED: { icon: <AlertCircle />, tone: "bg-neutral-subtle text-neutral-text", text: "Phiếu đã huỷ." },
};

/**
 * Biên bản kiểm kê — cùng khuôn HAI CỘT với phiếu ghi tăng (`VoucherTwoColumn`). Trái là việc: hàng
 * công cụ (số đếm cũng là bộ lọc), bảng kiểm đếm cuộn trong khung, tài sản thừa, thông tin bổ sung,
 * tệp đính kèm. Phải là thẻ tóm tắt dính khi cuộn: thông tin phiếu, phiếu đang ở bước nào, số đã
 * kiểm, tổ kiểm kê. Trạng thái nằm cạnh tiêu đề; không còn dải mũi tên bước. Duyệt xong biên bản
 * chỉ ghi nhận; phiếu xử lý chênh lệch do người dùng lập nhanh ở `InventoryFollowUps`.
 */
/** Câu kết luận gợi ý theo số liệu kiểm đếm — tổ kiểm kê sửa lại nếu cần. */
function suggestConclusion(record: InventorySession) {
  const s = record.summary;
  const n = (x: number) => x.toLocaleString("vi-VN");
  const parts = [
    s.missing ? `thiếu ${n(s.missing)}` : null,
    s.wrongRoom ? `sai vị trí ${n(s.wrongRoom)}` : null,
    s.wrongCondition ? `sai tình trạng ${n(s.wrongCondition)}` : null,
    s.surplus ? `thừa ${n(s.surplus)}` : null,
  ].filter(Boolean);
  return `Đã kiểm đủ ${n(s.checked)}/${n(s.total)} thiết bị. `
    + (parts.length ? `Có chênh lệch so với hệ thống: ${parts.join(", ")}; đề nghị xử lý theo quy định.` : "Thực tế khớp với hệ thống, không có chênh lệch.");
}

/**
 * Khối "Kết luận" (sau Thông tin bổ sung): AI kết luận và nội dung — bắt buộc trước khi trình (validateSubmit). Chỉ nhập
 * được khi đã kiểm ĐỦ mọi thiết bị (máy chủ cũng chặn). Người kết luận chọn trong tổ kiểm kê, hoặc "Người khác" gõ họ tên;
 * nội dung điền sẵn câu gợi ý theo số liệu.
 */
function ConclusionPanel({ record }: { record: InventorySession }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const s = record.summary;
  const full = s.total > 0 && s.checked === s.total;
  const editable = !!record._actions?.includes("count");
  const canEdit = editable && full;
  const people = (record.council ?? "").split("\n").filter(Boolean).map((x) => x.split(" — ")[0].trim()).filter(Boolean);
  const [expanded, setExpanded] = useState(() => canEdit && !record.conclusion);
  const [by, setBy] = useState(record.concludedBy ?? "");
  const [other, setOther] = useState(() => !!record.concludedBy && !people.includes(record.concludedBy));
  const [text, setText] = useState(() => record.conclusion ?? suggestConclusion(record));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBy(record.concludedBy ?? "");
    setText(record.conclusion ?? suggestConclusion(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.updatedAt]);
  // Kiểm xong mà chưa kết luận: mở sẵn khối.
  useEffect(() => {
    if (canEdit && !record.conclusion) setExpanded(true);
  }, [canEdit, record.conclusion]);

  if (!editable && !record.conclusion) return null;
  const byError = !by.trim() ? "Chọn người kết luận" : textError("PERSON_NAME", "Người kết luận", by, 100, 2);
  const textErr = !text.trim() ? "Nhập nội dung kết luận" : textError("LONG_TEXT", "Nội dung kết luận", text, 2000, 10);
  const dirty = by.trim() !== (record.concludedBy ?? "") || text.trim() !== (record.conclusion ?? "");

  async function save() {
    const problem = byError ?? textErr;
    if (problem) {
      open?.({ type: "error", message: problem });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.patch(`${RESOURCE}/${record.id}`, { json: { concludedBy: by.trim(), conclusion: text.trim() } });
      open?.({ type: "success", message: "Đã lưu kết luận" });
      invalidate({ resource: RESOURCE, invalidates: ["detail"], id: record.id });
    } catch (e) {
      open?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const aside = record.conclusion ? <span className="text-success-text">Đã kết luận</span>
    : full ? <span className="text-warning-text">Chưa nhập</span>
      : <span className="tabular-nums">Kiểm đủ {s.checked.toLocaleString("vi-VN")}/{s.total.toLocaleString("vi-VN")} mới nhập được</span>;

  return (
    <Card id="inventory-conclusion" className="py-4">
      <CardContent className="space-y-3 px-4">
        <StepTitle title="Kết luận" aside={aside} open={expanded} onToggle={() => setExpanded(!expanded)} />
        {!expanded ? null : !canEdit ? (
          record.conclusion ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
              <div><dt className="text-muted-foreground text-xs">Người kết luận</dt><dd className="font-medium">{record.concludedBy ?? "Chưa ghi"}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Nội dung</dt><dd className="whitespace-pre-line">{record.conclusion}</dd></div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">Kiểm đủ mọi thiết bị rồi mới nhập kết luận.</p>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Người kết luận <span className="text-destructive">*</span></p>
              {other ? (
                <Input autoFocus value={by} placeholder="Họ và tên người kết luận" maxLength={100} aria-invalid={!!(by && byError) || undefined}
                  onChange={(e) => {
                    if (!e.target.value) { setOther(false); setBy(""); return; }
                    setBy(e.target.value);
                  }} />
              ) : (
                <Select value={by || undefined} onValueChange={(v) => {
                  if (v === "__other__") { setOther(true); setBy(""); } else setBy(v);
                }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn trong tổ kiểm kê" /></SelectTrigger>
                  <SelectContent>
                    {people.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    <SelectItem value="__other__">Người khác…</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {by && byError ? <p className="text-destructive-text text-xs">{byError}</p> : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Nội dung <span className="text-destructive">*</span></p>
              <Textarea value={text} rows={3} maxLength={2000} aria-invalid={!!textErr || undefined} onChange={(e) => setText(e.target.value)} />
              {textErr ? <p className="text-destructive-text text-xs">{textErr}</p> : null}
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="button" size="sm" disabled={busy || !dirty || !!byError || !!textErr} onClick={() => void save()}>
                <Save />
                {busy ? "Đang lưu…" : "Lưu kết luận"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const InventorySessionShow = () => {
  const { result: record, query } = useShow<InventorySession>({});
  const config = useVoucherForm(RESOURCE);
  const editable = !!record?._actions?.includes("count");
  const s = record?.summary;
  const [filter, setFilter] = useState<Filter>("all");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [councilOpen, setCouncilOpen] = useState(false);
  const councilPeople = (record?.council ?? "").split("\n").filter(Boolean);
  // Tài khoản trường chỉ thấy trường mình: dòng Trường lặp đúng tên đó.
  const { perspective } = usePerspective();
  const pct = s && s.total ? Math.round((s.checked / s.total) * 100) : 0;
  const stage = record ? STAGE[record.status] : null;
  // Biên bản đã chốt (không còn kiểm đếm) mà có chênh lệch: mở sẵn nhóm "Có chênh lệch" — người duyệt cần
  // thấy vài dòng lệch, không phải cuộn qua hai trăm dòng khớp. Chỉ đặt một lần cho mỗi phiếu.
  const lineDiffs = s ? s.missing + s.wrongRoom + s.wrongCondition : 0;
  const preset = useRef<number | null>(null);
  useEffect(() => {
    if (!record || preset.current === record.id) return;
    preset.current = record.id;
    setFilter(!editable && lineDiffs > 0 ? "diff" : "all");
  }, [record, editable, lineDiffs]);
  // Hai dạng xem của cùng một biên bản, như phiếu ghi tăng: "Làm việc" (bảng kiểm đếm) và "Văn bản" (tờ A4).
  // Điện thoại: chỉ dạng Làm việc (dạng Văn bản là tờ A4 để đọc trên máy tính) — bỏ luôn nút chuyển dạng.
  const [storedView, setView] = useVoucherView("inventory");
  const mobile = useIsMobile();
  const view = mobile ? "work" : storedView;
  // Huỷ phiếu và Xoá nằm trong menu ⚙ — menu báo việc được chọn, `VoucherActions` mở hộp hỏi lại.
  const [menuAction, setMenuAction] = useState<TuckedAction | null>(null);
  const tucked = useMemo(() => ({ request: menuAction, clear: () => setMenuAction(null) }), [menuAction]);

  if (query?.isError) {
    return (
      <ShowView>
        <ShowViewHeader />
        <Alert>
          <AlertCircle />
          <AlertTitle>Không mở được phiếu kiểm kê này</AlertTitle>
          <AlertDescription>
            Phiếu có thể đã bị xóa hoặc tài khoản của anh/chị chưa được xem phiếu nháp chưa trình.
            Nếu phiếu đang khóa nghiệp vụ, hãy liên hệ cán bộ thiết bị đang lập phiếu để hoàn tất hoặc hủy.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-fit"><Link to="/inventory-sessions">Về danh sách kiểm kê</Link></Button>
      </ShowView>
    );
  }

  // Dạng làm việc: nút nằm trong thẻ tóm tắt bên phải. Dạng chứng từ ẩn cột đó nên nút về hàng đầu trang — chỉ gắn
  // MỘT cụm mỗi lúc (hai cụm cùng nghe menu ⚙ thì hộp hỏi lại mở hai lần).
  const voucherActions = (layout: "bar" | "side") => (
    <VoucherActions
      resource={RESOURCE}
      record={record}
      tucked={tucked}
      layout={layout}
      invalidates={["equipment", "equipment_intakes"]}
      text={{
        submit: {
          // Cùng điều kiện máy chủ chặn (validateSubmit): kiểm hết mọi dòng, có kết luận — nói trước, không để bấm rồi báo lỗi.
          blocked: !record ? null
            : record.summary.total - record.summary.checked > 0
              ? `Còn ${(record.summary.total - record.summary.checked).toLocaleString("vi-VN")} thiết bị chưa kiểm (hoặc chưa lưu kết quả)`
              : !record.conclusion?.trim() || !record.concludedBy?.trim() ? "Nhập kết luận (người kết luận, nội dung) ở khối Kết luận" : null,
          label: "Trình biên bản",
          title: "Trình biên bản kiểm kê?",
          description: "Kết quả kiểm đếm sẽ được chốt. Lãnh đạo trường duyệt xong thì kết quả được ghi vào lịch sử thiết bị.",
          confirm: "Trình biên bản",
        },
        approve: {
          label: "Duyệt biên bản",
          title: "Duyệt biên bản kiểm kê?",
          description: (
            <ul className="list-disc space-y-1 ps-5">
              {Object.entries(DISCREPANCY_OUTCOMES).map(([k, v]) => (
                <li key={k}>{k === "SURPLUS" ? "Thừa" : DISCREPANCY_LABELS[k as keyof typeof DISCREPANCY_LABELS]}: {v}</li>
              ))}
            </ul>
          ),
          confirm: "Duyệt biên bản",
          done: "Đã duyệt biên bản",
        },
      }}
    />
  );

  return (
    <ShowView>
      <ShowViewHeader
        meta={record ? <VoucherStatusBadge status={record.status} step={record.approvalStep} returned={!!record.returnNote} /> : null}
        more={<VoucherMoreMenu resource={RESOURCE} record={record} onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction} />}
        actions={
          <>
            {record && !mobile ? <VoucherViewSwitch view={view} onChange={setView} /> : null}
            {record && view === "document" ? voucherActions("bar") : null}
          </>
        }
      />

      {record && view === "document" ? (
        <>
          <DocumentSheet
            landscape
            unit={record.school?.name}
            title="Biên bản kiểm kê thiết bị"
            number={record.code}
            date={record.inventoryDate}
            facts={[
              { label: "Tên phiếu", value: record.title, wide: true },
              { label: "Phạm vi", value: record.room?.name ?? "Cả trường" },
              { label: "Đợt kiểm kê", value: record.campaign?.name },
              { label: "Tổ kiểm kê", value: record.council, wide: true },
              ...detailFacts(config, record.details, null),
              { label: "Người kết luận", value: record.concludedBy },
              { label: "Kết luận", value: record.conclusion, wide: true },
            ]}
            table={{ headers: REPORT_HEADERS, rows: reportRows(record), alignCenter: [0], grow: 2 }}
            signers={[{ title: "Người kiểm kê" }, { title: "Kế toán" }, { title: "Thủ trưởng đơn vị" }]}
          />
        </>
      ) : null}

      {record && view === "work" ? (
        <PrintSheet
          unit={record.school?.name}
          title="Biên bản kiểm kê thiết bị"
          subtitle={record.code ? `Số: ${record.code}` : "Phiếu nháp, chưa cấp số"}
          facts={[
            { label: "Tên phiếu", value: record.title },
            { label: "Ngày kiểm kê", value: formatPlainDate(record.inventoryDate) },
            { label: "Phạm vi", value: record.room?.name ?? "Cả trường" },
            ...(record.campaign?.name ? [{ label: "Đợt kiểm kê", value: record.campaign.name }] : []),
            ...(record.council ? [{ label: "Tổ kiểm kê", value: record.council }] : []),
            ...(record.concludedBy ? [{ label: "Người kết luận", value: record.concludedBy }] : []),
            ...(record.conclusion ? [{ label: "Kết luận", value: record.conclusion }] : []),
            ...detailFacts(config, record.details, null),
          ]}
          table={{ headers: REPORT_HEADERS, rows: reportRows(record) }}
          signers={["Người kiểm kê", "Kế toán", "Thủ trưởng đơn vị"]}
        />
      ) : null}

      <LoadingOverlay loading={query.isLoading}>
        <div className={cn("print:hidden", view === "document" && record && "hidden")}>
          <VoucherTwoColumn
            main={
              <>
                {record?.status === "DRAFT" && record.returnNote ? (
                  <ReturnedNotice resource={RESOURCE} id={record.id} note={record.returnNote} noun="Biên bản" />
                ) : null}
                {record?.status === "REJECTED" && record.rejectReason ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Biên bản bị từ chối</AlertTitle>
                    <AlertDescription>{record.rejectReason}</AlertDescription>
                  </Alert>
                ) : null}

                {record ? <CountingPanel record={record} editable={editable} filter={filter} setFilter={setFilter} /> : null}
                {/* Kiểm xong thiết bị là tới hạng mục CSVC (cùng một vòng đi từng phòng), rồi mới tổng hợp, thiết bị thừa. */}
                {record ? <InventoryFacilityPanel record={record} /> : null}
                {record ? <InventoryBreakdown record={record} /> : null}
                {record ? <SurplusPanel record={record} editable={editable} /> : null}

                <VoucherDetailsView config={config} details={record?.details} draft={record?.status === "DRAFT"} foldable />
                {record ? <ConclusionPanel record={record} /> : null}

                {/* Biên bản chỉ ghi nhận — phiếu xử lý chênh lệch do người dùng lập nhanh từ đây. */}
                <InventoryFollowUps sessionId={record?.id} approved={record?.status === "COMPLETED"} />
                <RelatedVouchers resource={RESOURCE} id={record?.id} />

                <AttachmentsPanel
                  compact
                  resource={RESOURCE}
                  recordId={record?.id}
                  // Đã trình duyệt: tệp khoá, không thêm, không xoá (cùng luật máy chủ).
                  canWrite={record?._can?.write === true && record?.status === "DRAFT"}
                  description="Biên bản kiểm kê có chữ ký tổ kiểm kê, ảnh hiện trường."
                />
                <VoucherTimelineDialog resource={RESOURCE} id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} />
              </>
            }
            side={
              <Card className="gap-0 py-0">
                <SideSection title="Phiếu kiểm kê">
                  {/* Tên phiếu làm tiêu đề (thường trùng tên đợt — không ghi hai lần), số phiếu ngay dưới. */}
                  <div className="space-y-0.5">
                    <p className="text-sm leading-5 font-semibold">{record?.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {record?.code ? <span className="text-foreground font-mono">{record.code}</span> : "Số phiếu cấp khi trình"}
                    </p>
                  </div>
                  {perspective === "school" ? null : <SideFact label="Trường">{record?.school?.name}</SideFact>}
                  <SideFact label="Ngày kiểm kê">{formatPlainDate(record?.inventoryDate)}</SideFact>
                  <SideFact label="Phạm vi">{record?.room?.name ?? "Cả trường"}</SideFact>
                  <SideFact label="Đợt">
                    {!record?.campaign
                      ? <span className="text-muted-foreground font-normal">Trường tự kiểm kê</span>
                      : record.campaign.name === record.title ? "Theo đợt của Sở" : record.campaign.name}
                  </SideFact>
                  {record?.submittedAt ? <SideFact label="Trình lúc">{formatDateTime(record.submittedAt)}</SideFact> : null}
                  {record?.note ? <SideFact label="Ghi chú">{record.note}</SideFact> : null}
                  {stage ? (
                    <div className={cn("space-y-1 rounded-md px-2.5 py-2 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0", stage.tone)}>
                      <p className="flex items-start gap-2 [&_svg]:mt-px">
                        {stage.icon}
                        {stage.text}
                      </p>
                      {record && FROZEN.includes(record.status) ? (
                        <p className="flex items-center gap-2 opacity-80">
                          <Lock />
                          <span>Khoá số liệu: {record.room?.name ?? "cả trường"}</span>
                          <HelpHint>Thiết bị trong phạm vi này không trình, duyệt phiếu khác được tới khi biên bản được duyệt.</HelpHint>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </SideSection>
                {/* Nút việc của phiếu ngay dưới thông tin phiếu — cùng chỗ với đề xuất mua sắm, phiếu ghi tăng. */}
              {view === "document" ? null : voucherActions("side")}

                {s ? (
                  <SideSection title="Kiểm đếm" aside={<span className="tabular-nums">{pct}%</span>}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg leading-none font-semibold tabular-nums">{s.checked.toLocaleString("vi-VN")}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">/ {s.total.toLocaleString("vi-VN")} đã kiểm</span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-brand-gradient")} style={{ width: `${pct}%` }} />
                    </div>
                    {/* Đếm dòng lệch như nút "Chênh lệch" bên trái; tài sản thừa không nằm trên dòng nào nên tách riêng. */}
                    <SideFact label="Chênh lệch">
                      {lineDiffs > 0
                        ? <span className="text-destructive-text tabular-nums">{lineDiffs}</span>
                        : s.checked === s.total && s.total > 0
                          ? <span className="text-success-text">Không có</span>
                          : <span className="text-muted-foreground font-normal">Chưa có</span>}
                    </SideFact>
                    {s.surplus > 0 ? <SideFact label="Thiết bị thừa"><span className="text-warning-text tabular-nums">{s.surplus}</span></SideFact> : null}
                  </SideSection>
                ) : null}

                <SideSection title="Tổ kiểm kê" aside={councilPeople.length ? `${councilPeople.length} người` : undefined}>
                  {councilPeople.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {(councilOpen ? councilPeople : councilPeople.slice(0, COUNCIL_SHOWN)).map((person, i) => {
                        const [name, ...role] = person.split(" — ");
                        return (
                          <li key={i} className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 font-medium break-words">{name}</span>
                            {role.length ? <span className="text-muted-foreground shrink-0 text-end text-xs">{role.join(" — ")}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">Chưa ghi.</p>
                  )}
                  {councilPeople.length > COUNCIL_SHOWN ? (
                    <button type="button" className="text-primary text-xs font-medium hover:underline" onClick={() => setCouncilOpen(!councilOpen)}>
                      {councilOpen ? "Thu gọn" : `Xem thêm ${councilPeople.length - COUNCIL_SHOWN} người`}
                    </button>
                  ) : null}
                </SideSection>

                <SideSection>
                  <dl className="text-muted-foreground space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt>Lập lúc</dt>
                      <dd className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : <span className="text-muted-foreground">Không rõ</span>}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Sửa lần cuối</dt>
                      <dd className="text-foreground">{formatEditedAt(record)}</dd>
                    </div>
                  </dl>
                </SideSection>
              </Card>
            }
          />
        </div>
      </LoadingOverlay>
    </ShowView>
  );
};
