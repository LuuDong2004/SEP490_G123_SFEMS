import { useInvalidate, useNotification } from "@refinedev/core";
import { CheckCheck, DoorOpen, Save, ScanLine, Search, TriangleAlert, Undo2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { Segmented } from "@/shared/components/segmented";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CONDITION_LABELS } from "@/domains/equipment/types";
import {
  DISCREPANCY_LABELS,
  type InventoryLine,
  type InventoryRef,
  type InventorySession,
} from "@/domains/inventory/types";
import { ScanDialog, type ScanResult } from "./scan-dialog";

const RESOURCE = "inventory_sessions";

const UNSET = "__unset__";
const SAME = "__same__";
const NO_ROOM = "Kho (chưa xếp phòng)";
/** Dòng vẽ mỗi lần — phiếu cả trường có hàng trăm dòng, mỗi dòng vài ô nhập. */
const PAGE = 50;

type Draft = { found: string; room: string; condition: string; note: string };
type Filter = "all" | "unchecked" | "matched" | "diff" | "MISSING" | "WRONG_ROOM" | "DAMAGED";

/** Một dòng tài sản thừa đề xuất từ lần quét mã — khối tài sản thừa thêm vào danh sách, người kiểm bấm Lưu. */
export type SurplusSeed = { key: number; catalog: number; catalogName: string; name: string; note: string };

function draftOf(line: InventoryLine): Draft {
  return {
    found: line.found == null ? UNSET : line.found ? "yes" : "no",
    // Thấy đúng phòng / đúng tình trạng trên sổ thì là "đúng sổ", dù máy chủ có lưu lại giá trị đó.
    room: line.foundRoom && line.foundRoom.id !== line.expectedRoom?.id ? String(line.foundRoom.id) : SAME,
    condition: line.foundCondition && line.foundCondition !== line.expectedCondition ? line.foundCondition : SAME,
    note: line.note ?? "",
  };
}

const sameDraft = (a: Draft, b: Draft) =>
  a.found === b.found && a.room === b.room && a.condition === b.condition && a.note === b.note;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

const roomKey = (l: InventoryLine) => l.expectedRoom?.name ?? NO_ROOM;

/**
 * Bề rộng cột (`table-fixed`: chữ dài cắt trong ô, cột không xô nhau khi lọc). Lúc XEM, ba cột "Có thấy? / Thấy ở /
 * Tình trạng" gộp thành một cột "Kết quả kiểm"; lúc KIỂM ĐẾM thì ba cột đó là ô nhập. Cột tên tài sản nhận phần còn lại.
 */
const COLS_VIEW = ["w-40", "", "w-44", "w-60", "w-36"];
const COLS_EDIT = ["w-11", "w-40", "", "w-36", "w-32", "w-36", "w-28", "w-36"];
/** Ô đầu và ô cuối của dòng thẳng mép với chữ trong thẻ. */
const ROW_EDGE = "[&>*:first-child]:ps-4 [&>*:last-child]:pe-4";

/** Nhãn một ô của thanh lọc: chữ + số đếm, số có màu theo nhóm khi ô không được chọn. */
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
    <div className="bg-background flex gap-0.5 rounded-lg border p-0.5">
      {opt("yes", "Có", "bg-success text-success-foreground")}
      {opt("no", "Không", "bg-destructive text-white")}
    </div>
  );
}

/** Kết quả một dòng lúc xem: nhãn kết quả + điều khác sổ (thấy ở đâu, tình trạng gì). Khớp thì một chữ nhẹ. */
function ResultCell({ line }: { line: InventoryLine }) {
  if (line.found == null) return <span className="text-muted-foreground font-normal">Chưa kiểm</span>;
  if (line.discrepancies.length === 0) return <span className="text-success-text font-normal">Khớp sổ</span>;
  // Chỉ nói điều nhãn chưa nói: phòng thực tế khi khác sổ, tình trạng khi không phải "hỏng" (nhãn đã ghi).
  const room = line.found && line.foundRoom && line.foundRoom.id !== line.expectedRoom?.id ? `ở ${line.foundRoom.name}` : null;
  const cond = line.found && line.foundCondition && line.foundCondition !== line.expectedCondition && !line.discrepancies.includes("DAMAGED")
    ? CONDITION_LABELS[line.foundCondition] : null;
  const text = [room, cond].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 items-center gap-2">
      {line.discrepancies.map((x) => (
        <Badge key={x} variant={x === "MISSING" ? "destructive" : "warning"}>{DISCREPANCY_LABELS[x]}</Badge>
      ))}
      {text ? <span className="text-muted-foreground truncate font-normal" title={text}>{text}</span> : null}
    </span>
  );
}

