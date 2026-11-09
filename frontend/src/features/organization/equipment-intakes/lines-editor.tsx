import { useCustom } from "@refinedev/core";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useWatch, type Control, type UseFormGetValues, type UseFormSetValue } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, SelectField, TextField } from "@/shared/components/form/simple-fields";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { customResult } from "@/shared/hooks/use-custom-result";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CatalogPicker, type PickedCatalog } from "@/features/organization/equipment-intakes/catalog-picker";
import { IntField, NO_REF, ReasonField, RefField, useIncreaseReasons, type RefValue } from "@/features/organization/equipment-intakes/fields";
import { formatVnd } from "@/features/organization/equipment-intakes/money";
import { FUNDING_SOURCE_OPTIONS, lineIssues, lineOutcome } from "@/domains/equipment-intake/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Giá trị "nguồn kinh phí" của dòng khi theo đầu phiếu. */
export const FROM_HEAD = "HEAD";
const LINE_FUNDING_OPTIONS = [{ value: FROM_HEAD, label: "Theo đầu phiếu" }, ...FUNDING_SOURCE_OPTIONS];

/** Sự kiện "mở dòng thứ i" — mục "Cần hoàn thiện" ở cột phải gửi, bảng dòng nghe. */
export const OPEN_LINE_EVENT = "equipment-intake:open-line";

/** Thiết bị của dòng trên form: kèm cách quản lý và đơn vị tính để kiểm tra trước khi trình. */
export type CatalogValue = RefValue & {
  trackingType?: "SERIAL" | "BULK" | null;
  unit?: { id: number; name: string } | null;
  physicalOrDigital?: string | null;
};

export function newLine(c: PickedCatalog, room: RefValue, reason: RefValue) {
  return {
    catalog: { id: c.id, name: c.name, code: c.code, trackingType: c.trackingType, unit: c.unit, physicalOrDigital: c.physicalOrDigital } as CatalogValue,
    name: c.name,
    physicalOrDigital: c.physicalOrDigital ?? "",
    documentQuantity: 1 as number | "",
    receivedQuantity: 1 as number | "",
    varianceReason: "",
    unitPrice: null as number | null,
    room,
    movementReason: reason,
    supplier: "",
    documentNo: "",
    documentDate: "",
    fundingSource: FROM_HEAD,
    warrantyMonths: "" as number | "",
    model: "",
    manufacturer: "",
    note: "",
  };
}

export type LineForm = ReturnType<typeof newLine>;

const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
const amountOf = (l: Partial<LineForm>) => (l.unitPrice != null ? l.unitPrice * num(l.receivedQuantity) : null);

/**
 * Bảng thiết bị nhận (PN-01): mỗi dòng một thiết bị, cột Đủ cho biết dòng còn thiếu mấy mục. Bấm một dòng
 * mở hộp chi tiết để sửa. Thêm dòng bằng "Chọn thiết bị từ danh mục".
 */
