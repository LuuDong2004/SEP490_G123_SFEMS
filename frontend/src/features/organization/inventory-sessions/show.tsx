import { useInvalidate, useList, useNotification, useShow } from "@refinedev/core";
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Clock,
  CornerUpLeft,
  DoorOpen,
  FilePen,
  Lock,
  Plus,
  ScanLine,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
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
import { ScanDialog, type ScanResult } from "./scan-dialog";
import { VoucherActions, type TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { VoucherMoreMenu } from "@/shared/components/voucher/voucher-more-menu";
import { Segmented } from "@/shared/components/segmented";
import { VoucherViewSwitch } from "@/shared/components/voucher/voucher-view-switch";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { detailFacts, LineDetailsButton, lineDetailsText, VoucherDetailsView } from "@/shared/components/voucher/voucher-details";
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
const PAGE = 50;

type Draft = { found: string; room: string; condition: string; qty: string; note: string; details: Details };
/** Một dòng tài sản thừa đề xuất từ lần quét mã — SurplusPanel thêm vào danh sách, người kiểm bấm Lưu. */
type SurplusSeed = { key: number; catalog: number; catalogName: string; name: string; note: string };

type Filter = "all" | "unchecked" | "matched" | "diff" | "MISSING" | "WRONG_ROOM" | "DAMAGED";

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

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/**
 * Bề rộng cột của bảng kiểm đếm (`table-fixed`: chữ dài cắt trong ô, cột không xô nhau khi lọc). Lúc XEM, ba cột
 * "Có thấy? / Thấy ở / Tình trạng" gộp thành một cột "Kết quả kiểm" chỉ nói cái KHÁC sổ; lúc KIỂM ĐẾM thì ba cột đó là
 * ô nhập. Cột không ghi bề rộng (tên tài sản) nhận phần còn lại: `min-w` của bảng phải lớn hơn tổng các cột cố định
 * ít nhất 12rem, không thì màn hẹp cột tên co về 0 và các tiêu đề đè lên nhau.
 */
const COLS_VIEW = ["w-40", "", "w-44", "w-60", "w-36"];
const COLS_EDIT = ["w-11", "w-40", "", "w-36", "w-32", "w-36", "w-28", "w-28", "w-11"];
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
function CountingPanel({ record, editable, filter, setFilter, onSurplus }: {
  record: InventorySession;
  editable: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
  onSurplus: (seed: SurplusSeed) => void;
}) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const config = useVoucherForm(RESOURCE);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [term, setTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  // TẢI DẦN khi cuộn thay cho phân trang: bảng vẽ PAGE dòng đầu, cuộn gần tới đáy khung thì vẽ thêm PAGE
  // dòng. Dữ liệu đã có sẵn trong phiếu — "tải" ở đây là vẽ, để phiếu vài trăm dòng không dựng vài nghìn
  // ô nhập ngay từ đầu, và người kiểm không phải bấm sang trang giữa chừng một phòng.
  const [limit, setLimit] = useState(PAGE);
  const scrollBox = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { result: rooms } = useList<{ id: number; name: string }>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: record.school.id }],
    pagination: { currentPage: 1, pageSize: 200 },
    queryOptions: { enabled: editable },
  });

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
  const set = (id: number, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

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
      if (needle && !fold(`${l.equipment.code} ${l.equipment.name}`).includes(needle)) return false;
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

  // Đổi bộ lọc là về trang đầu; lưu xong vẫn ở trang đang làm.
  useEffect(() => {
    setLimit(PAGE);
    scrollBox.current?.scrollTo({ top: 0 });
  }, [term, roomFilter, filter]);
  const shown = visible.slice(0, limit);
  const hasMore = visible.length > shown.length;
  useEffect(() => {
    const box = scrollBox.current;
    const mark = sentinel.current;
    if (!box || !mark || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { root: box, rootMargin: "240px" },
    );
    observer.observe(mark);
    return () => observer.disconnect();
  }, [hasMore, shown.length]);

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
  function markVisibleFound() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const l of visible) if (next[l.id]?.found === UNSET) next[l.id] = { ...next[l.id], found: "yes" };
      return next;
    });
  }
  /**
   * Một mã quét được: tài sản trên phiếu thì đánh dấu "Có" (như bấm tay — vẫn phải Lưu kết quả); không trên phiếu
   * thì tra sổ, có thì gợi ý thêm vào tài sản thừa.
   */
  async function scan(code: string): Promise<ScanResult> {
    const key = code.toLowerCase();
    const line = record.lines.find((l) => l.equipment.code.toLowerCase() === key);
    if (line) {
      if (drafts[line.id]?.found === "yes") return { tone: "info", text: `Đã đánh dấu có: ${line.equipment.name}` };
      setDrafts((prev) => ({ ...prev, [line.id]: { ...(prev[line.id] ?? draftOf(line)), found: "yes" } }));
      return { tone: "success", text: `Có: ${line.equipment.name}` };
    }
    try {
      const rows = await kyInstance
        .get("equipment", { searchParams: { q: code, _start: 0, _end: 5 } })
        .json<{ id: number; code: string; name: string; catalog?: { id: number; name: string } | null }[]>();
      const hit = rows.find((r) => r.code.toLowerCase() === key);
      if (!hit) return { tone: "warning", text: "Không có thiết bị mang mã này" };
      const catalog = hit.catalog;
      return {
        tone: "warning",
        text: `${hit.name} — không có trên phiếu này`,
        action: catalog
          ? {
              label: "Thêm vào thiết bị thừa",
              run: () => onSurplus({ key: Date.now(), catalog: catalog.id, catalogName: catalog.name, name: hit.name, note: `Mã ${hit.code}` }),
            }
          : undefined,
      };
    } catch (error) {
      return { tone: "warning", text: await errorMessage(error) };
    }
  }

  const uncheckedVisible = visible.filter((l) => drafts[l.id]?.found === UNSET).length;
  const diffCount = record.lines.filter((l) => l.discrepancies.length > 0).length;
  const unchecked = record.summary.total - record.summary.checked;
  const inDiff = filter === "diff" || filter === "MISSING" || filter === "WRONG_ROOM" || filter === "DAMAGED";
  const kinds = ([
    ["MISSING", record.summary.missing],
    ["WRONG_ROOM", record.summary.wrongRoom],
    ["DAMAGED", record.summary.damaged],
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
    DAMAGED: "Hỏng",
  };

  return (
    <Card className="gap-0 overflow-hidden pt-3 pb-0">
      {/* MỘT hàng theo thứ tự dùng: tìm → lọc phòng, lọc loại chênh lệch (mỗi điều kiện một nút tròn) → nhóm kết quả →
          việc làm cho cả nhóm. */}
      <CardContent className="px-4 pb-3">
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
              value={filter === "MISSING" || filter === "WRONG_ROOM" || filter === "DAMAGED" ? filter : null}
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
          {editable ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
              <ScanLine />
              Quét mã
            </Button>
          ) : null}
          {editable && uncheckedVisible > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={markVisibleFound}
              title="Đánh dấu “Có, như hệ thống” cho mọi dòng chưa kiểm đang hiện — lọc theo một phòng rồi bấm là cả phòng đó đủ.">
              <CheckCheck />
              Đủ cả {uncheckedVisible} dòng{visible.length < record.lines.length ? " đang lọc" : ""}
            </Button>
          ) : null}
        </div>
      </CardContent>

      {/* Bảng chung cuộn trong khung: bỏ cuộn riêng của `Table` để tiêu đề dính theo khung này. */}
      <div ref={scrollBox} className="max-h-[min(36rem,60vh)] overflow-auto border-t [&>[data-slot=table-container]]:overflow-visible">
        <Table className={cn("table-fixed", editable ? "min-w-[68rem]" : "min-w-[60rem]")}>
          <colgroup>
            {cols.map((w, i) => <col key={i} className={w || undefined} />)}
          </colgroup>
          <TableHeader sticky>
            <TableRow className={ROW_EDGE}>
              {editable ? <TableHead align="center">#</TableHead> : null}
              <TableHead>Mã thiết bị</TableHead>
              <TableHead>Tên thiết bị</TableHead>
              <TableHead>Hệ thống ghi</TableHead>
              {editable ? (
                <>
                  <TableHead>Có thấy?</TableHead>
                  <TableHead>Thấy ở</TableHead>
                  <TableHead>Tình trạng</TableHead>
                </>
              ) : (
                <TableHead>Kết quả kiểm</TableHead>
              )}
              <TableHead>Ghi chú</TableHead>
              {editable ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableEmpty colSpan={cols.length} filtered
                title={filter === "all" ? "Không có dòng nào khớp ô tìm" : `Không có dòng nào thuộc nhóm “${FILTER_LABEL[filter]}”`} />
            ) : (
              shown.map((l, i) => {
                const head = grouped && (i === 0 || roomKey(shown[i - 1]) !== roomKey(l)) ? roomTotals.get(roomKey(l)) : undefined;
                const d = drafts[l.id] ?? draftOf(l);
                const changed = JSON.stringify(d) !== JSON.stringify(draftOf(l));
                const extra = lineDetailsText(config, l.details);
                const expected = `${l.expectedRoom?.name ?? "Kho"}${l.expectedCondition ? ` · ${EQUIPMENT_CONDITION_LABELS[l.expectedCondition]}` : ""}`;
                // Dòng có ô nhập thấp hơn, đệm hẹp hơn; dòng xem theo cỡ chung của bảng.
                const edit = editable ? "h-11 px-2 py-1" : undefined;
                return (
                  <Fragment key={l.id}>
                  {head ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={cols.length} className="bg-surface-subtle text-muted-foreground h-9 py-1 ps-4 text-xs font-normal">
                        <span className="text-foreground me-2 font-semibold">{roomKey(l)}</span>
                        <span className="tabular-nums">{head.checked}/{head.total} đã kiểm</span>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow className={cn(ROW_EDGE, !editable && cn("group/row", LIFT_ROW), changed && "bg-primary/5")}>
                    {editable ? <TableCell align="center" className={cn(edit, "text-muted-foreground font-normal")}>{l.lineNo}</TableCell> : null}
                    <TableCell className={cn(edit, "text-muted-foreground truncate font-mono text-xs font-normal")}>{l.equipment.code}</TableCell>
                    <TableCell className={cn(edit, "truncate")} title={l.equipment.name}>{l.equipment.name}</TableCell>
                    <TableCell className={cn(edit, "text-muted-foreground truncate font-normal")} title={expected}>{expected}</TableCell>
                    {editable ? (
                      <>
                        <TableCell className={edit}>
                          <span className="flex items-center gap-2">
                            <FoundToggle value={d.found} onChange={(v) => set(l.id, { found: v })} />
                            {/* Hoá chất, vật tư theo lô: ghi số đếm được, trống là đủ như sổ. */}
                            {l.expectedQuantity != null && d.found === "yes" ? (
                              <Input className="h-8 w-24" inputMode="decimal" value={d.qty} placeholder={`${number.format(l.expectedQuantity)}`}
                                title={`Số lượng đếm được — hệ thống ghi ${number.format(l.expectedQuantity)}`} aria-label="Số lượng đếm được"
                                onChange={(e) => set(l.id, { qty: e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".") })} />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className={edit}>
                          {d.found === "yes" ? (
                            <Select value={d.room} onValueChange={(v) => set(l.id, { room: v })}>
                              <SelectTrigger className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {/* Lựa chọn mặc định nói thẳng GIÁ TRỊ trên sổ — "Như sổ" trống không buộc người kiểm nhìn sang cột khác mới biết là phòng nào. */}
                                <SelectItem value={SAME}>{l.expectedRoom?.name ?? "Kho"} <span data-suffix className="text-muted-foreground">(đúng hệ thống)</span></SelectItem>
                                {(rooms?.data ?? []).filter((r) => r.id !== l.expectedRoom?.id).map((r) => (
                                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className={edit}>
                          {d.found === "yes" ? (
                            <Select value={d.condition} onValueChange={(v) => set(l.id, { condition: v })}>
                              <SelectTrigger className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SAME}>{l.expectedCondition ? EQUIPMENT_CONDITION_LABELS[l.expectedCondition] : "Chưa ghi"} <span data-suffix className="text-muted-foreground">(đúng hệ thống)</span></SelectItem>
                                {Object.entries(EQUIPMENT_CONDITION_LABELS).filter(([v]) => v !== l.expectedCondition).map(([v, label]) => (
                                  <SelectItem key={v} value={v}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      // Một cột: nhãn kết quả + điều khác sổ (thấy ở đâu, tình trạng gì). Khớp thì một chữ nhẹ.
                      <TableCell>
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
                                // Chỉ nói điều nhãn chưa nói: phòng thực tế khi khác sổ, tình trạng khi không phải "hỏng" (nhãn đã ghi).
                                const room = l.found && l.foundRoom && l.foundRoom.id !== l.expectedRoom?.id ? `ở ${l.foundRoom.name}` : null;
                                const cond = l.found && l.foundCondition && l.foundCondition !== l.expectedCondition && !l.discrepancies.includes("DAMAGED")
                                  ? EQUIPMENT_CONDITION_LABELS[l.foundCondition] : null;
                                const qty = l.discrepancies.includes("SHORTAGE") && l.expectedQuantity != null
                                  ? `đếm ${number.format(l.countedQuantity ?? 0)} / ${number.format(l.expectedQuantity)}` : null;
                                const text = [room, cond, qty].filter(Boolean).join(" · ");
                                return text ? <span className="text-muted-foreground truncate font-normal" title={text}>{text}</span> : null;
                              })()}
                            </>
                          )}
                        </span>
                      </TableCell>
                    )}
                    {editable ? (
                      <TableCell className={edit}>
                        <Input className="h-8" value={d.note} placeholder="Ghi chú" maxLength={maxLengthOf("NOTE", 255)} onChange={(e) => set(l.id, { note: e.target.value })} />
                      </TableCell>
                    ) : (
                      <TableCell className="text-muted-foreground truncate font-normal" title={[l.note, extra].filter(Boolean).join(" · ") || undefined}>
                        {[l.note, extra].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                    )}
                    {editable ? (
                      <TableCell className={edit}>
                        <span className="flex justify-end">
                          <LineDetailsButton compact config={config} value={d.details} schoolId={record.school.id}
                            onChange={(v) => set(l.id, { details: v })} title={`${l.equipment.code} — ${l.equipment.name}`} />
                        </span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        {hasMore ? (
          <div ref={sentinel} className="text-muted-foreground px-4 py-3 text-center text-xs">Đang tải thêm…</div>
        ) : null}
      </div>

      {editable || hasMore ? (
      <div className="bg-surface-subtle flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2.5 sm:px-5">
        <span className="text-muted-foreground me-auto text-xs tabular-nums">
          Đang hiện {shown.length}/{visible.length} dòng
          {visible.length < record.lines.length ? ` (lọc từ ${record.lines.length})` : ""}
          {hasMore ? " · cuộn xuống để xem tiếp" : ""}
          {editable && dirty.length ? <> · <span className="text-primary font-medium">{dirty.length} dòng đã sửa, chưa lưu</span></> : null}
        </span>
        {editable ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy || dirty.length === 0}
              onClick={() => setDrafts(initial)}>
              <Undo2 />
              Bỏ thay đổi
            </Button>
            <Button type="button" size="sm" disabled={busy || dirty.length === 0} onClick={() => void save()}>
              <Save />
              {busy ? "Đang lưu…" : `Lưu kết quả${dirty.length ? ` ${dirty.length} dòng` : ""}`}
            </Button>
          </>
        ) : null}
      </div>
      ) : null}
      {editable ? <ScanDialog open={scanning} onOpenChange={setScanning} onScan={scan} /> : null}
    </Card>
  );
}

/** Tài sản thừa: thấy mà sổ không có. Duyệt biên bản xong sẽ thành một phiếu nhập nháp. */
function SurplusPanel({ record, editable, seed }: { record: InventorySession; editable: boolean; seed: SurplusSeed | null }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  type Row = { catalog: string; catalogName?: string; name: string; quantity: number; note: string };
  const toRows = (): Row[] => record.surplus.map((s) => ({ catalog: String(s.catalog.id), name: s.name, quantity: s.quantity, note: s.note ?? "" }));
  const [rows, setRows] = useState(toRows);
  // Tài sản quét được mà không có trên phiếu: thêm một dòng chưa lưu, đưa khối này vào tầm mắt.
  useEffect(() => {
    if (!seed) return;
    setRows((all) => [...all, { catalog: String(seed.catalog), catalogName: seed.catalogName, name: seed.name, quantity: 1, note: seed.note }]);
    document.getElementById("inventory-surplus")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [seed]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRows(toRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.updatedAt, record.surplus]);

  async function save() {
    const problem = rows.filter((r) => r.catalog).map((r) =>
      textError("NAME", "Tên thực tế", r.name) ?? numberError("QUANTITY", "Số lượng", r.quantity) ?? textError("NOTE", "Ghi chú", r.note, 255),
    ).find(Boolean);
    if (problem) {
      open?.({ type: "error", message: problem });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.patch(`${RESOURCE}/${record.id}`, {
        json: {
          surplus: rows.filter((r) => r.catalog).map((r) => ({
            catalog: { id: Number(r.catalog) }, name: r.name || null, quantity: Number(r.quantity) || 1, note: r.note || null,
          })),
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
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card id="inventory-surplus" className="py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepTitle
            title="Thiết bị thừa"
            aside={<span className="tabular-nums">{record.surplus.length} dòng</span>}
            hint="Có thật nhưng chưa có trong hệ thống"
          />
          {editable ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { catalog: "", name: "", quantity: 1, note: "" }])}>
                <Plus />
                Thêm dòng
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
                <Save />
                Lưu
              </Button>
            </div>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Chưa ghi thiết bị thừa nào.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-table-head text-overline text-table-head-text grid grid-cols-[2rem_minmax(12rem,2fr)_minmax(10rem,2fr)_6rem_minmax(10rem,2fr)_2.5rem] gap-x-2 border-b px-3 py-2">
              <span className="text-center">#</span>
              <span>Thiết bị (danh mục)</span>
              <span>Tên thực tế</span>
              <span className="pe-4 text-right">Số lượng</span>
              <span>Ghi chú</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[2rem_minmax(12rem,2fr)_minmax(10rem,2fr)_6rem_minmax(10rem,2fr)_2.5rem] items-center gap-x-2 border-b px-3 py-2 text-sm last:border-b-0">
                <span className="text-muted-foreground text-center tabular-nums">{i + 1}</span>
                {editable ? (
                  // Danh mục hơn một nghìn thiết bị: tìm ở máy chủ, không đổ sẵn 200 dòng đầu.
                  <AsyncCombobox<{ id: number; code: string; name: string }>
                    resource="equipment_catalogs"
                    value={r.catalog ? Number(r.catalog) : null}
                    onChange={(id) => update(i, { catalog: id == null ? "" : String(id), catalogName: undefined })}
                    labelOf={(c) => `${c.code} · ${c.name}`}
                    fallbackLabel={r.catalogName ?? record.surplus[i]?.catalog.name ?? null}
                    placeholder="Vui lòng chọn thiết bị"
                    searchPlaceholder="Tìm theo tên hoặc mã DM thiết bị…"
                  />
                ) : (
                  <span className="truncate">{record.surplus[i]?.catalog.name}</span>
                )}
                {editable ? (
                  <Input className="h-8" value={r.name} placeholder="= tên trong danh mục" maxLength={maxLengthOf("NAME")} onChange={(e) => update(i, { name: e.target.value })} />
                ) : (
                  <span className="truncate">{r.name || "—"}</span>
                )}
                {editable ? (
                  <Input className="h-8 text-right tabular-nums" type="number" min={1} value={r.quantity}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                ) : (
                  <span className="pe-4 text-right tabular-nums">{r.quantity}</span>
                )}
                {editable ? (
                  <Input className="h-8" value={r.note} placeholder="Ghi chú" maxLength={maxLengthOf("NOTE", 255)} onChange={(e) => update(i, { note: e.target.value })} />
                ) : (
                  <span className="text-muted-foreground truncate">{r.note || "—"}</span>
                )}
                {editable ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá dòng"
                    className="text-muted-foreground hover:text-destructive" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                ) : <span />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
export const InventorySessionShow = () => {
  const { result: record, query } = useShow<InventorySession>({});
  const config = useVoucherForm(RESOURCE);
  const editable = !!record?._actions?.includes("count");
  const s = record?.summary;
  const [filter, setFilter] = useState<Filter>("all");
  const [surplusSeed, setSurplusSeed] = useState<SurplusSeed | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Tài khoản trường chỉ thấy trường mình: dòng Trường lặp đúng tên đó.
  const { perspective } = usePerspective();
  const pct = s && s.total ? Math.round((s.checked / s.total) * 100) : 0;
  const stage = record ? STAGE[record.status] : null;
  // Biên bản đã chốt (không còn kiểm đếm) mà có chênh lệch: mở sẵn nhóm "Có chênh lệch" — người duyệt cần
  // thấy vài dòng lệch, không phải cuộn qua hai trăm dòng khớp. Chỉ đặt một lần cho mỗi phiếu.
  const lineDiffs = s ? s.missing + s.wrongRoom + s.damaged : 0;
  const preset = useRef<number | null>(null);
  useEffect(() => {
    if (!record || preset.current === record.id) return;
    preset.current = record.id;
    setFilter(!editable && lineDiffs > 0 ? "diff" : "all");
  }, [record, editable, lineDiffs]);
  // Hai dạng xem của cùng một biên bản, như phiếu ghi tăng: "Làm việc" (bảng kiểm đếm) và "Văn bản" (tờ A4).
  const [view, setView] = useVoucherView("inventory");
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

  return (
    <ShowView>
      <ShowViewHeader
        meta={record ? <VoucherStatusBadge status={record.status} step={record.approvalStep} returned={!!record.returnNote} /> : null}
        more={<VoucherMoreMenu resource={RESOURCE} record={record} printLabel="In biên bản" onTimeline={() => setTimelineOpen(true)} onAction={setMenuAction} />}
        actions={
          <>
            {record ? <VoucherViewSwitch view={view} onChange={setView} /> : null}
            <VoucherActions
              resource={RESOURCE}
              record={record}
              tucked={tucked}
              invalidates={["equipment", "equipment_intakes"]}
              text={{
                submit: {
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
              { label: "Kết luận", value: record.conclusion, wide: true },
            ]}
            table={{
              headers: ["STT", "Mã thiết bị", "Tên thiết bị", "Hệ thống ghi", "Thực tế", "Kết quả"],
              rows: record.lines.map((l, i) => [
                i + 1,
                l.equipment.code,
                l.equipment.name,
                // Hoá chất, vật tư theo lô: thêm số lượng sổ ghi / đếm được.
                `${l.expectedRoom?.name ?? "Kho"}${l.expectedQuantity != null ? ` · SL ${number.format(l.expectedQuantity)}` : ""}`,
                l.found == null ? "Chưa kiểm" : l.found
                  ? `${l.foundRoom?.name ?? "Như hệ thống"}${l.expectedQuantity != null ? ` · SL ${number.format(l.countedQuantity ?? l.expectedQuantity)}` : ""}`
                  : "Không thấy",
                l.discrepancies.map((x) => DISCREPANCY_LABELS[x]).join(", ") || (l.found != null ? "Khớp" : ""),
              ]),
              alignCenter: [0],
              grow: 2,
            }}
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
            { label: "Tên đợt", value: record.title },
            { label: "Ngày kiểm kê", value: formatPlainDate(record.inventoryDate) },
            { label: "Phạm vi", value: record.room?.name ?? "Cả trường" },
            ...(record.council ? [{ label: "Tổ kiểm kê", value: record.council }] : []),
            ...(record.conclusion ? [{ label: "Kết luận", value: record.conclusion }] : []),
            ...detailFacts(config, record.details, null),
          ]}
          table={{
            headers: ["STT", "Mã thiết bị", "Tên thiết bị", "Hệ thống ghi", "Thực tế", "Chênh lệch", "Ghi chú"],
            rows: record.lines.map((l) => [
              l.lineNo,
              l.equipment.code,
              l.equipment.name,
              l.expectedRoom?.name ?? "Kho",
              l.found == null ? "Chưa kiểm" : l.found ? (l.foundRoom?.name ?? "Đúng như hệ thống") : "Không thấy",
              l.discrepancies.map((x) => DISCREPANCY_LABELS[x]).join(", ") || (l.found != null ? "Khớp" : ""),
              l.note ?? "",
            ]),
          }}
          signers={["Người kiểm kê", "Kế toán", "Thủ trưởng đơn vị"]}
        />
      ) : null}

      <LoadingOverlay loading={query.isLoading}>
        <div className={cn("print:hidden", view === "document" && record && "hidden")}>
          <VoucherTwoColumn
            main={
              <>
                {record?.status === "DRAFT" && record.returnNote ? (
                  <Alert>
                    <CornerUpLeft className="text-warning-text" />
                    <AlertTitle>Biên bản bị trả lại, cần sửa</AlertTitle>
                    <AlertDescription>{record.returnNote}</AlertDescription>
                  </Alert>
                ) : null}
                {record?.status === "REJECTED" && record.rejectReason ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Biên bản bị từ chối</AlertTitle>
                    <AlertDescription>{record.rejectReason}</AlertDescription>
                  </Alert>
                ) : null}

                {record ? <CountingPanel record={record} editable={editable} filter={filter} setFilter={setFilter} onSurplus={setSurplusSeed} /> : null}
                {record ? <InventoryBreakdown record={record} /> : null}
                {record ? <SurplusPanel record={record} editable={editable} seed={surplusSeed} /> : null}
                {record ? <InventoryFacilityPanel record={record} /> : null}

                <VoucherDetailsView config={config} details={record?.details} draft={record?.status === "DRAFT"} />

                {/* Biên bản chỉ ghi nhận — phiếu xử lý chênh lệch do người dùng lập nhanh từ đây. */}
                <InventoryFollowUps sessionId={record?.id} approved={record?.status === "COMPLETED"} />
                <RelatedVouchers resource={RESOURCE} id={record?.id} />

                <AttachmentsPanel
                  compact
                  resource={RESOURCE}
                  recordId={record?.id}
                  canWrite={record?._can?.write === true}
                  description="Biên bản kiểm kê có chữ ký tổ kiểm kê, ảnh hiện trường."
                />
                <VoucherTimelineDialog resource={RESOURCE} id={record?.id} open={timelineOpen} onOpenChange={setTimelineOpen} />
              </>
            }
            side={
              <Card className="gap-0 py-0">
                <SideSection title="Phiếu kiểm kê">
                  <SideFact label="Số phiếu">
                    {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi trình</span>}
                  </SideFact>
                  <SideFact label="Tên đợt">{record?.title}</SideFact>
                  {perspective === "school" ? null : <SideFact label="Trường">{record?.school?.name}</SideFact>}
                  <SideFact label="Ngày kiểm kê">{formatPlainDate(record?.inventoryDate)}</SideFact>
                  <SideFact label="Phạm vi">{record?.room?.name ?? "Cả trường"}</SideFact>
                  <SideFact label="Theo đợt">
                    {record?.campaign?.name ?? <span className="text-muted-foreground font-normal">Trường tự kiểm kê</span>}
                  </SideFact>
                  {record?.submittedAt ? <SideFact label="Trình lúc">{formatDateTime(record.submittedAt)}</SideFact> : null}
                  {record?.note ? <SideFact label="Ghi chú">{record.note}</SideFact> : null}
                  {stage ? (
                    <p className={cn("flex items-start gap-2 rounded-md px-2.5 py-2 text-xs [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0", stage.tone)}>
                      {stage.icon}
                      {stage.text}
                    </p>
                  ) : null}
                  {record && FROZEN.includes(record.status) ? (
                    <div className="text-muted-foreground flex items-center gap-2 px-2.5 text-xs [&>svg]:size-3.5 [&>svg]:shrink-0">
                      <Lock />
                      <span>Khoá số liệu: {record.room?.name ?? "cả trường"}</span>
                      <HelpHint>Thiết bị trong phạm vi này không trình, duyệt phiếu khác được tới khi biên bản được duyệt.</HelpHint>
                    </div>
                  ) : null}
                </SideSection>

                {s ? (
                  <SideSection title="Kiểm đếm">
                    <SideFact label="Đã kiểm"><span className="tabular-nums">{s.checked}/{s.total} · {pct}%</span></SideFact>
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

                <SideSection title="Tổ kiểm kê">
                  {record?.council ? (
                    <ul className="space-y-1.5 text-sm">
                      {record.council.split("\n").filter(Boolean).map((person, i) => {
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
                  {record?.conclusion ? (
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs">Kết luận</div>
                      <p className="text-sm whitespace-pre-line">{record.conclusion}</p>
                    </div>
                  ) : null}
                </SideSection>

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
            }
          />
        </div>
      </LoadingOverlay>
    </ShowView>
  );
};
