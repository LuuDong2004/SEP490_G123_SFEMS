import { useCustom, useList, useNotification } from "@refinedev/core";
import { Check, ChevronDown, CircleAlert, Download, FileSpreadsheet, ListPlus, Minus, PackageSearch, Plus, Trash2, Upload } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";

import { Link } from "react-router";

import { CatalogPickerDialog } from "./catalog-picker";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { API_URL } from "@/shared/api/constants";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { DateInput } from "@/shared/components/form/date-input";
import { FormHint, HelpHint } from "@/shared/components/form/help-hint";
import { MoneyInput } from "@/shared/components/form/money-input";
import { TextareaField } from "@/shared/components/form/simple-fields";
import { RefField } from "@/shared/components/catalog/ref-field";
import { customResult } from "@/shared/hooks/use-custom-result";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { dateRules, maxLengthOf, mergeRules, numberMax, numberRules, textError, textRules } from "@/shared/lib/field-rules";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SectionHead } from "./section-head";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { intakeLineOutcome, stockQuantityOf } from "@/domains/equipment-intake/types";
import { EMPTY_DOCUMENT, LineOwnDocumentFields } from "./line-documents";
import { isChemical, lineIssues, serialError, serialsOf } from "./readiness";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");

export const EMPTY_LINE = {
  catalog: { id: null },
  name: "",
  physicalOrDigital: "PHYSICAL",
  assetCategory: null,
  documentQuantity: 1,
  receivedQuantity: 1,
  varianceReason: "",
  unitPrice: null,
  // Model/hãng là của từng lô — KHÔNG chép từ dòng trước.
  model: null,
  manufacturer: null,
  /** Cấu hình, công suất, xuất xứ… — chữ tự do, chép xuống từng tài sản khi duyệt. */
  otherInfo: null,
  expiryDate: null,
  // Quy cách bao bì là của từng lô (lọ 100 ml lần này, chai 500 ml lần sau).
  packUnit: { id: null },
  packSize: null,
  room: { id: null },
  ...EMPTY_DOCUMENT,
  /** Chỉ trên form: dòng có hoá đơn riêng (khác đầu phiếu). */
  ownDocuments: false,
  /** Chỉ trên form: số nhận khác số trên hoá đơn. */
  differs: false,
  /** Chỉ trên form: số serial, mỗi dòng một số. */
  serialText: "",
};

/**
 * Cột của bảng dòng ở MÀN XEM (`show.tsx`): # · Thiết bị · Đơn giá · SL · Thành tiền · Đủ. Form lập phiếu dùng bảng
 * lưới riêng bên dưới.
 */
export const LINES_GRID =
  "grid grid-cols-[1.75rem_minmax(12rem,1fr)_7.5rem_5.5rem_8rem_3.25rem] items-center gap-x-5 [&>*]:min-w-0";

/**
 * Mã DM của một dòng phiếu — bấm là mở thiết bị đó trong Danh mục thiết bị (màn chi tiết, có định mức tối thiểu).
 * `newTab` trên form đang lập: không rời phiếu chưa lưu.
 */