export function LinesEditor({ control, getValues, setValue }: {
  control: Control<any>;
  getValues: UseFormGetValues<any>;
  setValue: UseFormSetValue<any>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = (useWatch({ control, name: "lines" }) ?? []) as LineForm[];
  const headFunding = useWatch({ control, name: "fundingSource" }) as string;
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const reasons = useIncreaseReasons();

  useEffect(() => {
    const open = (e: Event) => setEditing((e as CustomEvent<number>).detail);
    window.addEventListener(OPEN_LINE_EVENT, open);
    return () => window.removeEventListener(OPEN_LINE_EVENT, open);
  }, []);

  const total = lines.reduce((s, l) => s + (amountOf(l) ?? 0), 0);

  /** Dòng mới mang lý do tăng của dòng cuối, không có thì "Mua mới". */
  const defaultReason = (): RefValue => {
    const last = lines[lines.length - 1]?.movementReason;
    if (last?.id) return last;
    const r = reasons.find((x) => x.code === "MUAMOI") ?? reasons[0];
    return r ? { id: r.id, name: r.name, code: r.code } : NO_REF;
  };

  return (
    <VoucherLinesCard>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <StepTitle title="Thiết bị nhận" aside={fields.length ? `${fields.length} dòng · ${formatVnd(total)}` : undefined} />
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          <Plus />
          Chọn thiết bị từ danh mục
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground border-t px-4 py-8 text-center text-sm">
          Chưa có thiết bị nào. Bấm "Chọn thiết bị từ danh mục" để thêm.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Thiết bị</TableHead>
              <TableHead className="text-right">SL thực nhận</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead className="text-center">Đủ</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f, i) => {
              const l = lines[i] ?? ({} as LineForm);
              const issues = lineIssues(l, l.catalog ?? undefined, headFunding);
              const differs = num(l.documentQuantity) !== num(l.receivedQuantity);
              return (
                <TableRow key={f.id} className="cursor-pointer" onClick={() => setEditing(i)}>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{l.name || l.catalog?.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {[l.catalog?.code, l.movementReason?.name].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(l.receivedQuantity)}
                    {l.catalog?.unit ? ` ${l.catalog.unit.name}` : ""}
                    {differs ? <div className="text-warning-text text-xs">HĐ: {num(l.documentQuantity)}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(l.unitPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(amountOf(l))}</TableCell>
                  <TableCell>{l.room?.id ? l.room.name ?? "Phòng đã chọn" : <span className="text-muted-foreground">Kho</span>}</TableCell>
                  <TableCell className="text-center">
                    {issues.length === 0 ? (
                      <Check className="text-success-text mx-auto size-4" />
                    ) : (
                      <span className="text-warning-text inline-flex items-center gap-1 text-xs font-medium" title={issues.join("\n")}>
                        <CircleAlert className="size-3.5" />
                        {issues.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" title="Sửa dòng" onClick={() => setEditing(i)}>
                        <Pencil />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" title="Bỏ dòng" onClick={() => remove(i)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <CatalogPicker
        open={picking}
        onOpenChange={setPicking}
        onAdd={(items, room) => {
          const reason = defaultReason();
          const start = fields.length;
          append(items.map((c) => newLine(c, room, reason)));
          // Một thiết bị thì mở luôn dòng đó để nhập số lượng, đơn giá.
          if (items.length === 1) setEditing(start);
        }}
      />
      {editing != null && editing < fields.length ? (
        <LineDialog
          control={control}
          index={editing}
          count={fields.length}
          headFunding={headFunding}
          onIndex={setEditing}
          onClose={() => setEditing(null)}
          onCopyToAll={() => copyDocumentsToAll(editing, getValues, setValue)}
        />
      ) : null}
    </VoucherLinesCard>
  );
}

/** Các ô "chứng từ" của dòng — nút "Chép cho mọi dòng" chép đúng các ô này. */
const DOCUMENT_KEYS = ["supplier", "documentNo", "documentDate", "fundingSource", "movementReason", "warrantyMonths"] as const;

function copyDocumentsToAll(from: number, getValues: UseFormGetValues<any>, setValue: UseFormSetValue<any>) {
  const lines = (getValues("lines") ?? []) as LineForm[];
  const source = lines[from];
  if (!source) return;
  lines.forEach((_, i) => {
    if (i === from) return;
    for (const k of DOCUMENT_KEYS) setValue(`lines.${i}.${k}`, source[k], { shouldDirty: true });
  });
}

/** Hộp chi tiết một dòng (hình 29 của đặc tả). */
function LineDialog({ control, index, count, headFunding, onIndex, onClose, onCopyToAll }: {
  control: Control<any>;
  index: number;
  count: number;
  headFunding: string;
  onIndex: (i: number) => void;
  onClose: () => void;
  onCopyToAll: () => void;
}) {
  const p = `lines.${index}`;
  const line = (useWatch({ control, name: p }) ?? {}) as LineForm;
  const intakeDate = useWatch({ control, name: "intakeDate" }) as string;
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [index]);
  const differs = num(line.documentQuantity) !== num(line.receivedQuantity);
  const issues = lineIssues(line, line.catalog ?? undefined, headFunding);
  const received = num(line.receivedQuantity);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Dòng {index + 1}: {line.name || line.catalog?.name}</DialogTitle>
          <DialogDescription>
            {[line.catalog?.code, line.catalog?.unit?.name, line.catalog?.trackingType === "BULK" ? "Theo số lượng" : "Từng cái"]
              .filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="@container grid gap-4">
          <div className="grid items-start gap-3 @lg:grid-cols-2">
            <TextField control={control} name={`${p}.name`} label="Tên trên chứng từ" placeholder="Trống = theo tên thiết bị" />
            <ReasonField control={control} name={`${p}.movementReason`} />
          </div>
          <div className="grid items-start gap-3 @lg:grid-cols-4">
            <IntField control={control} name={`${p}.documentQuantity`} label="SL hoá đơn" min={1} />
            <IntField control={control} name={`${p}.receivedQuantity`} label="SL thực nhận" min={0} />
            <FormField
              control={control}
              name={`${p}.unitPrice`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Đơn giá (đ)</FormLabel>
                  <FormControl>
                    <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-2">
              <span className="text-sm font-medium">Thành tiền</span>
              <span className="flex h-9 items-center text-sm font-medium tabular-nums">{formatVnd(amountOf(line))}</span>
            </div>
          </div>
          {differs ? (
            <TextField control={control} name={`${p}.varianceReason`} label="Lý do lệch số lượng"
              placeholder="Số thực nhận khác số trên hoá đơn, ghi lý do" />
          ) : null}
          <Outcome catalog={line.catalog} type={line.physicalOrDigital} intakeDate={intakeDate} received={received} />
          <RefField control={control} name={`${p}.room`} label="Vị trí nhận" resource="rooms" placeholder="Trống = nhập kho" />

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <StepTitle title="Chứng từ" />
            <Button type="button" variant="ghost" size="sm" disabled={count < 2}
              onClick={() => { onCopyToAll(); setCopied(true); }}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Đã chép cho mọi dòng" : "Chép chứng từ cho mọi dòng"}
            </Button>
          </div>
          <div className="grid items-start gap-3 @lg:grid-cols-3">
            <TextField control={control} name={`${p}.supplier`} label="Nhà cung cấp" placeholder="Trống = theo đầu phiếu" />
            <TextField control={control} name={`${p}.documentNo`} label="Số hoá đơn" placeholder="Trống = theo đầu phiếu" />
            <DateField control={control} name={`${p}.documentDate`} label="Ngày hoá đơn" />
            <SelectField control={control} name={`${p}.fundingSource`} label="Nguồn kinh phí" options={LINE_FUNDING_OPTIONS} />
            <IntField control={control} name={`${p}.warrantyMonths`} label="Bảo hành (tháng)" min={0} max={600} />
          </div>
          <div className="grid items-start gap-3 @lg:grid-cols-3">
            <TextField control={control} name={`${p}.model`} label="Model" />
            <TextField control={control} name={`${p}.manufacturer`} label="Hãng sản xuất" />
            <TextField control={control} name={`${p}.note`} label="Ghi chú" />
          </div>

          {issues.length ? (
            <div className="bg-warning/10 rounded-md px-3 py-2 text-sm">
              <p className="text-warning-text font-medium">Dòng này còn thiếu</p>
              <ul className="text-muted-foreground mt-1 list-disc pl-5">
                {issues.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => onIndex(index - 1)}>
              <ChevronLeft />
              Dòng trước
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={index >= count - 1} onClick={() => onIndex(index + 1)}>
              Dòng sau
              <ChevronRight />
            </Button>
          </div>
          <Button type="button" onClick={onClose}>Xong</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Khi duyệt sẽ sinh gì, và mã dự kiến của hồ sơ đầu (`GET /equipment/next-code`, không giữ số). */
function Outcome({ catalog, type, intakeDate, received }: {
  catalog: CatalogValue | undefined;
  type: string | undefined;
  intakeDate: string;
  received: number;
}) {
  const query: Record<string, string> = {};
  if (catalog?.id) query.catalogId = String(catalog.id);
  if (type) query.physicalOrDigital = type;
  if (intakeDate) query.receivedDate = intakeDate;
  const { result } = useCustom<{ code: string | null; reason: string | null }>({
    url: `${API_URL}/equipment/next-code`,
    method: "get",
    config: { query },
    queryOptions: { enabled: !!catalog?.id && received > 0, staleTime: 30_000 },
  });
  const next = customResult(result?.data, "code");
  return (
    <p className="bg-muted/50 rounded-md px-3 py-2 text-sm">
      {lineOutcome(catalog?.trackingType, received, catalog?.unit?.name)}
      {received > 0 && next?.code ? (
        <span className="text-muted-foreground"> · mã dự kiến từ <span className="text-foreground font-mono">{next.code}</span></span>
      ) : null}
      {received > 0 && next && !next.code && next.reason ? (
        <span className="text-warning-text block text-xs">{next.reason.charAt(0).toUpperCase() + next.reason.slice(1)}</span>
      ) : null}
    </p>
  );
}