/**
 * Bảng kiểm đếm (KK-04). Mỗi dòng: có thấy không, thấy ở đâu, tình trạng thế nào. Mặc định "như sổ" để cán bộ chỉ
 * sửa những dòng lệch. Bảng cuộn trong khung, lọc được theo kết quả, theo loại chênh lệch, theo phòng trên sổ và
 * theo mã / tên; quét tem để đánh dấu "Có"; thanh lưu nằm ngay dưới.
 */
export function CountingPanel({ record, editable, onSurplus }: {
  record: InventorySession;
  editable: boolean;
  /** Mã quét được không có trên phiếu mà có trên sổ: gợi ý thêm vào tài sản thừa. */
  onSurplus: (seed: SurplusSeed) => void;
}) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Biên bản đã chốt mà có chênh lệch: mở sẵn nhóm "Chênh lệch" — người duyệt cần thấy vài dòng lệch.
  const lineDiffs = record.summary.missing + record.summary.wrongRoom + record.summary.damaged;
  const [filter, setFilter] = useState<Filter>(!editable && lineDiffs > 0 ? "diff" : "all");
  // Tải dần khi cuộn: vẽ PAGE dòng đầu, cuộn gần tới đáy khung thì vẽ thêm.
  const [limit, setLimit] = useState(PAGE);
  const scrollBox = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const initial = useMemo(
    () => Object.fromEntries(record.lines.map((l) => [l.id, draftOf(l)])) as Record<number, Draft>,
    [record.lines],
  );
  useEffect(() => {
    setDrafts(initial);
  }, [record.id, record.updatedAt, initial]);

  const dirty = useMemo(
    () => record.lines.filter((l) => drafts[l.id] && !sameDraft(drafts[l.id], initial[l.id])),
    [record.lines, drafts, initial],
  );
  const set = (id: number, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // Các phòng của trường đang có tài sản trên phiếu: lọc theo chỗ tổ kiểm kê đang đứng, và chọn chỗ thấy thực tế.
  const rooms = useMemo(() => {
    const m = new Map<string, { key: string; label: string; count: number; room: InventoryRef | null }>();
    for (const l of record.lines) {
      const key = l.expectedRoom ? String(l.expectedRoom.id) : "none";
      const room = m.get(key) ?? { key, label: roomKey(l), count: 0, room: l.expectedRoom };
      room.count += 1;
      m.set(key, room);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [record.lines]);
  const roomChoices = rooms.flatMap((r) => (r.room ? [r.room] : []));

  const needle = fold(term.trim());
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
    // Xếp theo PHÒNG TRÊN SỔ rồi theo số thứ tự: tổ kiểm kê đi từng phòng; dòng tiêu đề phòng chen vào khi phòng đổi.
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
          note: d.note || null,
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
      if (!hit) return { tone: "warning", text: "Không có tài sản mang mã này" };
      const catalog = hit.catalog;
      return {
        tone: "warning",
        text: `${hit.name} — không có trên phiếu này`,
        action: catalog
          ? {
              label: "Thêm vào tài sản thừa",
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
      <CardContent className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm mã, tên tài sản…" className="pl-8" aria-label="Tìm tài sản" />
          </div>
          {rooms.length > 1 ? (
            <IconFilter icon={<DoorOpen />} label="phòng trên sổ" allLabel="Mọi phòng" total={record.lines.length}
              groups={[{ items: rooms.map(({ key, label, count }) => ({ key, label, count })) }]} value={roomFilter} onChange={setRoomFilter} />
          ) : null}
          {kinds.length > 1 ? (
            <IconFilter icon={<TriangleAlert />} label="loại chênh lệch" allLabel="Mọi chênh lệch" total={diffCount}
              groups={[{ items: kinds.map(([k, n]) => ({ key: k, label: DISCREPANCY_LABELS[k], count: n })) }]}
              value={filter === "MISSING" || filter === "WRONG_ROOM" || filter === "DAMAGED" ? filter : null}
              onChange={(v) => setFilter((v as Filter | null) ?? "diff")} />
          ) : null}
          <Segmented<"all" | "unchecked" | "matched" | "diff">
            label="Lọc theo kết quả"
            value={inDiff ? "diff" : (filter as "all" | "unchecked" | "matched")}
            onChange={setFilter}
            options={[
              { value: "all", hint: "Mọi tài sản của phiên kiểm kê", label: <FilterLabel label="Tất cả" count={record.summary.total} active={filter === "all"} /> },
              ...(editable || unchecked > 0
                ? [{ value: "unchecked" as const, hint: "Tài sản chưa được kiểm", label: <FilterLabel label="Chưa kiểm" count={unchecked} tone="warning" active={filter === "unchecked"} /> }]
                : []),
              { value: "matched", hint: "Thực tế khớp sổ sách", label: <FilterLabel label="Khớp" count={record.summary.matched} tone="success" active={filter === "matched"} /> },
              { value: "diff", hint: "Thiếu, thừa, sai vị trí hoặc sai tình trạng", label: <FilterLabel label="Chênh lệch" count={diffCount} tone="destructive" active={inDiff} /> },
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
              title="Đánh dấu “Có, như sổ” cho mọi dòng chưa kiểm đang hiện — lọc theo một phòng rồi bấm là cả phòng đó đủ.">
              <CheckCheck />
              Đủ cả {uncheckedVisible} dòng{visible.length < record.lines.length ? " đang lọc" : ""}
            </Button>
          ) : null}
        </div>
      </CardContent>

      {/* Bảng cuộn trong khung: bỏ cuộn riêng của `Table` để tiêu đề dính theo khung này. */}
      <div ref={scrollBox} className="max-h-[min(36rem,60vh)] overflow-auto border-t [&>[data-slot=table-container]]:overflow-visible">
        <Table className={cn("table-fixed", editable ? "min-w-[68rem]" : "min-w-[60rem]")}>
          <colgroup>
            {cols.map((w, i) => <col key={i} className={w || undefined} />)}
          </colgroup>
          <TableHeader sticky>
            <TableRow className={ROW_EDGE}>
              {editable ? <TableHead className="text-center">#</TableHead> : null}
              <TableHead>Mã tài sản</TableHead>
              <TableHead>Tên tài sản</TableHead>
              <TableHead>Sổ ghi</TableHead>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={cols.length} className="text-muted-foreground h-24 text-center font-normal">
                  {record.lines.length === 0
                    ? "Không có tài sản nào trên sổ trong phạm vi kiểm kê"
                    : filter === "all" ? "Không có dòng nào khớp ô tìm." : `Không có dòng nào thuộc nhóm “${FILTER_LABEL[filter]}”.`}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((l, i) => {
                const head = grouped && (i === 0 || roomKey(shown[i - 1]) !== roomKey(l)) ? roomTotals.get(roomKey(l)) : undefined;
                const d = drafts[l.id] ?? draftOf(l);
                const changed = !sameDraft(d, initial[l.id] ?? draftOf(l));
                const expected = `${l.expectedRoom?.name ?? "Kho"}${l.expectedCondition ? ` · ${CONDITION_LABELS[l.expectedCondition]}` : ""}`;
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
                    <TableRow className={cn(ROW_EDGE, changed && "bg-primary/5")}>
                      {editable ? <TableCell className={cn(edit, "text-muted-foreground text-center font-normal")}>{l.lineNo}</TableCell> : null}
                      <TableCell className={cn(edit, "text-muted-foreground truncate font-mono text-xs font-normal")}>{l.equipment.code}</TableCell>
                      <TableCell className={cn(edit, "truncate")} title={l.equipment.name}>{l.equipment.name}</TableCell>
                      <TableCell className={cn(edit, "text-muted-foreground truncate font-normal")} title={expected}>{expected}</TableCell>
                      {editable ? (
                        <>
                          <TableCell className={edit}>
                            <FoundToggle value={d.found} onChange={(v) => set(l.id, { found: v })} />
                          </TableCell>
                          <TableCell className={edit}>
                            {d.found === "yes" ? (
                              <Select value={d.room} onValueChange={(v) => set(l.id, { room: v })}>
                                <SelectTrigger className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {/* Lựa chọn mặc định nói thẳng GIÁ TRỊ trên sổ. */}
                                  <SelectItem value={SAME}>{l.expectedRoom?.name ?? "Kho"} <span data-suffix className="text-muted-foreground">(đúng sổ)</span></SelectItem>
                                  {roomChoices.filter((r) => r.id !== l.expectedRoom?.id).map((r) => (
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
                                  <SelectItem value={SAME}>{l.expectedCondition ? CONDITION_LABELS[l.expectedCondition] : "Chưa ghi"} <span data-suffix className="text-muted-foreground">(đúng sổ)</span></SelectItem>
                                  {Object.entries(CONDITION_LABELS).filter(([v]) => v !== l.expectedCondition).map(([v, label]) => (
                                    <SelectItem key={v} value={v}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className={edit}>
                            <Input className="h-8" value={d.note} placeholder="Ghi chú" maxLength={255} onChange={(e) => set(l.id, { note: e.target.value })} />
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell><ResultCell line={l} /></TableCell>
                          <TableCell className="text-muted-foreground truncate font-normal" title={l.note ?? undefined}>{l.note || "—"}</TableCell>
                        </>
                      )}
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
              <Button type="button" variant="outline" size="sm" disabled={busy || dirty.length === 0} onClick={() => setDrafts(initial)}>
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
