import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { maxLengthOf, numberError, textError } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import type { NormRow, SchoolAdequacy } from "@/domains/procurement/types";
import {
  describeLine,
  formatRatio,
  METHOD_LABELS,
  minAllowed,
  type AdjustMethod,
  type AdjustRule,
  type Adjustment,
  type AdjustmentLine,
} from "@/domains/standard-adjustment/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";

const CURRENT_KEY = ["standard_adjustments", "current"] as const;

/** Đề nghị điều chỉnh đang mở (nháp / chờ duyệt) của trường người xem. */
export function useCurrentAdjustment(enabled: boolean) {
  return useQuery({
    queryKey: CURRENT_KEY,
    enabled,
    queryFn: ({ signal }) => kyInstance.get("standard_adjustments/current", { signal }).json<{ adjustment: Adjustment | null }>(),
    select: (d) => d.adjustment,
  });
}

/** Sau mọi thay đổi: đọc lại đề nghị và bảng chuẩn của trường. */
function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["standard_adjustments"] });
    void qc.invalidateQueries({ queryKey: ["purchase_proposals", "adequacy"] });
  };
}

/** Quyền lập đề nghị (cán bộ thiết bị, lãnh đạo trường). */
export function useCanAdjust() {
  return useCan({ resource: "standard_adjustments", action: "create" }).data?.can ?? false;
}

const shortText = (r: NormRow) => {
  const a = r.adjustment;
  if (!a) return "";
  if (a.method === "QUANTITY") return `Số phải có ${r.baseRequired ?? "?"} → ${a.quantity}`;
  return `${a.method === "CUSTOM" ? "Tự khai" : "Thay bằng"} ${a.substituteName ?? ""}`;
};

/**
 * Ô cột "Điều chỉnh" của một dòng: khoá khi Sở chưa cho điều chỉnh; nhãn điều chỉnh đã duyệt; dòng của đề nghị
 * đang mở; nút Điều chỉnh / Sửa.
 */
