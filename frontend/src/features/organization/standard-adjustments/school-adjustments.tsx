import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import type { NormRow, SchoolAdequacy } from "@/domains/procurement/types";
import { describeLine, type Adjustment, type AdjustmentLine } from "@/domains/standard-adjustment/types";

import { AdjustDialog, useCanAdjust, useCurrentAdjustment, Verdict } from "./school-adjust";
import { LIFT_ROW } from "@/shared/lib/row-lift";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");

/** Trạng thái một đề nghị nói bằng chữ của trường: nháp, chờ duyệt, hay kết quả (duyệt / trả lại bao nhiêu dòng). */
function StatusBadge({ a }: { a: Adjustment }) {
  if (a.status === "DRAFT") return <Badge variant="neutral">Nháp</Badge>;
  if (a.status === "PENDING") return <Badge variant="warning">Chờ duyệt</Badge>;
  if (a.returned === 0) return <Badge variant="success">Đã duyệt</Badge>;
  if (a.approved === 0) return <Badge variant="destructive">Trả lại</Badge>;
  return <Badge variant="info">Duyệt {a.approved}/{a.lines}</Badge>;
}

/** Sau mọi thay đổi: đọc lại danh sách, đề nghị đang mở và bảng chuẩn của trường. */
function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["standard_adjustments"] });
    void qc.invalidateQueries({ queryKey: ["purchase_proposals", "adequacy"] });
  };
}

/** Chuẩn tối thiểu của chính trường — nguồn của các thiết bị Sở cho điều chỉnh (kèm chuẩn Bộ, số đang có). */
function useOwnAdequacy() {
  return useQuery({
    queryKey: ["purchase_proposals", "adequacy", "own"],
    queryFn: ({ signal }) => kyInstance.get("purchase_proposals/adequacy", { signal }).json<SchoolAdequacy>(),
    select: (d) => (d && "rows" in d ? d : undefined),
  });
}

/**
 * Màn Điều chỉnh chuẩn của TRƯỜNG: danh sách các đề nghị đã lập (nháp · chờ duyệt · kết quả), bấm một dòng mở
 * hộp đề nghị; "Lập đề nghị" mở hộp trống (hoặc bản nháp đang có — mỗi trường một đề nghị đang mở). Thiết bị thêm
 * vào đề nghị chọn từ danh sách Sở cho điều chỉnh ở cấp học của trường.
 */
