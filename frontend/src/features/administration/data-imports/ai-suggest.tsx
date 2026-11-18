import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles, Square, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { HelpHint } from "@/shared/components/form/help-hint";
import { Spinner } from "@/shared/components/spinner";
import type { ImportAiInfo, ImportAiSuggestion, ImportRow, ImportSheetInfo } from "@/domains/data-import/types";

import type { RowEdit } from "./import-grid";

/** Ô giả của sửa nhanh: nhận là BỎ dòng (`OnboardingQuickFix.SKIP`). */
const SKIP = "_skip";
/** Ô giả: dòng được GIỮ NGUYÊN trong một nhóm trùng mã (`OnboardingQuickFix.KEEP`) — chỉ để thấy đủ nhóm. */
const KEEP = "_keep";
/** Gợi ý có làm gì không — dòng giữ nguyên không tích, không đếm, áp dụng thì bỏ qua. */
const acts = (it: { field: string }) => it.field !== KEEP;
/** Dòng thiết bị chưa ghép được danh mục (lưu ý `OnboardingAiService.OUT_OF_CATALOG`) — AI thử ghép. */
const outOfCatalog = (r: ImportRow) =>
  r.messages.some((m) => m.level === "warning" && m.field === "catalog" && m.text.startsWith("Không có trong danh mục"));
/** Nhóm chung cho mọi gợi ý ghép danh mục của AI — lý do từng dòng hiện dưới mã. */
const CATALOG_GROUP = "Ghép vào danh mục thiết bị";

type Source = "rule" | "ai";
/** Mục "Phòng còn thiếu" ở danh sách vấn đề. */
const ROOMS_KEY = "__rooms";
const PAGE_SIZE = 10;
type Item = ImportAiSuggestion & { source: Source };
type NewRoom = { code: string; building: string | null; floor: string | null; roomType: string | null; basedOn: string; usedBy: number };

/**
 * Nút "AI sửa lỗi" trên hàng công cụ của lưới. Bấm là: (1) SỬA NHANH theo luật ở máy chủ — mã trùng / sai dạng, phòng
 * viết khác, phòng còn thiếu, năm, số lượng 0 — luôn chạy, không tốn gì; (2) nếu AI đang bật và trang dùng được AI,
 * hỏi AI tiếp cho các dòng lỗi / lưu ý còn lại (tối đa `maxRows`). Hộp thoại gộp cả hai: tích chọn rồi Áp dụng — sửa
 * ô qua PATCH như sửa tay, phòng còn thiếu thì thêm dòng vào trang Phòng. Máy chủ kiểm lại cả lô sau khi sửa.
 */