export function AdjustCell({ row, line, current, canWrite, onAdjust }: {
  row: NormRow;
  line?: AdjustmentLine;
  current: Adjustment | null | undefined;
  canWrite: boolean;
  onAdjust: (row: NormRow) => void;
}) {
  if (!row.adjustable && !row.adjustment) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" title="Sở chưa cho điều chỉnh thiết bị này">
        <Lock className="size-3" /> Theo chuẩn Bộ
      </span>
    );
  }
  const pending = current?.status === "PENDING";
  return (
    <div className="min-w-0 space-y-1">
      {row.adjustment ? (
        <div className="flex min-w-0 items-center gap-1.5" title={`${shortText(row)} · ${row.adjustment.reason}`}>
          <Badge variant="success" className="shrink-0">Đã duyệt</Badge>
          <span className="text-muted-foreground truncate text-xs">{shortText(row)}</span>
        </div>
      ) : null}
      {line ? (
        <div className="flex min-w-0 items-center gap-1.5" title={`${describeLine(line)} · ${line.reason}`}>
          <Badge variant={pending ? "warning" : "neutral"} className="shrink-0">{pending ? "Chờ duyệt" : "Nháp"}</Badge>
          <span className="text-muted-foreground truncate text-xs">{describeLine(line)}</span>
        </div>
      ) : null}
      {line?.returnedNote && !pending ? (
        <p className="text-destructive-text truncate text-xs" title={line.returnedNote}>Bị trả lại: {line.returnedNote}</p>
      ) : null}
      {row.adjustable && canWrite && !pending ? (
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAdjust(row)}>
          <SlidersHorizontal /> {line ? "Sửa" : "Điều chỉnh"}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Dải "Điều chỉnh chuẩn" trên bảng của trường: đề nghị đang ở đâu, và nút Xem / Trình / Rút lại.
 */
export function AdjustmentBar({ data, current, canWrite }: {
  data: SchoolAdequacy;
  current: Adjustment | null | undefined;
  canWrite: boolean;
}) {
  const { open: notify } = useNotification();
  const refresh = useRefresh();
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const returned = current?.items.filter((l) => l.returnedNote).length ?? 0;

  const recall = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await kyInstance.post(`standard_adjustments/${current.id}/recall`).json();
      refresh();
      notify?.({ type: "success", message: "Đã rút đề nghị về nháp" });
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  let text: string;
  if (!current) {
    text = data.adjusted
      ? `${data.adjusted} thiết bị đang theo chuẩn đã duyệt điều chỉnh. Theo chuẩn Bộ: đủ ${data.baseMet}/${data.norms}.`
      : data.rows.some((r) => r.adjustable)
        ? "Chưa có điều chỉnh. Thiết bị có nút Điều chỉnh là thiết bị Sở cho điều chỉnh."
        : "Sở chưa cho điều chỉnh thiết bị nào của cấp học này. Mọi thiết bị theo chuẩn Bộ.";
  } else if (current.status === "DRAFT") {
    text = `Đang soạn ${current.lines} dòng, chưa có hiệu lực.${returned ? ` ${returned} dòng bị trả lại cần sửa.` : ""}`;
  } else {
    text = `Đã trình ${current.lines} dòng cho ${current.bodyName ?? "cơ quan quản lý"} lúc ${current.submittedAt ?? ""}. Trong lúc chờ, vẫn tính theo chuẩn đang dùng.`;
  }

  return (
    <>
      <Card className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-muted-foreground size-4" />
            <span className="text-sm font-semibold">Điều chỉnh chuẩn</span>
            {current ? (
              <Badge variant={current.status === "PENDING" ? "warning" : "neutral"}>
                {current.status === "PENDING" ? `Chờ duyệt · ${current.code ?? ""}` : "Nháp"}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{text}</p>
        </div>
        {current ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setViewing(true)}>
              Xem đề nghị ({current.lines})
            </Button>
            {canWrite && current.status === "PENDING" ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void recall()}>
                {busy ? <Loader2 className="animate-spin" /> : null} Rút lại để sửa
              </Button>
            ) : null}
            {canWrite && current.status === "DRAFT" ? (
              <Button type="button" size="sm" onClick={() => setViewing(true)}>Trình duyệt</Button>
            ) : null}
          </div>
        ) : null}
      </Card>
      {current ? <DraftDialog adjustment={current} open={viewing} onOpenChange={setViewing} canWrite={canWrite} /> : null}
    </>
  );
}