export function CatalogCodeLink({ id, code, newTab }: { id: number; code?: string | null; newTab?: boolean }) {
  return (
    <Link to={`/equipment-catalogs/show/${id}`} title="Mở thiết bị trong Danh mục thiết bị"
      {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
      onClick={(e) => e.stopPropagation()}
      className="text-primary font-mono text-xs hover:underline">
      {code ?? `#${id}`}
    </Link>
  );
}

/** ✓ khi dòng đủ thông tin, ⚠N (rê chuột: còn thiếu gì) khi chưa. */
export function LineStatus({ issues }: { issues: string[] }) {
  if (!issues.length) {
    return (
      <span className="flex justify-center" aria-label="Dòng đã đủ thông tin">
        <Check className="text-success-text size-4" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex justify-center">
          <Badge variant="warning" className="gap-0.5 px-1.5 tabular-nums">
            <CircleAlert className="size-3" />
            {issues.length}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="space-y-0.5">
          {issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/** Dòng phải có thiết bị, và nhận khác hoá đơn phải có lý do — CSDL giữ cả hai, nên lưu nháp cũng phải đủ. */
export function lineSaveProblem(line: any): string | null {
  if (!line?.catalog?.id) return "Chưa chọn thiết bị";
  if (line.differs && Number(line.documentQuantity ?? 0) !== Number(line.receivedQuantity ?? 0) && !String(line.varianceReason ?? "").trim()) {
    return "Nhận khác hoá đơn, phải ghi lý do";
  }
  if (line.receivedQuantity == null || Number(line.receivedQuantity) < 0) return "Số lượng không hợp lệ";
  return null;
}

// ------------------------------------------------------------------ mã dự kiến

/** Mã tài sản dự kiến của một dòng — hỏi máy chủ mã KẾ TIẾP của bộ đếm (không tăng bộ đếm). */
function useCodePreview(catalogId: unknown, schoolId: number | null, physicalOrDigital: unknown, intakeDate: unknown) {
  const query: Record<string, string> = {};
  if (catalogId) query.catalogId = String(catalogId);
  if (schoolId) query.schoolId = String(schoolId);
  if (physicalOrDigital) query.physicalOrDigital = String(physicalOrDigital);
  if (intakeDate) query.receivedDate = String(intakeDate);
  const { result } = useCustom<{ code: string | null; reason: string | null }>({
    url: `${API_URL}/equipment/next-code`,
    method: "get",
    config: { query },
    queryOptions: { enabled: !!catalogId && !!schoolId, staleTime: 30_000, retry: false },
  });
  return customResult(result?.data, "code");
}

/** `79.T6.08.TB.007.26` → bộ đếm `79.T6.08.TB.26` và số thứ tự 7. */
function splitCode(code: string): { counter: string; seq: number } | null {
  const parts = code.split(".");
  if (parts.length !== 6 || !/^\d{3}$/.test(parts[4])) return null;
  return { counter: [...parts.slice(0, 4), parts[5]].join("."), seq: Number(parts[4]) };
}

function withSeq(code: string, seq: number) {
  const parts = code.split(".");
  parts[4] = String(seq).padStart(3, "0");
  return parts.join(".");
}

/** Mã dự kiến, TÔ MÀU phần số thứ tự 3 chữ số (phần thứ 5 của mã) — thấy ngay máy này mang STT mấy. */
function SeqCode({ code }: { code: string }) {
  const parts = code.split(".");
  if (parts.length < 6) return <>{code}</>;
  return (
    <>
      {parts.slice(0, 4).join(".")}.
      <span className="text-primary font-semibold">{parts[4]}</span>
      .{parts.slice(5).join(".")}
    </>
  );
}

type Preview = { counter: string | null; code: string | null; reason: string | null };

// ------------------------------------------------------------------ ô trong bảng

/** Ô trong DÒNG của bảng không có khung: khung chỉ hiện khi rê chuột hoặc đang gõ; ô sai thì viền đỏ luôn. */
const CELL_INPUT =
  "h-8 border-transparent bg-transparent shadow-none hover:border-input hover:bg-field focus-visible:border-ring focus-visible:bg-card " +
  "aria-invalid:border-destructive aria-invalid:bg-destructive-subtle " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function IntInput({ value, onChange, className, ...rest }: {
  value: unknown;
  onChange: (v: number | null) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Input {...rest} inputMode="numeric" className={cn("text-right tabular-nums", className)}
      value={value == null || value === "" ? "" : String(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? null : Number(digits));
      }} />
  );
}

/** Ô số thập phân (quy cách bao bì). */
function DecimalInput({ value, onChange, ...rest }: {
  value: unknown;
  onChange: (v: number | null) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Input {...rest} type="number" inputMode="decimal" step="any" className={cn("text-right tabular-nums", rest.className)}
      value={value == null || value === "" ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
  );
}

type Room = { id: number; name: string; roomType?: { code?: string } | null };

/** Kho của trường: phòng loại KHO — cùng quy tắc `isStoreroom` ở máy chủ; không có mã loại thì theo tên. */
export function storeroomOf(rooms: Room[]): Room | undefined {
  return rooms.find((r) => r.roomType?.code === "KHO") ?? rooms.find((r) => /(^|\s)kho(\s|$)/i.test(r.name ?? ""));
}

const NO_ROOM = "__store__";

function RoomCell({ value, onChange, rooms, label }: { value: any; onChange: (v: { id: number | null }) => void; rooms: Room[]; label: string }) {
  const id = value?.id ? String(value.id) : "";
  const options = [
    ...(id && !rooms.some((r) => String(r.id) === id) ? [{ id: Number(id), name: value?.name ?? "…" }] : []),
    ...rooms,
  ];
  return (
    <Select value={id || NO_ROOM} onValueChange={(v) => { if (v) onChange({ id: v === NO_ROOM ? null : Number(v) }); }}>
      <SelectTrigger size="sm" aria-label={label} className="bg-surface-subtle h-8 w-full rounded-full border-transparent shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {!storeroomOf(rooms) ? <SelectItem value={NO_ROOM}>Kho thiết bị</SelectItem> : null}
        {options.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ------------------------------------------------------------------ hàng công cụ: chọn từ danh mục, nhập Excel

type Added = { catalog: PickedCatalog; quantity?: number; unitPrice?: number | null; model?: string | null; manufacturer?: string | null; otherInfo?: string | null };

/** Bỏ dấu, chữ thường — so mã / tên dán từ Excel. */
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().trim();

/**
 * Hàng công cụ đầu bảng: "Chọn từ danh mục" và "Nhập Excel" (chọn tệp theo mẫu / tải tệp mẫu). Không có ô tìm (trưởng
 * nhóm 13/11/2026: không cần — hộp chọn danh mục đã có tìm). Thông tin phiếu chưa khai xong (`locked` là lý do) thì
 * chưa thêm thiết bị được: dòng thiết bị đọc nguồn hình thành, nguồn kinh phí của phiếu — chỉ còn tải tệp mẫu.
 */
function LinesToolbar({ onAdd, onBrowse, locked }: { onAdd: (rows: Added[]) => void; onBrowse: () => void; locked?: string }) {
  const [pasting, setPasting] = useState(false);
  const { open: notify } = useNotification();

  /** Mỗi dòng của tệp Excel [Mã DM, Số lượng, Đơn giá], khớp mã với danh mục. */
  async function addRows(rows: string[][], from: string) {
    setPasting(true);
    const added: Added[] = [];
    const missing: string[] = [];
    for (const [key, qty, price, model, maker, info] of rows) {
      try {
        const found = await kyInstance.get("equipment_catalogs", {
          searchParams: { code: key, active: "true", _start: "0", _end: "1" },
        }).json<PickedCatalog[]>();
        const row = Array.isArray(found) ? found.find((c) => plain(String(c.code ?? "")) === plain(key)) : undefined;
        if (!row) {
          missing.push(key);
          continue;
        }
        const q = Number(String(qty ?? "").replace(/\D/g, ""));
        const p = String(price ?? "").replace(/\D/g, "");
        added.push({ catalog: row, quantity: q > 0 ? q : 1, unitPrice: p ? Number(p) : undefined,
          model: String(model ?? "").trim() || null, manufacturer: String(maker ?? "").trim() || null, otherInfo: String(info ?? "").trim() || null });
      } catch {
        missing.push(key);
      }
    }
    setPasting(false);
    if (added.length) onAdd(added);
    notify?.({
      type: missing.length ? "error" : "success",
      message: `Đã thêm ${added.length} thiết bị từ ${from}`,
      description: missing.length ? `Không tìm thấy mã: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}` : undefined,
    });
  }

  const fileInput = useRef<HTMLInputElement>(null);
  /** Nhập tệp Excel theo mẫu: máy chủ chỉ đọc tệp, form khớp mã như khi dán. */
  async function importFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    setPasting(true);
    try {
      const lines = await kyInstance.post("equipment_intakes/lines-file", { body: form, timeout: DOWNLOAD_TIMEOUT })
        .json<{ code: string; quantity: string; unitPrice: string; model: string | null; manufacturer: string | null; otherInfo: string | null }[]>();
      await addRows(lines.map((l) => [l.code, l.quantity, l.unitPrice, l.model ?? "", l.manufacturer ?? "", l.otherInfo ?? ""]), `tệp ${file.name}`);
    } catch (error) {
      setPasting(false);
      notify?.({ type: "error", message: "Không nhập được tệp Excel", description: await errorMessage(error) });
    }
  }
  async function downloadTemplate() {
    try {
      const blob = await kyInstance.get("equipment_intakes/lines-template", { timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Tên tệp kèm ngày tải (dd-MM-yyyy — tên tệp Windows không nhận "/"), cùng kiểu báo cáo thiết bị tối thiểu.
      const t = new Date();
      const p2 = (n: number) => String(n).padStart(2, "0");
      a.download = `Mẫu thiết bị phiếu ghi tăng - ${p2(t.getDate())}-${p2(t.getMonth() + 1)}-${t.getFullYear()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.({ type: "error", message: "Không tải được tệp mẫu", description: await errorMessage(error) });
    }
  }

  return (
    // `data-field`: mục "Thêm ít nhất một thiết bị" của "Trước khi trình" đưa con trỏ tới nút đầu tiên ở đây.
    <div className="flex flex-wrap items-center justify-end gap-2" data-field="catalog-search">
      {locked ? <span className="text-muted-foreground me-1 text-xs">{locked}</span> : null}
      <Button type="button" variant="outline" className="h-9" onClick={onBrowse} disabled={!!locked || pasting}>
        <ListPlus />
        Chọn từ danh mục
      </Button>
      <input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-9" disabled={pasting}>
            <FileSpreadsheet />
            Nhập Excel
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Chưa khai xong thông tin phiếu: chỉ còn tải tệp mẫu (soạn trước được), chưa nhập được. */}
          {locked ? null : (
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <Upload />
              Chọn tệp Excel…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void downloadTemplate()}>
            <Download />
            Tải tệp mẫu
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ------------------------------------------------------------------ một dòng

const COLS = 10;

/**
 * Một dòng của bảng lưới: số lượng, đơn giá, phòng nhận gõ thẳng tại chỗ; ⌄ mở ngay dưới dòng phần chi tiết (model,
 * hãng, bảo hành, hạn dùng / quy cách của vật tư, số serial, nhận khác hoá đơn, hoá đơn riêng).
 */
function LineRow({ control, path, index, catalog, rooms, schoolId, issues, expanded, onToggle, onRemove, onSplit, separate, preview, offset, onPreview }: {
  control: Control<any>;
  path: string;
  index: number;
  catalog: any;
  rooms: Room[];
  schoolId: number | null;
  issues: string[];
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSplit: (positions: number[]) => void;
  /** Phần khai riêng của một thiết bị đã có ở mục trên (cùng mã DM). */
  separate?: boolean;
  preview: Preview | undefined;
  offset: number;
  onPreview: (p: Preview) => void;
}) {
  const { setValue, getValues } = useFormContext();
  const line = useWatch({ control, name: path }) as any;
  const intakeDate = useWatch({ control, name: "intakeDate" });
  const next = useCodePreview(line?.catalog?.id, schoolId, line?.physicalOrDigital, intakeDate);
  const code = next?.code ?? null;
  const reason = next?.reason ?? null;
  const counter = code ? (splitCode(code)?.counter ?? null) : null;
  useEffect(() => onPreview({ counter, code, reason }), [counter, code, reason, onPreview]);

  const tracking: string | undefined = catalog?.trackingType;
  const received = Number(line?.receivedQuantity ?? 0);
  const amount = line?.unitPrice == null || line?.unitPrice === "" ? null : Number(line.unitPrice) * received;
  const serialBad = tracking === "serial" && !!serialError(line);
  const serialCount = serialsOf(line).length;
  const name = line?.name || catalog?.name;
  const unitName = line?.packUnit?.id ? (line.packUnit.name ?? catalog?.unit?.name) : catalog?.unit?.name;

  return (
    <>
      {/* Dòng đang mở và phần chi tiết của nó là MỘT khối: chung nền xanh nhạt. */}
      <TableRow data-row={index} className={cn("hover:bg-muted/30", expanded && "bg-info-subtle hover:bg-info-subtle border-b-0")}>
        <TableCell className="text-muted-foreground text-center tabular-nums">{index + 1}</TableCell>
        <TableCell className="truncate">
          {/* Mã DM bấm được: mở thiết bị trong Danh mục — ở THẺ MỚI, để không rời phiếu đang lập dở. */}
          {catalog?.id ? (
            <CatalogCodeLink id={catalog.id} code={catalog.code} newTab />
          ) : <span className="text-muted-foreground font-mono text-xs">…</span>}
        </TableCell>
        <TableCell className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate font-medium" title={name}>{name || (line?.catalog?.id ? "Đang tải…" : "Chưa chọn thiết bị")}</span>
            {separate ? <Badge variant="secondary" className="shrink-0" title="Cùng thiết bị với mục trên, khai riêng model, hãng, đơn giá">khai riêng · {received} {catalog?.unit?.name ?? "cái"}</Badge> : null}
            {line?.differs && Number(line.documentQuantity ?? 0) !== received ? (
              <Badge variant="warning" className="shrink-0 px-1.5 tabular-nums" title="Số lượng trên hoá đơn">HĐ {line.documentQuantity ?? 0}</Badge>
            ) : null}
            {issues.length ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="shrink-0" aria-label={`Dòng ${index + 1} còn ${issues.length} chỗ cần sửa`} onClick={onToggle}>
                    <CircleAlert className="text-warning-text size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <ul className="space-y-0.5">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="p-1">
          <FormField
            control={control}
            name={`${path}.receivedQuantity`}
            rules={mergeRules(numberRules(line?.differs ? "QUANTITY_OR_ZERO" : "QUANTITY", "Số lượng"), { required: "Nhập số lượng" })}
            render={({ field, fieldState }) => (
              <IntInput value={field.value} name={field.name} onBlur={field.onBlur} aria-label={`Số lượng dòng ${index + 1}`}
                aria-invalid={!!fieldState.error || undefined} title={fieldState.error?.message} className={CELL_INPUT}
                onChange={(v) => {
                  // Chưa khai "nhận khác hoá đơn" thì số trên hoá đơn đi theo — đa số dòng hai số bằng nhau.
                  if (!getValues(`${path}.differs`)) setValue(`${path}.documentQuantity`, v, { shouldDirty: true });
                  field.onChange(v);
                }} />
            )}
          />
        </TableCell>
        <TableCell className="text-muted-foreground truncate" title={unitName ?? undefined}>{unitName ?? ""}</TableCell>
        <TableCell className="p-1">
          <FormField
            control={control}
            name={`${path}.unitPrice`}
            rules={numberRules("UNIT_PRICE", "Đơn giá")}
            render={({ field, fieldState }) => (
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="0"
                maxValue={numberMax("UNIT_PRICE")}
                aria-label={`Đơn giá dòng ${index + 1}`} aria-invalid={!!fieldState.error || undefined} title={fieldState.error?.message}
                className={cn(CELL_INPUT, "text-right")} />
            )}
          />
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">
          {amount != null && amount > 0 ? money.format(amount) : <span className="text-muted-foreground text-xs font-normal">Nhập đơn giá</span>}
        </TableCell>
        <TableCell className="p-1">
          <RoomCell value={line?.room} rooms={rooms} label={`Nhận vào, dòng ${index + 1}`}
            onChange={(v) => setValue(`${path}.room`, v, { shouldDirty: true })} />
        </TableCell>
        {/* Cột "Chi tiết" (trưởng nhóm 13/11/2026): MỘT nút — tóm tắt điều cần biết của dòng và mũi tên sát bên — mở phần
            chi tiết (model, hãng, bảo hành, serial từng máy / hạn dùng, nhận khác hoá đơn, hoá đơn riêng). */}
        <TableCell className="p-1">
          <button type="button" onClick={onToggle} aria-expanded={expanded}
            title={tracking === "serial" ? `${serialCount}/${received} máy đã có serial — bấm để xem chi tiết` : "Model, hãng, bảo hành, nhận khác hoá đơn, hoá đơn riêng"}
            className={cn("hover:bg-muted ms-auto flex h-8 max-w-full items-center gap-1 rounded-md px-2 text-xs tabular-nums",
              serialBad ? "text-warning-text font-medium" : "text-muted-foreground")}>
            <span className="truncate">
              {tracking === "serial" ? `${serialCount}/${received}`
                : tracking === "bulk" ? (line?.expiryDate ? `HSD ${formatPlainDate(line.expiryDate)}` : "Theo lô") : "Chi tiết"}
            </span>
            <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-180")} />
          </button>
        </TableCell>
        <TableCell className="p-1 text-right whitespace-nowrap">
          <Button type="button" variant="ghost" size="icon" className="hover:text-destructive size-8" onClick={onRemove} title="Xoá dòng">
            <Trash2 />
          </Button>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-info-subtle hover:bg-info-subtle">
          <TableCell colSpan={COLS} className="px-4 pt-2 pb-5 whitespace-normal">
            <LineDetail control={control} path={path} line={line} catalog={catalog} preview={preview} offset={offset} onSplit={onSplit} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Phần mở ngay dưới dòng. */
function LineDetail({ control, path, line, catalog, preview, offset, onSplit }: {
  control: Control<any>;
  path: string;
  line: any;
  catalog: any;
  preview: Preview | undefined;
  offset: number;
  onSplit: (positions: number[]) => void;
}) {
  const { setValue, getValues } = useFormContext();
  const [more, setMore] = useState(() => !!(line?.model || line?.manufacturer || line?.otherInfo));
  const tracking: string | undefined = catalog?.trackingType;
  const received = Number(line?.receivedQuantity ?? 0);
  const unitCount = tracking === "bulk" ? Math.min(received, 1) : received;
  const toggleRow = (on: boolean, label: string, hint: string | null, onChange: (on: boolean) => void) => (
    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-medium">
      <Switch checked={on} onCheckedChange={onChange} />
      {label}
      {hint ? <span className="text-muted-foreground font-normal">{hint}</span> : null}
    </label>
  );
  return (
    // Hai cột (mẫu chốt 13/11/2026): trái là thông tin chung của LÔ, phải là TỪNG thiết bị sẽ sinh ra — mỗi máy một
    // mã dự kiến, một serial; dòng theo lô chỉ một mã chung.
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <section className="bg-card grid gap-4 rounded-lg border px-4 pt-3 pb-4">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Thông tin chung của lô</h4>
        </div>
        <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-2">
          <FormField
            control={control}
            name={`${path}.warrantyMonths`}
            rules={numberRules("COUNT", "Bảo hành (tháng)")}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bảo hành</FormLabel>
                <div className="relative">
                  <FormControl>
                    <IntInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
                      placeholder="Không bắt buộc" className="pe-14 text-left" />
                  </FormControl>
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">tháng</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {tracking === "bulk" ? (
            <>
              <FormField
                control={control}
                name={`${path}.expiryDate`}
                rules={dateRules("ANY", "Hạn sử dụng")}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={isChemical(line, catalog) || undefined}>Hạn sử dụng</FormLabel>
                    <FormControl>
                      <DateInput className="max-w-none" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PackField control={control} path={path} line={line} catalog={catalog} />
            </>
          ) : null}
        </div>
        {/* Model, hãng, thông tin khác: không tài liệu nào (BCKTKT, HSMT) đòi — thu gọn mặc định, dòng đã có thì mở sẵn
            (phương án A, trưởng nhóm 14/11/2026). Bảo hành luôn hiện: BCKTKT §2.3.2 có nêu. */}
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
          className="text-primary flex w-fit items-center gap-1.5 text-sm font-medium hover:underline">
          {more ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
          Model, hãng, thông tin khác
          {more ? null : <span className="text-muted-foreground font-normal">(không bắt buộc)</span>}
        </button>
        {more ? (
          <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-2">
            <FormField
              control={control}
              name={`${path}.model`}
              rules={textRules("SHORT_TEXT", "Model", { max: 50 })}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref}
                      maxLength={50} placeholder="Không bắt buộc" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${path}.manufacturer`}
              rules={textRules("SHORT_TEXT", "Hãng sản xuất", { max: 100 })}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hãng sản xuất</FormLabel>
                  <FormControl>
                    <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref}
                      maxLength={100} placeholder="Không bắt buộc" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextareaField control={control} name={`${path}.otherInfo`} label="Thông tin khác" rule="NOTE" rows={2} inGrid
              className="sm:col-span-2" placeholder="Ghi thêm nếu cần: kích cỡ, chất liệu, cấu hình…" />
          </div>
        ) : null}

        <div className="grid gap-3 border-t pt-3">
          {toggleRow(!!line?.differs, "Số nhận khác số trên hoá đơn", null, (on) => {
            setValue(`${path}.differs`, on, { shouldDirty: true });
            if (!on) {
              setValue(`${path}.documentQuantity`, getValues(`${path}.receivedQuantity`), { shouldDirty: true });
              setValue(`${path}.varianceReason`, "", { shouldDirty: true });
            }
          })}
          {line?.differs ? (
            <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <FormField
                control={control}
                name={`${path}.documentQuantity`}
                rules={mergeRules(numberRules("QUANTITY", "Số trên hoá đơn"), { required: "Nhập số trên hoá đơn", deps: [`${path}.varianceReason`] })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số trên hoá đơn</FormLabel>
                    <FormControl>
                      <IntInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`${path}.varianceReason`}
                rules={mergeRules(textRules("NOTE", "Lý do", { max: 255, min: 5 }), {
                  validate: {
                    needed: (v: unknown, values: any) => {
                      const l = pathValue(values, path);
                      return Number(l?.documentQuantity ?? 0) === Number(l?.receivedQuantity ?? 0) || !!String(v ?? "").trim() || "Ghi lý do nhận khác hoá đơn";
                    },
                  },
                })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={Number(line?.documentQuantity ?? 0) !== received || undefined}>Lý do</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                        maxLength={maxLengthOf("NOTE", 255)} placeholder="VD: giao thiếu 2 cái, hẹn giao bù" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
          {toggleRow(!!line?.ownDocuments, "Hoá đơn riêng", "khác hoá đơn ở đầu phiếu", (on) => setValue(`${path}.ownDocuments`, on, { shouldDirty: true }))}
          {line?.ownDocuments ? <LineOwnDocumentFields control={control} path={path} lineId={line?.id} /> : null}
        </div>
      </section>

      <UnitsPanel control={control} path={path} tracking={tracking} count={unitCount} received={received}
        outcome={intakeLineOutcome(tracking, stockQuantityOf(received, line?.packUnit?.id ? line?.packSize : null), line?.packUnit?.id && line?.packSize ? catalog?.unit?.name : undefined)}
        code={preview?.code ?? null} reason={line?.catalog?.id ? preview?.reason ?? null : null} offset={offset} onSplit={onSplit} />
    </div>
  );
}

/**
 * Cột phải của chi tiết dòng: TỪNG thiết bị sẽ sinh ra lúc duyệt — mỗi máy một hàng, mã dự kiến của chính máy đó và
 * ô serial của nó (lưu theo VỊ TRÍ: máy 2 để trống thì máy 3 vẫn mang đúng số của nó). Dán một cột serial từ Excel
 * vào ô nào thì điền từ máy đó trở xuống. Dòng theo lô: một mã chung, không serial.
 */
function UnitsPanel({ control, path, tracking, count, received, outcome, code, reason, offset, onSplit }: {
  control: Control<any>;
  path: string;
  tracking: string | undefined;
  count: number;
  received: number;
  outcome: string;
  code: string | null;
  reason: string | null;
  offset: number;
  onSplit: (positions: number[]) => void;
}) {
  const { setValue } = useFormContext();
  // Khai riêng (thay "Tách dòng", trưởng nhóm 14/11/2026): đánh dấu những cái khác model / hãng / đơn giá rồi bấm
  // nút ở thanh dưới — chúng thành một mục riêng ngay dưới, serial đã nhập đi theo đúng cái đó.
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const canPick = received >= 2;
  const toggle = (i: number) => setPicked((prev) => { const next = new Set(prev); if (!next.delete(i)) next.add(i); return next; });
  const chosen = [...picked].filter((i) => i < received).sort((a, b) => a - b);
  const text = useWatch({ control, name: `${path}.serialText` }) as string | undefined;
  const slots = String(text ?? "").split(/\r?\n/);
  const serial = tracking === "serial";
  const filled = serial ? slots.slice(0, received).filter((s) => s.trim()).length : 0;
  const split = code ? splitCode(code) : null;
  const first = split ? split.seq + offset : null;
  const write = (next: string[]) => {
    const list = [...next];
    while (list.length && !list[list.length - 1].trim()) list.pop();
    setValue(`${path}.serialText`, list.join("\n"), { shouldDirty: true, shouldValidate: true });
  };
  const setAt = (i: number, v: string) => {
    const next = Array.from({ length: Math.max(slots.length, i + 1) }, (_, k) => slots[k] ?? "");
    next[i] = v.replace(/\s+/g, "").toUpperCase();
    write(next);
  };
  const pasteAt = (i: number, raw: string) => {
    const values = raw.split(/\r?\n/).map((s) => s.trim()).filter((s, k, arr) => s || k < arr.length - 1);
    const next = Array.from({ length: Math.max(slots.length, i + values.length) }, (_, k) => slots[k] ?? "");
    values.forEach((v, k) => { if (i + k < received) next[i + k] = v.replace(/\s+/g, "").toUpperCase(); });
    write(next);
  };
  // Vì sao số thứ tự bắt đầu từ số này — một câu: số thiết bị đã có cùng bộ mã (và phần các dòng trên đã chiếm).
  const pad = (n: number) => String(n).padStart(3, "0");
  const why = split && first != null
    ? (split.seq > 1 ? `Đã có ${split.seq - 1} thiết bị cùng loại` : "Chưa có thiết bị nào cùng loại")
      + (offset ? `, dòng trên dùng ${offset} số` : "") + ` và STT sẽ bắt đầu là ${pad(first)}`
    : "Mã sinh tự động sau khi duyệt";
  // Lỗi của TỪNG ô serial — cùng luật máy chủ: 3–50 ký tự kiểu SERIAL, không trùng máy khác trong dòng.
  const slotError = (i: number) => {
    const v = (slots[i] ?? "").trim();
    if (!v) return undefined;
    const e = textError("SERIAL", "Serial", v, undefined, 3);
    if (e) return e;
    return slots.findIndex((x) => x.trim() === v) !== i ? `Trùng serial máy ${slots.findIndex((x) => x.trim() === v) + 1}` : undefined;
  };
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2.5">
        <h4 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          {serial ? `Từng thiết bị sẽ sinh ra · ${received} cái` : "Khi duyệt"}
        </h4>
        {serial && received > 0 ? (
          <>
            <span className="text-muted-foreground text-xs tabular-nums">{filled}/{received} có serial</span>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={async () => {
                try {
                  pasteAt(0, await navigator.clipboard.readText());
                } catch {
                  // Trình duyệt không cho đọc bộ nhớ tạm: dán thẳng (Ctrl+V) vào ô của máy đầu tiên cũng được.
                }
              }}>
              Dán cột serial từ Excel
            </Button>
          </>
        ) : null}
      </div>
      {serial && received > 0 ? (
        <div className="max-h-72 overflow-y-auto border-t [scrollbar-width:thin]">
          <div className={cn("bg-surface-subtle text-muted-foreground sticky top-0 z-10 grid items-center border-b px-4 py-1.5 text-xs font-semibold", canPick ? "grid-cols-[1.75rem_2.5rem_12rem_minmax(0,1fr)]" : "grid-cols-[2.5rem_12rem_minmax(0,1fr)]")}>
            {canPick ? (
              <Checkbox aria-label="Chọn tất cả" checked={chosen.length === received ? true : chosen.length ? "indeterminate" : false}
                onCheckedChange={(v) => setPicked(v === true ? new Set(Array.from({ length: received }, (_, i) => i)) : new Set())} />
            ) : null}
            <span>#</span>
            <span className="flex items-center gap-1">Mã dự kiến <HelpHint>{why}</HelpHint></span>
            <span>Số serial</span>
          </div>
          {Array.from({ length: received }, (_, i) => (
            <div key={i} className={cn("grid items-center border-b px-4 py-0.5 last:border-b-0", canPick ? "grid-cols-[1.75rem_2.5rem_12rem_minmax(0,1fr)]" : "grid-cols-[2.5rem_12rem_minmax(0,1fr)]", picked.has(i) && "bg-info-subtle")}>
              {canPick ? <Checkbox aria-label={`Chọn thiết bị ${i + 1}`} checked={picked.has(i)} onCheckedChange={() => toggle(i)} /> : null}
              <span className="text-muted-foreground text-sm tabular-nums">{i + 1}</span>
              <span className="truncate font-mono text-xs">
                {split && first != null && first + i <= 999 ? <SeqCode code={withSeq(code!, first + i)} /> : reason ? <span className="text-warning-text font-sans">—</span> : "…"}
              </span>
              <Input value={slots[i] ?? ""} aria-label={`Số serial thiết bị ${i + 1}`} placeholder="Nhập serial" maxLength={50}
                aria-invalid={!!slotError(i) || undefined} title={slotError(i)}
                className={cn(CELL_INPUT, "font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case")}
                onChange={(e) => setAt(i, e.target.value)}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (!/\r?\n/.test(t.trim())) return;
                  e.preventDefault();
                  pasteAt(i, t);
                }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground grid gap-1 border-t px-4 py-3 text-sm">
          <span>{outcome}</span>
          {split && first != null && count > 0 ? (
            <span className="text-xs" title={why}>Mã dự kiến <span className="text-foreground font-mono"><SeqCode code={withSeq(code!, first)} /></span> <HelpHint>{why}</HelpHint></span>
          ) : reason ? <span className="text-warning-text text-xs">{reason}</span> : null}
        </div>
      )}
      <FormField control={control} name={`${path}.serialText`}
        rules={{ validate: (_v: unknown, values: any) => serialError(pathValue(values, path)) ?? true }}
        render={() => <FormItem className="px-4 empty:hidden [&:not(:has(p))]:hidden"><FormMessage /></FormItem>} />
      {chosen.length ? (
        <div className="bg-foreground text-background flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
          <span className="flex-1">Đã chọn {chosen.length} cái</span>
          <button type="button" className="opacity-80 hover:underline" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
          <Button type="button" size="sm" variant="secondary" className="h-8" disabled={chosen.length >= received}
            title={chosen.length >= received ? "Phải để lại ít nhất một cái" : "Những cái đã chọn thành một mục riêng ngay dưới, khai model, hãng, đơn giá khác"}
            onClick={() => { onSplit(chosen); setPicked(new Set()); }}>
            Khai riêng model, giá cho {chosen.length} cái này
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** `values.lines.3` theo đường dẫn "lines.3". */
function pathValue(values: any, path: string) {
  return path.split(".").reduce((v, k) => v?.[k], values);
}

/**
 * Quy cách bao bì của vật tư, hoá chất (QLTB-501): "1 [Lọ] = [100] ml". Hoá chất mua theo lọ nhưng dùng theo ml, gam —
 * khai quy cách thì SL và đơn giá của dòng tính theo LỌ, còn lô vào sổ mang số đã quy đổi. Bỏ chọn đơn vị bao bì là
 * không quy đổi.
 */
function PackField({ control, path, line, catalog }: { control: Control<any>; path: string; line: any; catalog: any }) {
  const { setValue } = useFormContext();
  const baseUnit: string = catalog?.unit?.name ?? "đơn vị tính";
  const hasPack = Boolean(line?.packUnit?.id);
  const size = line?.packSize == null || line?.packSize === "" ? null : Number(line.packSize);
  const received = Number(line?.receivedQuantity ?? 0);
  const hadPack = useRef(hasPack);
  useEffect(() => {
    if (hadPack.current && !hasPack && line?.packSize != null) setValue(`${path}.packSize`, null, { shouldDirty: true });
    hadPack.current = hasPack;
  }, [hasPack, line?.packSize, path, setValue]);
  return (
    <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
      <span className="flex min-h-5 items-center gap-1 text-sm font-medium">
        Quy cách
        <FormHint>{`Mua theo lọ, chai, hộp… thì khai một bao bì chứa bao nhiêu ${baseUnit}. Số lượng và đơn giá khi đó tính theo bao bì; hệ thống ghi theo ${baseUnit} để xuất dùng lẻ được.`}</FormHint>
      </span>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_7rem_auto_minmax(0,1fr)] items-center gap-2">
        <span className="text-muted-foreground text-sm">1</span>
        <RefField control={control} name={`${path}.packUnit`} resource="units" label="Đơn vị bao bì" hideLabel
          placeholder="Không quy đổi" current={line?.packUnit?.id ? line.packUnit : undefined}
          filters={[{ field: "allowsFraction", operator: "eq", value: false }]} />
        <span className="text-muted-foreground text-sm">=</span>
        <FormField
          control={control}
          name={`${path}.packSize`}
          rules={numberRules("DECIMAL_QUANTITY", "Quy cách")}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DecimalInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder={hasPack ? "Bắt buộc" : "—"} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <span className="text-muted-foreground max-w-24 truncate text-sm">{baseUnit}</span>
        <span className="text-muted-foreground truncate text-right text-sm tabular-nums">
          {hasPack && size ? `= ${stockQuantityOf(received, size).toLocaleString("vi-VN")} ${baseUnit} vào hệ thống` : null}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ cả bảng

/**
 * Bảng "Danh sách thiết bị ghi tăng" của phiếu ghi tăng: nút chọn từ danh mục / nhập Excel ở đầu bảng, bảng lưới một dòng một thiết bị,
 * chân bảng là số thiết bị, số đơn vị và tổng tiền.
 *
 * @param reveal dòng mà khối "Trước khi trình" muốn mở ({@code at} đổi mỗi lần bấm, để bấm lại vẫn mở)
 */
export function IntakeLinesEditor({ control, catalogs, reveal, headFunding, name = "lines", open = true, onToggle, locked }: {
  control: Control<any>;
  /** Khối đang mở (form phiếu cho thu gọn); thu gọn thì chỉ còn tên khối và số thiết bị, tổng tiền. */
  open?: boolean;
  onToggle?: () => void;
  catalogs: Map<number, any>;
  reveal: { index: number; at: number } | null;
  headFunding?: string | null;
  name?: string;
  /** Thông tin phiếu chưa khai xong — lý do, hiện cạnh nút; khi đó chưa thêm thiết bị được. */
  locked?: string;
}) {
  const config = useVoucherForm("equipment_intakes");
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = useOriginRules().ruleOf(originId);
  const { setValue, getValues } = useFormContext();
  const { fields, append, insert, remove } = useFieldArray({
    control,
    name,
    rules: {
      validate: (rows: any[]) => {
        const bad = (rows ?? []).findIndex((l) => lineSaveProblem(l));
        return bad < 0 || `Dòng ${bad + 1}: ${lineSaveProblem(rows[bad])}`;
      },
    },
  });
  const schoolId = (useWatch({ control, name: "school.id" }) as number | null | undefined) ?? null;
  const lines = (useWatch({ control, name }) ?? []) as any[];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [browsing, setBrowsing] = useState(false);

  const { result: roomList } = useList<Room>({
    resource: "rooms",
    pagination: { currentPage: 1, pageSize: 200 },
    filters: [
      ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
      { field: "active", operator: "eq", value: true },
    ],
    sorters: [{ field: "name", order: "asc" }],
  });
  const rooms = (roomList?.data ?? []) as Room[];
  const store = storeroomOf(rooms);

  // Khối "Trước khi trình" bấm vào một dòng: mở dòng đó và cuộn tới.
  useEffect(() => {
    if (!reveal || !fields[reveal.index]) return;
    const id = fields[reveal.index].id;
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    requestAnimationFrame(() => document.querySelector(`[data-row="${reveal.index}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // Mã dự kiến của từng dòng (theo id ổn định của dòng), để dòng sau nối số tiếp dòng trước.
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const reporters = useRef(new Map<string, (p: Preview) => void>());
  const reporter = (key: string) => {
    let fn = reporters.current.get(key);
    if (!fn) {
      fn = (p) => setPreviews((prev) => {
        const old = prev[key];
        return old && old.code === p.code && old.reason === p.reason && old.counter === p.counter ? prev : { ...prev, [key]: p };
      });
      reporters.current.set(key, fn);
    }
    return fn;
  };
  const offsetOf = (index: number) => {
    const mine = previews[fields[index]?.id]?.counter;
    if (!mine) return 0;
    return fields.slice(0, index).reduce((sum, f, j) => {
      if (previews[f.id]?.counter !== mine) return sum;
      const q = Number(lines[j]?.receivedQuantity ?? 0);
      return sum + (catalogs.get(Number(lines[j]?.catalog?.id))?.trackingType === "bulk" ? Math.min(q, 1) : q);
    }, 0);
  };

  /**
   * Khai riêng: những cái ĐÃ CHỌN thành một mục mới ngay dưới, cùng mã DM — chép model, hãng, đơn giá, chứng từ, nơi
   * nhận để sửa phần khác; serial đi theo đúng cái đó. Số trên hoá đơn: mục mới bằng số khai riêng, mục cũ bớt đi.
   */
  const [opening, setOpening] = useState<number | null>(null);
  const split = (index: number, positions: number[]) => {
    const l = getValues(`${name}.${index}`) as any;
    const n = Number(l?.receivedQuantity ?? 0);
    const pick = new Set(positions.filter((i) => i >= 0 && i < n));
    const k = pick.size;
    if (!(k >= 1 && k < n)) return;
    const slots = String(l?.serialText ?? "").split(/\r?\n/);
    const at = (i: number) => slots[i] ?? "";
    const trim = (list: string[]) => {
      const out = [...list];
      while (out.length && !String(out[out.length - 1] ?? "").trim()) out.pop();
      return out.join("\n");
    };
    const all = Array.from({ length: n }, (_, i) => i);
    const keep = n - k;
    const { id: _id, lineNo: _lineNo, ...rest } = l ?? {};
    void _id; void _lineNo;
    setValue(`${name}.${index}.receivedQuantity`, keep, { shouldDirty: true });
    setValue(`${name}.${index}.documentQuantity`, l?.differs ? Math.max(Number(l?.documentQuantity ?? 0) - k, 0) : keep, { shouldDirty: true });
    setValue(`${name}.${index}.serialText`, trim(all.filter((i) => !pick.has(i)).map(at)), { shouldDirty: true });
    insert(index + 1, {
      ...rest,
      receivedQuantity: k,
      documentQuantity: k,
      differs: false,
      varianceReason: "",
      serialText: trim(all.filter((i) => pick.has(i)).map(at)),
    }, { shouldFocus: false });
    setOpening(index + 1);
  };
  // Dòng vừa tách: mở chi tiết và cuộn tới (id của dòng mới chỉ có sau khi vẽ lại).
  useEffect(() => {
    if (opening == null || !fields[opening]) return;
    const id = fields[opening].id;
    setExpanded((prev) => new Set(prev).add(id));
    const at = opening;
    setOpening(null);
    requestAnimationFrame(() => document.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [opening, fields]);

  /**
   * Thêm thiết bị: đã có ĐÚNG MỘT dòng (theo hoá đơn của phiếu) cùng thiết bị, cùng đơn giá thì cộng số lượng; còn lại
   * (chưa có, đã tách thành nhiều dòng, khác đơn giá, dòng Excel có model / hãng / thông tin khác) thì thêm dòng.
   */
  const add = (rows: Added[], roomId?: number | null) => {
    const current = (getValues(name) ?? []) as any[];
    for (const { catalog, quantity = 1, unitPrice, model, manufacturer, otherInfo } of rows) {
      const same = current.filter((l) => Number(l?.catalog?.id) === catalog.id);
      const at = same.length === 1 && !same[0]?.ownDocuments && !otherInfo && !model && !manufacturer
        && (unitPrice == null || same[0]?.unitPrice == null || Number(same[0].unitPrice) === Number(unitPrice))
        ? current.indexOf(same[0]) : -1;
      if (at >= 0) {
        const l = current[at];
        const q = Number(l.receivedQuantity ?? 0) + quantity;
        setValue(`${name}.${at}.receivedQuantity`, q, { shouldDirty: true });
        if (!l.differs) setValue(`${name}.${at}.documentQuantity`, q, { shouldDirty: true });
        if (unitPrice != null) setValue(`${name}.${at}.unitPrice`, unitPrice, { shouldDirty: true });
        current[at] = { ...l, receivedQuantity: q };
        continue;
      }
      const line = {
        ...EMPTY_LINE,
        catalog: { id: catalog.id },
        name: catalog.name ?? "",
        assetCategory: catalog.assetCategory ?? null,
        physicalOrDigital: catalog.physicalOrDigital ?? "PHYSICAL",
        receivedQuantity: quantity,
        documentQuantity: quantity,
        unitPrice: unitPrice ?? null,
        model: model ?? null,
        manufacturer: manufacturer ?? null,
        otherInfo: otherInfo ?? null,
        room: { id: roomId ?? store?.id ?? null },
      };
      append(line, { shouldFocus: false });
      current.push(line);
    }
  };

  const units = lines.reduce((s, l) => s + Number(l?.receivedQuantity ?? 0), 0);
  const total = lines.reduce((s, l) => s + Number(l?.unitPrice ?? 0) * Number(l?.receivedQuantity ?? 0), 0);
  const chosen = new Set<number>(lines.map((l) => Number(l?.catalog?.id)).filter((id) => Number.isFinite(id)));

  return (
    <div>
      <div className={cn("px-5", open ? "pt-4 pb-3" : "py-4")}>
        {/* Ô tìm đứng cùng hàng tên khối, không kéo dài hết bề ngang. */}
        <SectionHead title="Danh sách thiết bị ghi tăng" open={open} onToggle={() => onToggle?.()}
          aside={lines.length ? `${lines.length} thiết bị · ${money.format(units)} đơn vị` : undefined}
          summary={lines.length ? `${lines.length} thiết bị · ${money.format(units)} đơn vị · ${money.format(total)} đ` : <span className="text-destructive">Chưa có thiết bị</span>}
          actions={<LinesToolbar locked={locked} onAdd={(rows) => add(rows)} onBrowse={() => setBrowsing(true)} />} />
      </div>
      <CatalogPickerDialog
        open={browsing}
        onOpenChange={setBrowsing}
        schoolId={schoolId}
        exclude={chosen}
        onPick={(rows, roomId) => {
          add(rows.map((c) => ({ catalog: c })), roomId);
          setBrowsing(false);
        }}
      />
      <div className={cn("border-t", !open && "hidden")}>
        <Table className="min-w-[62rem] table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-32" />
            <col />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-40" />
            <col className="w-28" />
            <col className="w-10" />
          </colgroup>
          <TableHeader className="bg-surface-subtle">
            <TableRow>
              <TableHead className="text-center">#</TableHead>
              <TableHead>Mã DM thiết bị</TableHead>
              <TableHead>Thiết bị</TableHead>
              <TableHead className="pe-4 text-right">Số lượng</TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="pe-4 text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="ps-4">Nhận vào</TableHead>
              <TableHead className="pe-3 text-right">Chi tiết</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableEmpty colSpan={COLS} compact icon={<PackageSearch />} title="Chưa có thiết bị"
                description={locked ?? "Chọn từ danh mục, hoặc nhập Excel theo tệp mẫu."} />
            ) : fields.map((field, index) => {
              const l = lines[index];
              const catalog = l?.catalog?.id ? catalogs.get(Number(l.catalog.id)) : undefined;
              return (
                <Fragment key={field.id}>
                  <LineRow
                    control={control}
                    path={`${name}.${index}`}
                    index={index}
                    catalog={catalog}
                    rooms={rooms}
                    schoolId={schoolId}
                    issues={lineIssues(l, catalog, config, headFunding, rule)}
                    expanded={expanded.has(field.id)}
                    onToggle={() => setExpanded((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(field.id)) next.add(field.id);
                      return next;
                    })}
                    onRemove={() => remove(index)}
                    onSplit={(positions) => split(index, positions)}
                    separate={lines.slice(0, index).some((x) => x?.catalog?.id != null && Number(x.catalog.id) === Number(l?.catalog?.id))}
                    preview={previews[field.id]}
                    offset={offsetOf(index)}
                    onPreview={reporter(field.id)}
                  />
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* Không còn dòng tổng ở chân bảng (trưởng nhóm 13/11/2026): số thiết bị ở tiêu đề khối, tổng tiền ở cột phải. */}
    </div>
  );
}