export function AiSuggestButton({ batchId, sheet, rows, onApply, onAddRooms }: {
  batchId: string | number;
  sheet: ImportSheetInfo;
  /** MỌI dòng của trang (không theo bộ lọc) — gợi ý xét hết dòng lỗi trong một lần bấm. */
  rows: ImportRow[];
  onApply: (edits: RowEdit[]) => void;
  onAddRooms: (rooms: Record<string, string>[]) => void;
}) {
  const { open: notify } = useNotification();
  const { data: info } = useQuery({
    queryKey: ["data_imports", "ai"],
    staleTime: 60_000,
    queryFn: ({ signal }) => kyInstance.get("data_imports/ai", { signal }).json<ImportAiInfo>(),
  });
  const [busy, setBusy] = useState<"rule" | "ai" | null>(null);
  /** Tiến độ AI khi chia đợt: đã xem / tổng số dòng lỗi. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [rooms, setRooms] = useState<NewRoom[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [pickedRooms, setPickedRooms] = useState<Set<string>>(new Set());
  /** Giá trị người dùng gõ đè lên gợi ý (theo chỉ số gợi ý) — áp dụng lấy giá trị này thay kết quả của AI. */
  const [typed, setTyped] = useState<Map<number, string>>(new Map());
  /** Vấn đề đang xem ở cột trái, và trang của bảng bên phải. */
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  /** Huỷ các đợt AI còn lại: bấm Dừng, hoặc rời màn — không để vòng lặp chạy tiếp và tốn tiền khi không ai xem. */
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const aiOn = !!info?.enabled && info.sheets.includes(sheet.key);
  const rowOf = new Map(rows.map((r) => [r.id, r]));
  const labelOf = (field: string) => (field === SKIP ? "Dòng" : sheet.columns.find((c) => c.key === field)?.label ?? field);

  const ask = async () => {
    let list: Item[] = [];
    let missing: NewRoom[] = [];
    try {
      setBusy("rule");
      const quick = await kyInstance.post(`data_imports/${batchId}/quick-fixes`, { json: { sheet: sheet.key }, timeout: 60_000 })
        .json<{ suggestions: ImportAiSuggestion[]; newRooms: NewRoom[]; covered?: number[] }>();
      list = quick.suggestions.map((s) => ({ ...s, source: "rule" as const }));
      missing = quick.newRooms;
      if (aiOn && info) {
        // AI xem MỌI dòng LỖI mà sửa nhanh chưa đụng tới, cộng dòng thiết bị "Không có trong danh mục" (để ghép danh
        // mục) — dòng lỗi trước. Chia đợt `maxRows` dòng, gọi lần lượt; đợt lỗi thì dừng, giữ những gì đã có.
        const covered = new Set([...list.map((s) => s.rowId), ...(quick.covered ?? [])]);
        const open = rows.filter((r) => !r.skipped && !covered.has(r.id));
        const all = [
          ...open.filter((r) => r.status === "ERROR"),
          ...open.filter((r) => r.status !== "ERROR" && outOfCatalog(r)),
        ];
        // Một lần bấm xem tối đa `maxRowsPerClick` dòng — trần chi phí của một cú bấm; còn thì bấm lại.
        const targets = all.slice(0, info.maxRowsPerClick);
        if (targets.length) {
          setBusy("ai");
          const ctrl = new AbortController();
          abortRef.current = ctrl;
          for (let i = 0; i < targets.length && !ctrl.signal.aborted; i += info.maxRows) {
            setProgress({ done: i, total: targets.length });
            const chunk = targets.slice(i, i + info.maxRows);
            try {
              const ai = await kyInstance
                .post(`data_imports/${batchId}/ai-suggest`, {
                  json: { sheet: sheet.key, rowIds: chunk.map((r) => r.id) }, timeout: 150_000, signal: ctrl.signal,
                })
                .json<ImportAiSuggestion[]>();
              list = [...list, ...ai.map((s) => ({ ...s, source: "ai" as const }))];
            } catch (error) {
              if (ctrl.signal.aborted) break;
              notify?.({ type: "error", message: await errorMessage(error), description: "AI dừng giữa chừng — giữ các gợi ý đã có" });
              break;
            }
          }
          abortRef.current = null;
          // Rời màn giữa chừng thì thôi, không mở hộp thoại trên màn đã đóng.
          if (!mounted.current) return;
          if (all.length > targets.length && !ctrl.signal.aborted) {
            notify?.({ type: "success", message: `AI đã xem ${targets.length}/${all.length} dòng`,
              description: "Áp dụng các gợi ý này rồi bấm AI sửa lỗi lần nữa để xem tiếp." });
          }
        }
      }
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không lấy được gợi ý" });
      return;
    } finally {
      setBusy(null);
      setProgress(null);
    }
    if (!list.length && !missing.length) {
      notify?.({ type: "success", message: rows.some((r) => r.status === "ERROR") ? "Chưa có gợi ý cho trang này. Sửa trực tiếp trên bảng." : "Trang này không còn lỗi." });
      return;
    }
    setItems(list);
    setActive(null);
    setPage(0);
    setTyped(new Map());
    setRooms(missing);
    setPicked(new Set(list.flatMap((it, k) => (acts(it) && !it.review ? [k] : []))));
    setPickedRooms(new Set(missing.map((r) => r.code)));
  };

  const apply = () => {
    if (!items) return;
    const byRow = new Map<number, RowEdit>();
    const manual = new Set<number>();
    items.forEach((s, k) => {
      if (!picked.has(k) || !acts(s)) return;
      // Dòng có cả gợi ý AI lẫn sửa nhanh thì ghi là AI — cái đáng để người xem kiểm lại hơn.
      const e = byRow.get(s.rowId) ?? { rowId: s.rowId, source: s.source };
      if (s.source === "ai") e.source = "ai";
      // Người dùng đã đổi giá trị gợi ý thì đó là sửa tay (máy chủ ghi "manual" khi không có nguồn).
      const own = typed.get(k);
      if (own !== undefined && own.trim() !== s.to) manual.add(s.rowId);
      if (s.field === SKIP) e.skipped = true;
      else e.data = { ...(e.data ?? {}), [s.field]: (typed.get(k) ?? s.to).trim() };
      byRow.set(s.rowId, e);
    });
    const add = rooms.filter((r) => pickedRooms.has(r.code)).map((r) => ({
      code: r.code, name: r.code, building: r.building ?? "", floor: r.floor ?? "", roomType: r.roomType ?? "",
    }));
    if (add.length) onAddRooms(add);
    manual.forEach((id) => {
      const e = byRow.get(id);
      if (e) delete e.source;
    });
    if (byRow.size) onApply([...byRow.values()]);
    setItems(null);
  };

  const total = (items?.filter(acts).length ?? 0) + rooms.length;
  const seen = progress ? Math.min(progress.done + (info?.maxRows ?? 0), progress.total) : 0;
  const chosen = picked.size + pickedRooms.size;
  const groups = items ? groupsOf(items) : [];
  const activeKey = active ?? (rooms.length ? ROOMS_KEY : groups[0]?.key ?? null);
  const activeGroup = groups.find((g) => g.key === activeKey);
  const activeTotal = activeKey === ROOMS_KEY ? rooms.length : activeGroup?.keys.length ?? 0;
  const from = page * PAGE_SIZE;
  const open = (key: string) => {
    setActive(key);
    setPage(0);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void ask()}
        title={aiOn ? "Sửa nhanh theo luật, rồi hỏi AI cho các dòng còn lại" : "Sửa nhanh theo luật: mã trùng, mã sai dạng, phòng còn thiếu…"}>
        {aiOn ? <Sparkles className="text-primary" /> : <Wand2 className="text-primary" />}
        {/* Chưa bật AI thì chỉ có sửa theo luật — gọi đúng tên, khỏi tưởng là AI. */}
        {aiOn ? "AI sửa lỗi" : "Sửa nhanh"}
      </Button>
      {/* Đang xem: màn chờ giữa màn hình (như lúc tải trang), không nhét chữ tiến độ vào nút trên thanh công cụ. */}
      {busy ? createPortal(<AiBusy busy={busy} seen={seen} total={progress?.total ?? 0} onStop={() => abortRef.current?.abort()} />, document.body) : null}
      <Dialog open={items !== null} onOpenChange={(o) => !o && setItems(null)}>
        <DialogContent size="wide" className="flex flex-col gap-0 p-0">
          <DialogHeader className="border-b px-6 pt-5 pb-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="text-primary size-5" />
              {aiOn ? "AI sửa lỗi" : "Sửa nhanh"} · {sheet.title}
              <HelpHint>Sửa nhanh theo luật chạy ngay trên dữ liệu hiện tại, không gọi AI; AI xem các dòng lỗi luật chưa sửa được và thiết bị chưa ghép được danh mục. Xem lại trước khi áp dụng.</HelpHint>
            </DialogTitle>
            {/* Chỉ còn một dòng số đếm theo nguồn — lời giải thích nằm trong dấu "?". */}
            <DialogDescription className="text-xs">
              {/* Nói rõ gợi ý từ đâu: sửa nhanh theo luật chạy ngay trên dữ liệu hiện tại (không gọi AI) — cùng dữ liệu
                  thì ra cùng gợi ý; AI chỉ được hỏi cho dòng lỗi luật chưa sửa được. */}
              {(() => {
                const acting = items?.filter(acts) ?? [];
                const rule = acting.filter((i) => i.source === "rule").length + rooms.length;
                const ai = acting.filter((i) => i.source === "ai").length;
                return <>{rule ? `${rule} sửa nhanh` : ""}{rule && ai ? " · " : ""}{ai ? `${ai} từ AI` : ""}</>;
              })()}
            </DialogDescription>
          </DialogHeader>
          {/* Trái: danh sách vấn đề. Phải: MỘT bảng của vấn đề đang chọn, có phân trang — không xếp chồng cả chục bảng. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[17rem_minmax(0,1fr)] sm:grid-rows-1">
            <ul className="space-y-0.5 overflow-y-auto border-b p-2 max-sm:max-h-36 sm:border-e sm:border-b-0">
              {rooms.length ? (
                <li className={cn("flex items-start gap-2 rounded-md px-2 py-2", activeKey === ROOMS_KEY && "bg-primary/10")}>
                  <Checkbox className="mt-0.5" aria-label="Chọn cả nhóm phòng còn thiếu"
                    checked={pickedRooms.size === rooms.length ? true : pickedRooms.size ? "indeterminate" : false}
                    onCheckedChange={(v) => setPickedRooms(v === true ? new Set(rooms.map((r) => r.code)) : new Set())} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(ROOMS_KEY)}>
                    <span className="block text-sm font-medium">Phòng còn thiếu</span>
                    <span className="text-muted-foreground block text-xs tabular-nums">Chọn {pickedRooms.size}/{rooms.length}</span>
                  </button>
                </li>
              ) : null}
              {groups.map((g) => {
                const keys = g.keys.filter((k) => acts(items![k]));
                const count = keys.filter((k) => picked.has(k)).length;
                return (
                  <li key={g.key} className={cn("flex items-start gap-2 rounded-md px-2 py-2", activeKey === g.key && "bg-primary/10")}>
                    <Checkbox className="mt-0.5" disabled={!keys.length} aria-label={`Chọn cả nhóm ${titleOf(g, items!)}`}
                      checked={keys.length > 0 && count === keys.length ? true : count ? "indeterminate" : false}
                      onCheckedChange={(v) => setPicked((p) => {
                        const next = new Set(p);
                        keys.forEach((k) => (v === true ? next.add(k) : next.delete(k)));
                        return next;
                      })} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(g.key)}>
                      <span className="line-clamp-2 text-sm font-medium" title={titleOf(g, items!)}>{titleOf(g, items!)}</span>
                      <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
                        Chọn {count}/{keys.length}
                        {g.keys.some((k) => items![k].review) ? <span className="text-warning-text font-medium">Cần chọn</span> : null}
                        {g.ai ? <span className="text-primary font-medium">AI</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex min-h-0 min-w-0 flex-col">
              {activeKey === ROOMS_KEY ? (
                <>
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">Phòng còn thiếu</p>
                    <p className="text-muted-foreground text-xs">Thêm vào trang Phòng. Khối nhà, tầng, loại chép theo phòng có mã gần nhất.</p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-11" />
                          <TableHead>Mã phòng</TableHead>
                          <TableHead>Khối nhà</TableHead>
                          <TableHead className="w-16">Tầng</TableHead>
                          <TableHead>Loại phòng</TableHead>
                          <TableHead align="right" className="w-24">Số dòng dùng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rooms.slice(from, from + PAGE_SIZE).map((r) => {
                          const on = pickedRooms.has(r.code);
                          const toggle = () => setPickedRooms((p) => {
                            const next = new Set(p);
                            if (next.has(r.code)) next.delete(r.code); else next.add(r.code);
                            return next;
                          });
                          return (
                            <TableRow key={r.code} className="cursor-pointer" data-state={on ? "selected" : undefined} onClick={toggle}>
                              <TableCell><Checkbox checked={on} onClick={(e) => e.stopPropagation()} onCheckedChange={toggle} /></TableCell>
                              <TableCell className="truncate font-medium" title={r.code}>{r.code}</TableCell>
                              <TableCell className="truncate">{r.building ?? "—"}</TableCell>
                              <TableCell>{r.floor ?? "—"}</TableCell>
                              <TableCell className="truncate">{r.roomType ?? "—"}</TableCell>
                              <TableCell align="right" className="tabular-nums">{r.usedBy}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : activeGroup ? (() => {
                const editing = activeGroup.keys.filter((k) => ![SKIP, KEEP].includes(items![k].field));
                const options = editing.length > 1 ? items![editing[0]].options : undefined;
                const head = editing.length ? items![editing[0]] : items![activeGroup.keys[0]];
                const field = editing.length ? head.field : "code";
                const fieldLabel = head.fieldLabel ?? labelOf(field);
                const hasName = activeGroup.keys.some((k) => rowOf.get(items![k].rowId)?.data.name);
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="text-sm font-semibold">{titleOf(activeGroup, items!)}</p>
                        {explainOf(activeGroup, items!) ? <p className="text-muted-foreground text-xs">{explainOf(activeGroup, items!)}</p> : null}
                      </div>
                      {options?.length ? (
                        <Select onValueChange={(v) => {
                          if (!v) return;
                          setTyped((m) => {
                            const next = new Map(m);
                            editing.forEach((k) => next.set(k, v));
                            return next;
                          });
                          setPicked((p) => new Set([...p, ...editing]));
                        }}>
                          <SelectTrigger size="sm" className="w-56" aria-label={`Đổi cả ${editing.length} dòng`}>
                            <SelectValue placeholder={`Đổi cả ${editing.length} dòng thành…`} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-11" />
                            <TableHead align="right" className="w-16">Dòng</TableHead>
                            {hasName ? <TableHead>Tên</TableHead> : null}
                            <TableHead className="w-44 whitespace-normal">{fieldLabel} đang ghi</TableHead>
                            <TableHead className="w-60">Đổi thành</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeGroup.keys.slice(from, from + PAGE_SIZE).map((k) => {
                            const it = items![k];
                            const row = rowOf.get(it.rowId);
                            const on = picked.has(k);
                            const doing = acts(it);
                            const toggle = () => setPicked((p) => {
                              const next = new Set(p);
                              if (next.has(k)) next.delete(k); else next.add(k);
                              return next;
                            });
                            return (
                              <TableRow key={k} onClick={doing ? toggle : undefined} data-state={doing && on ? "selected" : undefined}
                                className={cn(doing ? "cursor-pointer" : "text-muted-foreground hover:bg-transparent")}>
                                <TableCell>
                                  {doing ? <Checkbox checked={on} onClick={(e) => e.stopPropagation()} onCheckedChange={toggle} /> : null}
                                </TableCell>
                                <TableCell align="right" className="tabular-nums">{it.rowNo ?? row?.rowNo ?? "?"}</TableCell>
                                {hasName ? <TableCell className="truncate" title={row?.data.name}>{row?.data.name || "—"}</TableCell> : null}
                                <TableCell className="text-muted-foreground truncate" title={it.from}>{it.from || "(trống)"}</TableCell>
                                <TableCell className="whitespace-normal">
                                  {it.field === KEEP ? (
                                    <span className="text-muted-foreground">Giữ nguyên</span>
                                  ) : it.field === SKIP ? (
                                    <span className="text-destructive-text block truncate" title={it.to}>Bỏ dòng{it.to && it.to !== "Bỏ dòng" ? ` (${it.to.toLowerCase()})` : ""}</span>
                                  ) : it.options?.length ? (
                                    <span className="flex" onClick={(e) => e.stopPropagation()}>
                                      <Select value={typed.get(k) ?? it.to} onValueChange={(v) => {
                                        if (!v) return;
                                        setTyped((m) => new Map(m).set(k, v));
                                        setPicked((p) => (p.has(k) ? p : new Set(p).add(k)));
                                      }}>
                                        <SelectTrigger size="sm" className="w-full" aria-label={`${fieldLabel} mới, dòng ${row?.rowNo ?? ""}`}>
                                          <SelectValue placeholder={`Chọn ${fieldLabel.toLowerCase()}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {it.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </span>
                                  ) : (
                                    // Thấy chưa đúng thì gõ sửa luôn, áp dụng lấy giá trị đã gõ.
                                    <span className="flex" onClick={(e) => e.stopPropagation()}>
                                      <Input value={typed.get(k) ?? it.to} placeholder="Để trống" aria-label={`${fieldLabel} mới, dòng ${row?.rowNo ?? ""}`}
                                        className={cn("h-8", typed.has(k) && typed.get(k) !== it.to && "border-warning")}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setTyped((m) => new Map(m).set(k, v));
                                          setPicked((p) => (p.has(k) ? p : new Set(p).add(k)));
                                        }} />
                                    </span>
                                  )}
                                  {/* Ghép danh mục: tên thiết bị trong danh mục + vì sao — mã thôi thì không kiểm được. */}
                                  {it.source === "ai" && it.field === "catalog" && it.reason ? (
                                    <span className="text-muted-foreground mt-0.5 block truncate text-xs" title={it.reason}>{it.reason}</span>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })() : null}
              {activeTotal > PAGE_SIZE ? (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">{from + 1}–{Math.min(from + PAGE_SIZE, activeTotal)} / {activeTotal}</span>
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Trang trước" disabled={from === 0} onClick={() => setPage((n) => n - 1)}>
                    <ChevronLeft />
                  </Button>
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Trang sau" disabled={from + PAGE_SIZE >= activeTotal} onClick={() => setPage((n) => n + 1)}>
                    <ChevronRight />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="items-center border-t px-6 py-3">
            <Button type="button" variant="ghost" size="sm" className="sm:me-auto" onClick={() => {
              const all = chosen === total;
              setPicked(all ? new Set() : new Set(items?.flatMap((it, k) => (acts(it) ? [k] : []))));
              setPickedRooms(all ? new Set() : new Set(rooms.map((r) => r.code)));
            }}>
              {chosen === total ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setItems(null)}>Đóng</Button>
            <Button type="button" disabled={!chosen} onClick={apply}>Áp dụng {chosen} gợi ý</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Gom gợi ý theo lý do: cùng lý do là cùng một chuyện — cùng một mã lặp (giữ / bỏ / đổi mã), cùng kiểu sai dạng. Nhóm theo
 * thứ tự dòng đầu tiên của nhóm, giữ nguyên chỉ số `k` để tích / bỏ tích trỏ đúng gợi ý.
 */
function groupsOf(items: Item[]) {
  const map = new Map<string, { key: string; reason: string; ai: boolean; keys: number[] }>();
  items.forEach((it, k) => {
    const catalog = it.source === "ai" && it.field === "catalog";
    const reason = catalog ? CATALOG_GROUP : it.reason || (it.field === SKIP ? "Bỏ dòng" : `Sửa ${it.field}`);
    const key = reason;
    if (!map.has(key)) map.set(key, { key, reason, ai: false, keys: [] });
    const g = map.get(key)!;
    g.keys.push(k);
    if (it.source === "ai") g.ai = true;
  });
  // Nhóm cần người dùng chọn lên đầu: đó là việc chưa thể áp dụng ngay.
  const needsChoice = (g: { keys: number[] }) => (g.keys.some((k) => items[k].review) ? 0 : 1);
  return [...map.values()].sort((a, b) => needsChoice(a) - needsChoice(b));
}

type Group = ReturnType<typeof groupsOf>[number];
const isDuplicate = (g: Group) => /lặp lại ở các dòng/.test(g.reason);

function titleOf(g: Group, items: Item[]) {
  return isDuplicate(g) ? `Trùng mã “${items[g.keys[0]].from}”, ${g.keys.length} dòng` : g.reason;
}

/** Một câu nói sẽ xử lý nhóm trùng mã ra sao; nhóm khác thì tiêu đề đã đủ. */
function explainOf(g: Group, items: Item[]) {
  if (!isDuplicate(g)) return null;
  const skips = g.keys.filter((k) => items[k].field === SKIP).length;
  const renames = g.keys.filter((k) => ![SKIP, KEEP].includes(items[k].field)).length;
  return skips && !renames ? "Các dòng giống hệt nhau: giữ 1 dòng, bỏ các dòng thừa."
    : renames && !skips ? "Mỗi dòng là một thứ khác nhau: đặt cho mỗi dòng một mã riêng."
      : "Dòng giống hệt thì bỏ, dòng khác nhau thì đặt mã riêng.";
}

/** Màn chờ giữa màn hình lúc đang tìm gợi ý: vòng quay quanh biểu tượng AI, số dòng đã xem, thanh tiến độ, nút Dừng. */
function AiBusy({ busy, seen, total, onStop }: { busy: "rule" | "ai"; seen: number; total: number; onStop: () => void }) {
  return (
    <div role="status" aria-live="polite"
      className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="bg-card shadow-e2 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border px-8 py-7 text-center">
        <div className="relative flex size-28 items-center justify-center">
          <Spinner size="2xl" label="Đang tìm gợi ý" className="absolute inset-0" />
          <Sparkles className="text-primary relative size-9" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold">{busy === "rule" ? "Đang tìm lỗi sửa được…" : "AI đang xem các dòng lỗi…"}</p>
          <p className="text-muted-foreground text-sm tabular-nums">{busy === "ai" && total ? `Đang xem ${seen}/${total} dòng` : "Chờ một chút"}</p>
        </div>
        {busy === "ai" && total ? (
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div className="bg-brand-gradient h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(8, (seen / total) * 100)}%` }} />
          </div>
        ) : null}
        {busy === "ai" ? (
          <Button type="button" size="sm" variant="outline" onClick={onStop} title="Dừng hỏi AI, giữ các gợi ý đã có">
            <Square className="fill-current" />
            Dừng
          </Button>
        ) : null}
      </div>
    </div>
  );
}