/** Đề nghị đang mở: các dòng, bỏ dòng, ghi chú gửi kèm và Trình. */
function DraftDialog({ adjustment, open, onOpenChange, canWrite }: {
  adjustment: Adjustment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const { open: notify } = useNotification();
  const refresh = useRefresh();
  const [note, setNote] = useState("");
  const noteError = textError("NOTE", "Ghi chú gửi kèm", note);
  const [busy, setBusy] = useState<string | null>(null);
  const editable = canWrite && adjustment.status === "DRAFT";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Đề nghị điều chỉnh chuẩn{adjustment.code ? ` ${adjustment.code}` : ""}</DialogTitle>
          <DialogDescription>
            {adjustment.status === "DRAFT"
              ? `Gửi ${adjustment.bodyName ?? "cơ quan quản lý"} duyệt. Dòng được duyệt mới có hiệu lực.`
              : `Đã trình ${adjustment.submittedAt ?? ""}${adjustment.submittedBy ? ` · ${adjustment.submittedBy}` : ""}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Điều chỉnh</TableHead>
                <TableHead className="text-right">Sau điều chỉnh</TableHead>
                <TableHead>Lý do</TableHead>
                {editable ? <TableHead className="w-16" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustment.items.map((l) => (
                <TableRow key={l.id} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="max-w-56">
                    <div className="truncate font-medium" title={l.catalogName}>{l.catalogName}</div>
                    <div className="text-muted-foreground font-mono text-xs">{l.catalogCode}</div>
                  </TableCell>
                  <TableCell className="text-sm">{describeLine(l)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <Verdict required={l.adjustedRequired} have={l.adjustedCurrent} />
                  </TableCell>
                  <TableCell className="max-w-64 text-sm">
                    <div className="line-clamp-2" title={l.reason}>{l.reason}</div>
                    {l.returnedNote ? <div className="text-destructive-text text-xs">Bị trả lại: {l.returnedNote}</div> : null}
                  </TableCell>
                  {editable ? (
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive-text" disabled={busy != null}
                        onClick={() => void run(`del${l.id}`, () => kyInstance.delete(`standard_adjustments/lines/${l.id}`).json())}>
                        Bỏ
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {editable ? (
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Ghi chú gửi kèm</Label>
            <Textarea id="adj-note" rows={1} className="min-h-9" value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")} />
            {noteError ? <p className="text-destructive-text text-xs">{noteError}</p> : null}
          </div>
        ) : adjustment.note ? (
          <p className="text-muted-foreground text-sm">Ghi chú: {adjustment.note}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          {editable ? (
            <Button type="button" disabled={busy != null || adjustment.lines === 0 || !!noteError}
              onClick={async () => {
                const ok = await run("submit", () => kyInstance.post(`standard_adjustments/${adjustment.id}/submit`, { json: { note } }).json(),
                  `Đã trình ${adjustment.lines} dòng`);
                if (ok) onOpenChange(false);
              }}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : null}
              Trình {adjustment.bodyName ?? "duyệt"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Đủ" / "Thiếu N" / "Thừa N" từ số phải có và số đang có. */
export function Verdict({ required, have }: { required: number | null | undefined; have: number | null | undefined }) {
  if (required == null || have == null) return <span className="text-muted-foreground">—</span>;
  const label = have >= required ? (have > required ? `Thừa ${have - required}` : "Đủ") : `Thiếu ${required - have}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{have}/{required}</span>
      <Badge variant={have >= required ? (have > required ? "info" : "success") : "destructive"}>{label}</Badge>
    </span>
  );
}

type SchoolItem = { id: number; code: string; name: string; unit?: { name?: string } | null };

/**
 * Hộp điều chỉnh MỘT thiết bị: chỉ các cách Sở cho, trong giới hạn Sở đặt; phải ghi lý do. Lưu là thêm / sửa dòng
 * trong đề nghị nháp — chưa có hiệu lực cho tới khi được duyệt.
 */
export function AdjustDialog({ row, line, rows, onClose }: {
  row: NormRow | null;
  line?: AdjustmentLine;
  rows: NormRow[];
  onClose: () => void;
}) {
  const { open: notify } = useNotification();
  const refresh = useRefresh();
  const catalogId = row?.catalogId ?? null;
  const ruleQuery = useQuery({
    queryKey: ["standard_adjustment_rules", "own", catalogId],
    enabled: catalogId != null,
    queryFn: ({ signal }) => kyInstance.get("standard_adjustment_rules", { signal,  searchParams: { catalogId: String(catalogId) } }).json<AdjustRule[]>(),
  });
  const rule = ruleQuery.data?.[0];
  const schoolItems = useQuery({
    queryKey: ["equipment_catalogs", "school-items"],
    enabled: !!rule?.allowCustom,
    queryFn: ({ signal }) => kyInstance.get("equipment_catalogs", { signal,  searchParams: { ownership: "school", _start: "0", _end: "500" } }).json<SchoolItem[]>(),
  });

  const methods = useMemo(() => {
    const m: AdjustMethod[] = [];
    if (rule?.allowReduce) m.push("QUANTITY");
    if (rule?.allowSubstitute) m.push("SUBSTITUTE");
    if (rule?.allowCustom) m.push("CUSTOM");
    return m;
  }, [rule]);

  const [method, setMethod] = useState<AdjustMethod | "">("");
  const [quantity, setQuantity] = useState("");
  const [substituteId, setSubstituteId] = useState<string>("");
  const [ratio, setRatio] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  // Mở hộp: điền theo dòng nháp nếu có, không thì cách đầu tiên Sở cho.
  useEffect(() => {
    if (!row || !rule) return;
    setTried(false);
    if (line) {
      setMethod(line.method);
      setQuantity(line.quantity != null ? String(line.quantity) : "");
      setSubstituteId(line.substituteId ? String(line.substituteId) : "");
      setRatio(line.ratio != null ? String(line.ratio) : "1");
      setReason(line.reason);
    } else {
      setMethod(methods[0] ?? "");
      setQuantity(row.baseRequired != null ? String(row.baseRequired) : "");
      setSubstituteId(rule.substitutes[0] ? String(rule.substitutes[0].catalogId) : "");
      setRatio("1");
      setReason("");
    }
  }, [row, rule, line, methods]);

  if (!row) return null;
  const base = row.baseRequired;
  const min = base != null && rule ? minAllowed(base, rule.reduceFloor) : null;
  const qty = quantity.trim() === "" ? null : Number(quantity);
  const qtyError =
    method !== "QUANTITY" ? null
      : qty == null || !Number.isInteger(qty) || qty < 0 ? "Ghi số nguyên từ 0 trở lên"
        : numberError("QUANTITY_OR_ZERO", "Số lượng", qty) ? numberError("QUANTITY_OR_ZERO", "Số lượng", qty)
        : base == null ? "Chưa tính được chuẩn Bộ — khai đủ lớp, giáo viên, phòng trước"
          : min != null && qty < min ? `Không thấp hơn ${min} (${rule?.reduceFloor}% chuẩn Bộ)` : null;
  const ratioNum = Number(ratio.replace(",", "."));
  const subError = method === "SUBSTITUTE" || method === "CUSTOM"
    ? !substituteId ? "Chọn thiết bị thay thế" : method === "CUSTOM" && !(ratioNum > 0) ? "Tỉ lệ quy đổi phải lớn hơn 0"
      : method === "CUSTOM" && ratioNum > 999999.99 ? "Tỉ lệ quy đổi tối đa 999.999,99" : null
    : null;
  const reasonError = reason.trim() ? (textError("NOTE", "Lý do", reason) ?? null) : "Ghi lý do điều chỉnh";

  // Xem trước kết quả với số đang có của trường.
  const subRule = rule?.substitutes.find((s) => String(s.catalogId) === substituteId);
  const subCount = substituteId ? rows.find((r) => String(r.catalogId) === substituteId)?.baseCurrent : undefined;
  const effRatio = method === "SUBSTITUTE" ? subRule?.ratio : ratioNum;
  const previewRequired = method === "QUANTITY" ? qty : base;
  const previewHave = method === "QUANTITY" ? row.baseCurrent
    : subCount != null && effRatio ? row.baseCurrent + Math.floor(subCount / effRatio) : null;

  const save = async () => {
    setTried(true);
    if (!method || qtyError || subError || reasonError) return;
    setBusy(true);
    try {
      await kyInstance.post("standard_adjustments/lines", {
        json: {
          catalogId: row.catalogId,
          method,
          quantity: method === "QUANTITY" ? qty : null,
          substituteId: method === "QUANTITY" ? null : Number(substituteId),
          ratio: method === "CUSTOM" ? ratioNum : null,
          reason: reason.trim(),
        },
      }).json();
      refresh();
      notify?.({ type: "success", message: "Đã thêm vào đề nghị", description: "Trình duyệt để có hiệu lực" });
      onClose();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!line) return;
    setBusy(true);
    try {
      await kyInstance.delete(`standard_adjustments/lines/${line.id}`).json();
      refresh();
      onClose();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Điều chỉnh: {row.normName}</DialogTitle>
          <DialogDescription>
            {row.catalogCode} · Chuẩn Bộ {base ?? "chưa tính được"} · Đang có {row.baseCurrent}
          </DialogDescription>
        </DialogHeader>
        {ruleQuery.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm"><Loader2 className="size-4 animate-spin" /> Đang tải quy định…</div>
        ) : !rule ? (
          <p className="text-muted-foreground py-4 text-sm">Sở chưa cho điều chỉnh thiết bị này.</p>
        ) : (
          <div className="space-y-4">
            {line?.returnedNote ? (
              <p className="bg-destructive-subtle text-destructive-text rounded-md px-3 py-2 text-sm">Lần trước bị trả lại: {line.returnedNote}</p>
            ) : null}
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as AdjustMethod)} className="gap-2">
              {methods.map((m) => (
                <Label key={m} htmlFor={`m-${m}`}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 font-normal", method === m && "border-primary bg-primary/5")}>
                  <RadioGroupItem id={`m-${m}`} value={m} />
                  <span className="font-medium">{METHOD_LABELS[m]}</span>
                  {m === "QUANTITY" && min != null ? (
                    <span className="text-muted-foreground ms-auto text-xs">thấp nhất {min}{rule.reduceFloor === 0 ? " (được bỏ hẳn)" : ""}</span>
                  ) : null}
                </Label>
              ))}
            </RadioGroup>

            {method === "QUANTITY" ? (
              <div className="grid items-start gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-qty">Số phải có <span className="text-destructive">*</span></Label>
                  <Input id="adj-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ""))} />
                  {tried && qtyError ? <p className="text-destructive-text text-xs">{qtyError}</p> : null}
                </div>
              </div>
            ) : null}

            {method === "SUBSTITUTE" ? (
              <div className="space-y-1.5">
                <Label>Thiết bị thay thế <span className="text-destructive">*</span></Label>
                <RadioGroup value={substituteId} onValueChange={setSubstituteId} className="gap-1.5">
                  {rule.substitutes.map((s) => {
                    const have = rows.find((r) => r.catalogId === s.catalogId)?.baseCurrent;
                    return (
                      <Label key={s.catalogId} htmlFor={`s-${s.catalogId}`} className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 font-normal">
                        <RadioGroupItem id={`s-${s.catalogId}`} value={String(s.catalogId)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          <span className="text-muted-foreground text-xs">{s.code} · 1 thiết bị gốc = {formatRatio(s.ratio)} {s.unit?.toLowerCase() ?? ""}</span>
                        </span>
                        {have != null ? <span className="text-muted-foreground text-xs tabular-nums">đang có {have}</span> : null}
                      </Label>
                    );
                  })}
                </RadioGroup>
                {tried && subError ? <p className="text-destructive-text text-xs">{subError}</p> : null}
              </div>
            ) : null}

            {method === "CUSTOM" ? (
              <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Thiết bị ngoài danh mục của trường <span className="text-destructive">*</span></Label>
                  <Select value={substituteId} onValueChange={(v) => v && setSubstituteId(v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn thiết bị" /></SelectTrigger>
                    <SelectContent>
                      {(schoolItems.data ?? []).map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>{i.name} · {i.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {schoolItems.data && schoolItems.data.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Trường chưa có thiết bị ngoài danh mục. Thêm khi ghi tăng.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adj-ratio">1 thiết bị gốc = <span className="text-destructive">*</span></Label>
                  <Input id="adj-ratio" inputMode="decimal" value={ratio} onChange={(e) => setRatio(e.target.value.replace(/[^\d.,]/g, ""))} />
                </div>
                {tried && subError ? <p className="text-destructive-text text-xs sm:col-span-3">{subError}</p> : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="adj-reason">Lý do <span className="text-destructive">*</span></Label>
              <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Điều kiện thực tế của trường" maxLength={maxLengthOf("NOTE")} />
              {tried && reasonError ? <p className="text-destructive-text text-xs">{reasonError}</p> : null}
            </div>

            <div className="bg-surface-subtle flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground">Sau điều chỉnh</span>
              <Verdict required={previewRequired} have={previewHave} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {line ? (
            <Button type="button" variant="ghost" className="text-destructive-text me-auto" disabled={busy} onClick={() => void remove()}>
              Bỏ dòng này
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
          <Button type="button" disabled={busy || !rule} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Lưu vào đề nghị
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