export function SchoolAdjustments() {
  const canWrite = useCanAdjust();
  const list = useQuery({
    queryKey: ["standard_adjustments", "own"],
    queryFn: ({ signal }) => kyInstance.get("standard_adjustments", { signal }).json<Adjustment[]>(),
  });
  const { data: current } = useCurrentAdjustment(true);
  const { data: adequacy } = useOwnAdequacy();
  // null = đóng; "open" = đề nghị đang mở (hoặc bản mới); số = xem một đề nghị cũ.
  const [open, setOpen] = useState<"open" | number | null>(null);

  const allowed = new Set((adequacy?.rows ?? []).filter((r) => r.adjustable && r.catalogId).map((r) => r.catalogId)).size;
  const pending = current?.status === "PENDING";
  const rows = list.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1 basis-72">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="text-muted-foreground size-4" />
              Đề nghị điều chỉnh chuẩn
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {!adequacy
                ? "Đang tải…"
                : allowed === 0
                  ? "Sở chưa cho điều chỉnh thiết bị nào của cấp học này. Mọi thiết bị theo chuẩn Bộ."
                  : `Sở cho điều chỉnh ${allowed} thiết bị.${adequacy.adjusted ? ` ${adequacy.adjusted} thiết bị đang theo chuẩn đã duyệt.` : ""}`}
            </p>
          </div>
          {canWrite ? (
            <Button type="button" disabled={pending || (allowed === 0 && !current)}
              title={pending ? "Đang có đề nghị chờ duyệt — rút lại để sửa" : undefined}
              onClick={() => setOpen("open")}>
              {current?.status === "DRAFT" ? <FileText /> : <Plus />}
              {current?.status === "DRAFT" ? "Tiếp tục bản nháp" : "Lập đề nghị"}
            </Button>
          ) : null}
        </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Số đề nghị</TableHead>
                  <TableHead>Lập lúc</TableHead>
                  <TableHead>Trình lúc</TableHead>
                  <TableHead>Gửi tới</TableHead>
                  <TableHead className="text-right">Số dòng</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableEmpty compact colSpan={7} loading={list.isLoading} title="Chưa có đề nghị nào" /> : null}
                {rows.map((a) => (
                  <TableRow key={a.id} className={cn("group/row", LIFT_ROW, "hover:bg-muted/50 cursor-pointer")}
                    onClick={() => setOpen(a.id === current?.id ? "open" : a.id)}>
                    <TableCell className="font-mono text-xs">{a.code ?? <span className="text-muted-foreground font-sans">Chưa cấp</span>}</TableCell>
                    <TableCell className="text-sm">{a.createdAt ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {a.submittedAt ?? "—"}
                      {a.submittedBy ? <span className="text-muted-foreground"> · {a.submittedBy}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">{a.bodyName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.lines}</TableCell>
                    <TableCell className="text-sm">
                      {a.status === "DONE" ? (
                        <span>
                          <span className="text-success-text">{a.approved} duyệt</span>
                          {a.returned ? <span className="text-destructive-text"> · {a.returned} trả lại</span> : null}
                          {a.reviewedAt ? <span className="text-muted-foreground"> · {a.reviewedAt}</span> : null}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><StatusBadge a={a} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
      </Card>

      {open != null ? (
        <AdjustmentDialog id={open === "open" ? null : open} current={current ?? null} rows={adequacy?.rows ?? []}
          canWrite={canWrite} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}

/**
 * Hộp một đề nghị. `id` trống: đề nghị đang mở của trường (hoặc bản mới — dòng đầu tiên lưu là bản nháp được tạo).
 * Nháp thì thêm / sửa / bỏ dòng, ghi chú và Trình; chờ duyệt thì Rút lại; đã có kết quả thì chỉ xem.
 */
function AdjustmentDialog({ id, current, rows, canWrite, onClose }: {
  id: number | null;
  current: Adjustment | null;
  rows: NormRow[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const { open: notify } = useNotification();
  const refresh = useRefresh();
  const past = useQuery({
    queryKey: ["standard_adjustments", "detail", id],
    enabled: id != null,
    queryFn: ({ signal }) => kyInstance.get(`standard_adjustments/${id}`, { signal }).json<Adjustment>(),
  });
  const a = id == null ? current : past.data ?? null;
  const status = a?.status ?? "DRAFT";
  const editable = canWrite && status === "DRAFT";
  const lines = a?.items ?? [];

  const [note, setNote] = useState("");
  const noteError = textError("NOTE", "Ghi chú gửi kèm", note);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<{ row: NormRow; line?: AdjustmentLine } | null>(null);

  const rowOf = (catalogId: number) => rows.find((r) => r.catalogId === catalogId && r.adjustable);

  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await work();
      refresh();
      if (done) notify?.({ type: "success", message: done });
      return true;
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const title = a?.code ? `Đề nghị điều chỉnh chuẩn ${a.code}` : a ? "Đề nghị điều chỉnh chuẩn (nháp)" : "Lập đề nghị điều chỉnh chuẩn";
  const sub = !a
    ? "Thêm thiết bị Sở cho điều chỉnh, ghi cách điều chỉnh và lý do, rồi trình."
    : status === "DRAFT"
      ? `Gửi ${a.bodyName ?? "cơ quan quản lý"} duyệt. Dòng được duyệt mới có hiệu lực.`
      : status === "PENDING"
        ? `Đã trình ${a.submittedAt ?? ""}${a.submittedBy ? ` · ${a.submittedBy}` : ""}. Chờ ${a.bodyName ?? "cơ quan quản lý"} duyệt.`
        : `${a.bodyName ?? "Cơ quan quản lý"} đã xét ${a.reviewedAt ?? ""}${a.reviewedBy ? ` · ${a.reviewedBy}` : ""}.`;

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent size="wide" className="flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              {title}
              {a ? <StatusBadge a={a} /> : null}
            </DialogTitle>
            <DialogDescription>{sub}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {id != null && past.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    Thiết bị điều chỉnh <span className="text-muted-foreground font-normal">({lines.length})</span>
                  </h3>
                  {editable ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                      <Plus /> Thêm thiết bị
                    </Button>
                  ) : null}
                </div>

                {lines.length === 0 ? (
                  <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
                    Chưa có thiết bị nào.
                    {editable ? (
                      <div className="mt-3">
                        <Button type="button" size="sm" onClick={() => setPicking(true)}><Plus /> Thêm thiết bị</Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thiết bị</TableHead>
                          <TableHead>Điều chỉnh</TableHead>
                          <TableHead className="text-right">Sau điều chỉnh</TableHead>
                          <TableHead>Lý do</TableHead>
                          {status === "DONE" ? <TableHead>Kết quả</TableHead> : null}
                          {editable ? <TableHead className="w-28" /> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l) => {
                          const row = rowOf(l.catalogId);
                          return (
                            <TableRow key={l.id} className={cn("group/row", LIFT_ROW)}>
                              <TableCell className="max-w-60">
                                <div className="truncate font-medium" title={l.catalogName}>{l.catalogName}</div>
                                <div className="text-muted-foreground text-xs">
                                  <span className="font-mono">{l.catalogCode}</span>{l.subjectName ? ` · ${l.subjectName}` : ""}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{describeLine(l)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                <Verdict required={l.adjustedRequired} have={l.adjustedCurrent} />
                              </TableCell>
                              <TableCell className="max-w-64 text-sm">
                                <div className="line-clamp-2" title={l.reason}>{l.reason}</div>
                                {l.returnedNote && status === "DRAFT" ? (
                                  <div className="text-destructive-text text-xs">Lần trước bị trả lại: {l.returnedNote}</div>
                                ) : null}
                              </TableCell>
                              {status === "DONE" ? (
                                <TableCell className="text-sm">
                                  {l.decision === "APPROVED" ? <Badge variant="success">Duyệt</Badge>
                                    : l.decision === "RETURNED" ? <Badge variant="destructive">Trả lại</Badge> : "—"}
                                  {l.decisionNote ? <div className="text-muted-foreground mt-1 text-xs">{l.decisionNote}</div> : null}
                                </TableCell>
                              ) : null}
                              {editable ? (
                                <TableCell className="text-right whitespace-nowrap">
                                  <Button type="button" variant="ghost" size="sm" disabled={!row || busy != null}
                                    title={row ? undefined : "Sở không còn cho điều chỉnh thiết bị này"}
                                    onClick={() => row && setEditing({ row, line: l })}>
                                    Sửa
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="text-destructive-text" disabled={busy != null}
                                    onClick={() => void run(`del${l.id}`, () => kyInstance.delete(`standard_adjustments/lines/${l.id}`).json())}>
                                    Bỏ
                                  </Button>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {editable && a ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="adj-note">Ghi chú gửi kèm</Label>
                    <Textarea id="adj-note" rows={1} className="min-h-9" value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")} />
                    {noteError ? <p className="text-destructive-text text-xs">{noteError}</p> : null}
                  </div>
                ) : a?.note ? (
                  <p className="text-muted-foreground text-sm">Ghi chú: {a.note}</p>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
            <div>
              {editable && a ? (
                <Button type="button" variant="ghost" className="text-destructive-text" disabled={busy != null}
                  onClick={async () => {
                    const ok = await run("delete", () => kyInstance.delete(`standard_adjustments/${a.id}`).json(), "Đã xoá bản nháp");
                    if (ok) onClose();
                  }}>
                  Xoá bản nháp
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
              {canWrite && a && status === "PENDING" ? (
                <Button type="button" variant="outline" disabled={busy != null}
                  onClick={() => void run("recall", () => kyInstance.post(`standard_adjustments/${a.id}/recall`).json(), "Đã rút đề nghị về nháp")}>
                  {busy === "recall" ? <Loader2 className="animate-spin" /> : null} Rút lại để sửa
                </Button>
              ) : null}
              {editable ? (
                <Button type="button" disabled={busy != null || !a || lines.length === 0 || !!noteError}
                  onClick={async () => {
                    if (!a) return;
                    const ok = await run("submit", () => kyInstance.post(`standard_adjustments/${a.id}/submit`, { json: { note } }).json(),
                      `Đã trình ${lines.length} dòng`);
                    if (ok) onClose();
                  }}>
                  {busy === "submit" ? <Loader2 className="animate-spin" /> : null}
                  Trình {a?.bodyName ?? "duyệt"}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {picking ? (
        <DevicePicker rows={rows} taken={new Set(lines.map((l) => l.catalogId))}
          onPick={(row) => { setPicking(false); setEditing({ row }); }} onClose={() => setPicking(false)} />
      ) : null}
      {editing ? (
        <AdjustDialog row={editing.row} line={editing.line} rows={rows} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

/** Chọn MỘT thiết bị Sở cho điều chỉnh để thêm vào đề nghị; thiết bị đã có trong đề nghị thì mờ. */
function DevicePicker({ rows, taken, onPick, onClose }: {
  rows: NormRow[];
  taken: Set<number>;
  onPick: (row: NormRow) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const seen = new Set<number>();
    return rows.filter((r) => {
      if (!r.adjustable || r.catalogId == null || seen.has(r.catalogId)) return false;
      seen.add(r.catalogId);
      return true;
    });
  }, [rows]);
  const needle = fold(q.trim());
  const shown = needle
    ? items.filter((r) => fold(`${r.normName} ${r.catalogCode ?? ""} ${r.subjectName ?? ""}`).includes(needle))
    : items;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Chọn thiết bị điều chỉnh</DialogTitle>
          <DialogDescription>Chỉ các thiết bị Sở cho điều chỉnh ở cấp học của trường.</DialogDescription>
        </DialogHeader>
        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, môn…" className="ps-8" />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {shown.length === 0 ? (
            <li className="text-muted-foreground px-3 py-8 text-center text-sm">
              {items.length === 0 ? "Sở chưa cho điều chỉnh thiết bị nào." : "Không có thiết bị nào khớp."}
            </li>
          ) : shown.map((r) => {
            const added = taken.has(r.catalogId!);
            return (
              <li key={r.catalogId}>
                <button type="button" disabled={added} onClick={() => onPick(r)}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-start transition-colors",
                    added ? "opacity-50" : "hover:bg-accent/50")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.normName}</span>
                    <span className="text-muted-foreground text-xs">
                      <span className="font-mono">{r.catalogCode}</span>{r.subjectName ? ` · ${r.subjectName}` : ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    Chuẩn Bộ {r.baseRequired ?? "—"} · Đang có {r.baseCurrent}
                  </span>
                  {added ? <Badge variant="neutral">Đã thêm</Badge> : r.adjustment ? <Badge variant="success">Đang điều chỉnh</Badge> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
