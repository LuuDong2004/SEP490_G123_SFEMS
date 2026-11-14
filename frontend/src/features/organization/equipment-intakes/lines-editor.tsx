import { useCustom, useList, useNotification } from "@refinedev/core";
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Copy, Download, FileSpreadsheet, FileText, ListPlus, PackageSearch, Plus, Trash2, Upload } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";

import { Link } from "react-router";

import { CatalogPickerDialog } from "./catalog-picker";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { getAuthorities } from "@/shared/api/session";
import { errorMessage } from "@/shared/lib/api-error";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { API_URL } from "@/shared/api/constants";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { DateInput } from "@/shared/components/form/date-input";
import { FormHint, HelpHint } from "@/shared/components/form/help-hint";
import { MoneyInput } from "@/shared/components/form/money-input";
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
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SectionHead } from "./section-head";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { intakeLineOutcome, stockQuantityOf } from "@/domains/equipment-intake/types";
import { EMPTY_DOCUMENT, LineOwnDocumentFields } from "./line-documents";
import { headFieldsOf } from "./head-fields";
import { isChemical, isPurchaseCode, lineIssues, serialError, serialsOf } from "./readiness";
import { UNIT_KEYS, unitValue, type UnitInfo } from "./fields";

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
  /** Chỉ trên form: phòng nhận riêng của từng cái theo vị trí; null = theo phòng nhận của dòng. */
  unitRooms: [] as (number | null)[],
  /** Chỉ trên form: model, hãng, bảo hành, thông tin khác của từng cái (vắng = theo dòng). */
  units: [] as UnitInfo[],
  /** Chỉ trên form: thêm vào phiếu bằng "Nhập Excel" — chỉ những dòng này có nút "Lấy từ Excel" (trưởng nhóm 14/11/2026). */
  fromExcel: false,
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

/** Số trang hiện trên thanh chuyển trang (0-based); `null` là chỗ "…". */
function pageButtons(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, k) => k);
  const keep = new Set([0, pages - 1, page - 1, page, page + 1].filter((k) => k >= 0 && k < pages));
  const out: (number | null)[] = [];
  [...keep].sort((x, y) => x - y).forEach((k, j, arr) => {
    if (j > 0 && k - arr[j - 1] > 1) out.push(null);
    out.push(k);
  });
  return out;
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

/** Chữ gợi ý trong ô của bảng từng thiết bị: nhỏ, nghiêng, mờ — không lấn giá trị đã nhập. */
const UNIT_PH = "placeholder:text-[0.6875rem] placeholder:italic placeholder:text-muted-foreground/60";

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

/** `placeholder`: ô chọn để ÁP một lượt (thanh chọn nhiều cái) — luôn trống, chọn xong là áp. */
function RoomCell({ value, onChange, rooms, label, placeholder }: { value: any; onChange: (v: { id: number | null }) => void; rooms: Room[]; label: string; placeholder?: string }) {
  const id = value?.id ? String(value.id) : "";
  const options = [
    ...(id && !rooms.some((r) => String(r.id) === id) ? [{ id: Number(id), name: value?.name ?? "…" }] : []),
    ...rooms,
  ];
  return (
    <Select value={placeholder ? "" : id || NO_ROOM} onValueChange={(v) => { if (v) onChange({ id: v === NO_ROOM ? null : Number(v) }); }}>
      <SelectTrigger size="sm" aria-label={label} className="bg-surface-subtle h-8 w-full rounded-full border-transparent shadow-none">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {!storeroomOf(rooms) ? <SelectItem value={NO_ROOM}>Kho thiết bị</SelectItem> : null}
        {options.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ------------------------------------------------------------------ hàng công cụ: chọn từ danh mục, nhập Excel

type Added = { fromExcel?: boolean; catalog: PickedCatalog; quantity?: number; unitPrice?: number | null; model?: string | null; manufacturer?: string | null; otherInfo?: string | null };

/** Bỏ dấu, chữ thường — so mã / tên dán từ Excel. */
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().trim();

/**
 * Hàng công cụ đầu bảng: "Chọn thiết bị trong danh mục" và "Nhập Excel" (chọn tệp theo mẫu / tải tệp mẫu). Không có ô tìm (trưởng
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
        added.push({ fromExcel: true, catalog: row, quantity: q > 0 ? q : 1, unitPrice: p ? Number(p) : undefined,
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
        Chọn thiết bị trong danh mục
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

const COLS = 9;

/**
 * Một dòng của bảng lưới: số lượng, đơn giá, phòng nhận gõ thẳng tại chỗ; ⌄ mở ngay dưới dòng phần chi tiết (model,
 * hãng, bảo hành, hạn dùng / quy cách của vật tư, số serial, nhận khác hoá đơn, hoá đơn riêng).
 */
function LineRow({ control, path, index, catalog, rooms, schoolId, issues, expanded, onToggle, onRemove, onSplit, separate, priceNo, preview, offset, onPreview }: {
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
  /** Phần tách ra (đơn giá khác) của một thiết bị đã có ở mục trên (cùng mã DM). */
  separate?: boolean;
  /** Thứ tự đơn giá khi cùng thiết bị được tách thành nhiều mục (1, 2, …); không có khi chỉ một mục. */
  priceNo?: number;
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
            {separate && priceNo ? <Badge variant="warning" className="shrink-0 px-1.5" title="Cùng thiết bị với mục trên, tách ra để nhập đơn giá khác">Đơn giá số {priceNo}</Badge> : null}
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
            <LineDetail control={control} path={path} line={line} catalog={catalog} preview={preview} offset={offset} onSplit={onSplit} rooms={rooms} priceNo={priceNo} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Phần mở ngay dưới dòng. */
function LineDetail({ control, path, line, catalog, preview, offset, onSplit, rooms, priceNo }: {
  priceNo?: number;
  control: Control<any>;
  path: string;
  line: any;
  catalog: any;
  preview: Preview | undefined;
  offset: number;
  onSplit: (positions: number[]) => void;
  rooms: Room[];
}) {
  const { setValue, getValues, trigger } = useFormContext();
  const { origins } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const head = headFieldsOf(origins.find((o) => String(o.id) === String(originId ?? ""))?.code);
  // Tên chứng từ theo nguồn: hoá đơn, biên bản tặng, quyết định điều chuyển, chứng từ.
  const noun = (head.documentNo?.label ?? "Số chứng từ").replace(/^Số /, "");
  const tracking: string | undefined = catalog?.trackingType;
  const received = Number(line?.receivedQuantity ?? 0);
  const unitCount = tracking === "bulk" ? Math.min(received, 1) : received;
  const textField = (key: "model" | "manufacturer" | "otherInfo", label: string, rule: "SHORT_TEXT" | "NOTE", max: number | undefined, placeholder: string, className?: string) => (
    <FormField
      control={control}
      name={`${path}.${key}`}
      rules={textRules(rule, label, max ? { max } : undefined)}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref}
              maxLength={maxLengthOf(rule, max)} placeholder={placeholder} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  // Hộp chứng từ riêng (trưởng nhóm 14/11/2026): "Xong" chỉ bấm được khi đủ ô bắt buộc; đóng bằng X / Esc là bỏ thay đổi vừa gõ;
  // "Bỏ" thôi dùng chứng từ riêng.
  const DOC_KEYS = ["ownDocuments", "supplier", "documentNo", "documentDate", "pendingFiles"] as const;
  const docRequired = [head.supplier && "supplier", head.documentNo && "documentNo", head.documentDate && "documentDate"].filter(Boolean) as string[];
  const [docOpen, setDocOpen] = useState(false);
  const docSnapshot = useRef<Record<string, unknown> | null>(null);
  const openDoc = () => {
    docSnapshot.current = Object.fromEntries(DOC_KEYS.map((k) => [k, getValues(`${path}.${k}`)]));
    if (!line?.ownDocuments) setValue(`${path}.ownDocuments`, true, { shouldDirty: true });
    setDocOpen(true);
  };
  const cancelDoc = () => {
    const snap = docSnapshot.current;
    if (snap) for (const k of DOC_KEYS) setValue(`${path}.${k}`, snap[k], { shouldDirty: true });
    setDocOpen(false);
  };
  const docComplete = docRequired.every((k) => String(line?.[k] ?? "").trim() !== "");
  const finishDoc = async () => {
    if (await trigger(docRequired.map((k) => `${path}.${k}`))) setDocOpen(false);
  };
  const docSummary = [line?.documentNo, line?.documentDate ? formatPlainDate(line.documentDate) : null].filter(Boolean).join(" · ");
  return (
    // Dạng HÀNG VÀ CỘT (phương án A, trưởng nhóm 14/11/2026): một hàng ô chung của cả mục, hai liên kết mở ô hiếm dùng,
    // rồi bảng từng thiết bị — không khung thẻ trái / phải.
    <div className="grid gap-3">
      {tracking !== "serial" ? (
      <div className="grid items-start gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
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
                    placeholder="Không" className="pe-14 text-left" />
                </FormControl>
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">tháng</span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {textField("model", "Model", "SHORT_TEXT", 50, "Không bắt buộc")}
        {textField("manufacturer", "Hãng sản xuất", "SHORT_TEXT", 100, "Không bắt buộc")}
        {textField("otherInfo", "Thông tin khác", "NOTE", undefined, "Ghi thêm nếu cần: kích cỡ, chất liệu, cấu hình…")}
        <div className="grid gap-2">
          <Label>Nhận vào <span className="text-destructive">*</span></Label>
          <div className="[&_button]:bg-field [&_button]:h-9 [&_button]:rounded-md [&_button]:border-input">
            <RoomCell value={line?.room} rooms={rooms} label="Nhận vào"
              onChange={(v) => { setValue(`${path}.room`, v, { shouldDirty: true }); setValue(`${path}.unitRooms`, [], { shouldDirty: true }); }} />
          </div>
        </div>
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
      ) : null}

      <div className="flex flex-wrap justify-end gap-x-6 gap-y-2">
        <span className="flex w-fit items-center gap-1">
          <button type="button" onClick={openDoc}
            className="text-primary flex items-center gap-1 text-sm font-medium hover:underline">
            {line?.ownDocuments ? <FileText className="size-3.5" /> : <Plus className="size-3.5" />}
            {line?.ownDocuments ? `Theo ${noun} khác${docSummary ? `: ${docSummary}` : ""}` : `Thiết bị này theo ${noun} khác`}
          </button>
          <HelpHint>{`VD: phiếu gom 2 ${noun}, thiết bị này thuộc ${noun} thứ hai.`}</HelpHint>
        </span>
      </div>
      <Dialog open={docOpen} onOpenChange={(o) => { if (!o) cancelDoc(); }}>
        <DialogContent size="formFit">
          <DialogHeader>
            <DialogTitle>{`Thiết bị này theo ${noun} khác`}</DialogTitle>
            <DialogDescription>{`Thay cho ${noun} ở đầu phiếu, chỉ áp cho mục này.`}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <LineOwnDocumentFields control={control} path={path} lineId={line?.id} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" title={`Thiết bị này theo ${noun} ở đầu phiếu`}
              onClick={() => { setValue(`${path}.ownDocuments`, false, { shouldDirty: true }); setDocOpen(false); }}>
              Bỏ
            </Button>
            <Button type="button" disabled={!docComplete} title={docComplete ? undefined : "Điền đủ các ô có dấu *"} onClick={finishDoc}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnitsPanel control={control} path={path} tracking={tracking} count={unitCount} received={received}
        outcome={intakeLineOutcome(tracking, stockQuantityOf(received, line?.packUnit?.id ? line?.packSize : null), line?.packUnit?.id && line?.packSize ? catalog?.unit?.name : undefined)}
        code={preview?.code ?? null} reason={line?.catalog?.id ? preview?.reason ?? null : null} offset={offset} onSplit={onSplit} rooms={rooms} lineRoomId={line?.room?.id ?? null} priceNo={priceNo} />
    </div>
  );
}

/**
 * Cột phải của chi tiết dòng: TỪNG thiết bị sẽ sinh ra lúc duyệt — mỗi máy một hàng, mã dự kiến của chính máy đó và
 * ô serial của nó (lưu theo VỊ TRÍ: máy 2 để trống thì máy 3 vẫn mang đúng số của nó). Dán một cột serial từ Excel
 * vào ô nào thì điền từ máy đó trở xuống. Dòng theo lô: một mã chung, không serial.
 */
function UnitsPanel({ control, path, tracking, count, received, outcome, code, reason, offset, onSplit, rooms, lineRoomId, priceNo }: {
  priceNo?: number;
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
  rooms: Room[];
  lineRoomId: number | null;
}) {
  const { setValue } = useFormContext();
  // Nơi nhận của TỪNG cái (trưởng nhóm 14/11/2026): mặc định theo ô "Nhận vào" của cả lô, sửa riêng từng cái được,
  // hoặc chọn nhiều cái rồi chuyển một lượt ở thanh dưới.
  const unitRooms = (useWatch({ control, name: `${path}.unitRooms` }) ?? []) as (number | null)[];
  const roomAt = (i: number) => unitRooms[i] ?? lineRoomId;
  const setRooms = (positions: number[], id: number | null) => {
    const next = Array.from({ length: Math.max(unitRooms.length, ...positions.map((p) => p + 1)) }, (_, k) => unitRooms[k] ?? null);
    for (const p of positions) next[p] = id == null || id === lineRoomId ? null : id;
    while (next.length && next[next.length - 1] == null) next.pop();
    setValue(`${path}.unitRooms`, next, { shouldDirty: true });
  };
  // Cột của bảng từng cái: [chọn] # · mã dự kiến · serial · model · hãng · bảo hành · thông tin khác · nhận vào.
  const cols = received >= 2
    ? "grid-cols-[1.75rem_2rem_10.5rem_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_6.5rem_minmax(8rem,1.4fr)_12rem]"
    : "grid-cols-[2rem_10.5rem_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_6.5rem_minmax(8rem,1.4fr)_12rem]";
  const units = (useWatch({ control, name: `${path}.units` }) ?? []) as UnitInfo[];
  const lineNow = { ...(useWatch({ control, name: path }) ?? {}), units };
  const valueAt = (i: number, key: (typeof UNIT_KEYS)[number]) => unitValue(lineNow, i, key);
  /** Ghi ô `key` cho các cái ở `positions` (đủ cả mảng theo vị trí, ô chưa sửa lấy giá trị đang hiện). */
  const setUnit = (positions: number[], key: (typeof UNIT_KEYS)[number], v: unknown) => {
    const next: UnitInfo[] = Array.from({ length: received }, (_, k) => {
      const cur = units[k] ?? {};
      return Object.fromEntries(UNIT_KEYS.map((x) => [x, cur[x] !== undefined ? cur[x] : valueAt(k, x)])) as UnitInfo;
    });
    for (const p of positions) if (p < received) next[p] = { ...next[p], [key]: v === "" ? null : v };
    setValue(`${path}.units`, next, { shouldDirty: true });
  };
  // Sao chép chỉ dùng khi đã ĐÁNH DẤU thiết bị (trưởng nhóm 14/11/2026): giá trị ô bấm chép sang đúng các cái đã chọn.
  const targets = (i: number) => chosen.filter((k) => k !== i);
  /** Cột cuối: chép cả hàng (model, hãng, bảo hành, thông tin khác, nơi nhận) sang các cái đã chọn. */
  const copyRow = (i: number) => {
    const t = targets(i);
    const vals = Object.fromEntries(UNIT_KEYS.map((k) => [k, valueAt(i, k)])) as UnitInfo;
    const next: UnitInfo[] = Array.from({ length: received }, (_, k) => {
      const cur = units[k] ?? {};
      return Object.fromEntries(UNIT_KEYS.map((x) => [x, cur[x] !== undefined ? cur[x] : valueAt(k, x)])) as UnitInfo;
    });
    for (const k of t) next[k] = { ...vals };
    setValue(`${path}.units`, next, { shouldDirty: true });
    setRooms(t, roomAt(i));
  };
  /** Nút sao chép chỉ ở hàng ĐÃ CHỌN, ô ĐÃ CÓ giá trị, và còn cái khác được chọn để điền sang (trưởng nhóm 14/11/2026). */
  const canCopy = (i: number, value: unknown) => picked.has(i) && targets(i).length > 0 && value != null && String(value).trim() !== "";
  // Bấm sao chép thì hỏi lại trước khi ghi đè (trưởng nhóm 14/11/2026); có chọn thì biểu tượng hiện sẵn.
  // Hộp hỏi nói rõ chép TỪ cái nào SANG cái nào, và từng ô sẽ thành giá trị gì (trưởng nhóm 14/11/2026: câu chung chung khó hiểu).
  const [copying, setCopying] = useState<{ from: number; to: number[]; what: string; facts: [string, unknown][]; run: () => void } | null>(null);
  const copyDown = (from: number, what: string, facts: [string, unknown][], onCopy: () => void) => {
    const label = `Chép ${what} sang ${targets(from).length} thiết bị đã chọn`;
    return (
    <button type="button" onClick={() => setCopying({ from, to: targets(from), what, facts, run: onCopy })}
      title={label} aria-label={label}
      className="text-primary hover:bg-info-subtle absolute top-1/2 right-1 -translate-y-1/2 rounded p-0.5">
      <Copy className="size-3.5" />
    </button>
    );
  };
  const listNo = (t: number[]) => (t.length <= 6 ? t.map((k) => k + 1).join(", ") : `${t.slice(0, 5).map((k) => k + 1).join(", ")} và ${t.length - 5} cái khác`);
  const roomName = (id: number | null) => (id == null ? "Kho thiết bị" : rooms.find((r) => r.id === id)?.name ?? "…");
  // Tách đơn giá khác (thay "Tách dòng" / "Khai riêng", trưởng nhóm 14/11/2026): đánh dấu những cái khác model / hãng / đơn giá rồi bấm
  // nút ở thanh dưới — chúng thành một mục riêng ngay dưới, serial đã nhập đi theo đúng cái đó.
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // Bảng từng cái: 10 cái một trang, không cuộn trong khung (trưởng nhóm 14/11/2026).
  const PAGE = 10;
  const pages = Math.max(1, Math.ceil(received / PAGE));
  const [pageNo, setPageNo] = useState(0);
  const page = Math.min(pageNo, pages - 1);
  const shown = Array.from({ length: Math.max(0, Math.min(PAGE, received - page * PAGE)) }, (_, k) => page * PAGE + k);
  const canPick = received >= 2;
  const toggle = (i: number) => setPicked((prev) => { const next = new Set(prev); if (!next.delete(i)) next.add(i); return next; });
  const chosen = [...picked].filter((i) => i < received).sort((a, b) => a - b);
  const text = useWatch({ control, name: `${path}.serialText` }) as string | undefined;
  const slots = String(text ?? "").split(/\r?\n/);
  const serial = tracking === "serial";
  const fromExcel = !!useWatch({ control, name: `${path}.fromExcel` });
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
    <section className="bg-card overflow-hidden rounded-md border">
      <AlertDialog open={copying != null} onOpenChange={(o) => !o && setCopying(null)}>
        {copying ? (
          <ConfirmContent icon={<Copy />} title={`Chép ${copying.what} từ thiết bị ${copying.from + 1} sang thiết bị ${listNo(copying.to)}?`}
            description={
              <div className="grid gap-2">
                <span>Sau khi chép, {copying.to.length > 1 ? `${copying.to.length} thiết bị này` : "thiết bị này"} sẽ có:</span>
                <dl className="bg-surface-subtle text-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border px-3 py-2">
                  {copying.facts.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}:</dt>
                      <dd className={cn("min-w-0 break-words", (v == null || v === "") && "text-muted-foreground italic")}>{v == null || v === "" ? "để trống" : String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <span>Giá trị đang có ở đó bị thay. Số serial giữ nguyên.</span>
              </div>
            }
            cancelLabel="Không chép" confirmLabel="Chép" onConfirm={() => { copying.run(); setCopying(null); }} />
        ) : null}
      </AlertDialog>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h4 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          {serial ? `${priceNo ? `Đơn giá số ${priceNo}` : "Từng thiết bị"} · ${received} cái` : "Khi duyệt"}
        </h4>
        {serial && received > 0 ? (
          <>
            <span className="text-muted-foreground text-xs tabular-nums">{filled}/{received} có serial</span>
            {fromExcel ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
              title="Sao chép cột serial trong Excel rồi bấm — điền từ cái đầu tiên trở xuống"
              onClick={async () => {
                try {
                  pasteAt(0, await navigator.clipboard.readText());
                } catch {
                  // Trình duyệt không cho đọc bộ nhớ tạm: dán thẳng (Ctrl+V) vào ô của máy đầu tiên cũng được.
                }
              }}>
              Lấy từ Excel
            </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {serial && received > 0 ? (
        <div className="border-t">
          <div className={cn("bg-surface-subtle text-muted-foreground sticky top-0 z-10 grid items-center border-b px-4 py-1.5 text-xs font-semibold", cols)}>
            {canPick ? (
              <Checkbox aria-label="Chọn tất cả" checked={chosen.length === received ? true : chosen.length ? "indeterminate" : false}
                onCheckedChange={(v) => setPicked(v === true ? new Set(Array.from({ length: received }, (_, i) => i)) : new Set())} />
            ) : null}
            <span>#</span>
            <span className="flex items-center gap-1">Mã dự kiến <HelpHint>{why}</HelpHint></span>
            {/* Thụt bằng lề trong của ô nhập (px-3) để tiêu đề thẳng với chữ trong ô. */}
            <span className="ps-3">Số serial</span>
            <span className="ps-5">Model</span>
            <span className="ps-5">Hãng</span>
            <span className="ps-5">Bảo hành (tháng)</span>
            <span className="ps-5">Thông tin khác</span>
            <span className="ps-5">Nhận vào</span>
          </div>
          {shown.map((i) => (
            <div key={i} className={cn("grid items-center border-b px-4 py-0.5 last:border-b-0", cols, picked.has(i) && "bg-info-subtle")}>
              {canPick ? <Checkbox aria-label={`Chọn thiết bị ${i + 1}`} checked={picked.has(i)} onCheckedChange={() => toggle(i)} /> : null}
              <span className="text-muted-foreground text-sm tabular-nums">{i + 1}</span>
              <span className="truncate font-mono text-xs">
                {split && first != null && first + i <= 999 ? <SeqCode code={withSeq(code!, first + i)} /> : reason ? <span className="text-warning-text font-sans">—</span> : "…"}
              </span>
              <Input value={slots[i] ?? ""} aria-label={`Số serial thiết bị ${i + 1}`} placeholder="Nhập serial" maxLength={50}
                aria-invalid={!!slotError(i) || undefined} title={slotError(i)}
                className={cn(CELL_INPUT, "font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case", UNIT_PH)}
                onChange={(e) => setAt(i, e.target.value)}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (!/\r?\n/.test(t.trim())) return;
                  e.preventDefault();
                  pasteAt(i, t);
                }} />
              <div className="group/cell relative ps-2">
                <Input value={String(valueAt(i, "model") ?? "")} aria-label={`model thiết bị ${i + 1}`} maxLength={maxLengthOf("SHORT_TEXT", 50)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.model === undefined && "text-muted-foreground")} placeholder="Nhập model"
                  onChange={(e) => setUnit([i], "model", e.target.value)} />
                {canCopy(i, valueAt(i, "model")) ? copyDown(i, "model", [["Model", valueAt(i, "model")]], () => setUnit(targets(i), "model", valueAt(i, "model"))) : null}
              </div>
              <div className="group/cell relative ps-2">
                <Input value={String(valueAt(i, "manufacturer") ?? "")} aria-label={`manufacturer thiết bị ${i + 1}`} maxLength={maxLengthOf("SHORT_TEXT", 100)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.manufacturer === undefined && "text-muted-foreground")} placeholder="Nhập hãng"
                  onChange={(e) => setUnit([i], "manufacturer", e.target.value)} />
                {canCopy(i, valueAt(i, "manufacturer")) ? copyDown(i, "hãng", [["Hãng", valueAt(i, "manufacturer")]], () => setUnit(targets(i), "manufacturer", valueAt(i, "manufacturer"))) : null}
              </div>
              <div className="group/cell relative ps-2">
                <IntInput value={valueAt(i, "warrantyMonths")} aria-label={`Bảo hành thiết bị ${i + 1}`} placeholder="Số tháng"
                  className={cn(CELL_INPUT, "pe-6 text-left text-xs", UNIT_PH)} onChange={(v) => setUnit([i], "warrantyMonths", v)} />
                {canCopy(i, valueAt(i, "warrantyMonths")) ? copyDown(i, "bảo hành", [["Bảo hành (tháng)", valueAt(i, "warrantyMonths")]], () => setUnit(targets(i), "warrantyMonths", valueAt(i, "warrantyMonths"))) : null}
              </div>
              <div className="group/cell relative ps-2">
                <Input value={String(valueAt(i, "otherInfo") ?? "")} aria-label={`otherInfo thiết bị ${i + 1}`} maxLength={maxLengthOf("NOTE", undefined)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.otherInfo === undefined && "text-muted-foreground")} placeholder="Ghi thêm nếu cần"
                  onChange={(e) => setUnit([i], "otherInfo", e.target.value)} />
                {canCopy(i, valueAt(i, "otherInfo")) ? copyDown(i, "thông tin khác", [["Thông tin khác", valueAt(i, "otherInfo")]], () => setUnit(targets(i), "otherInfo", valueAt(i, "otherInfo"))) : null}
              </div>
              <div className={cn("group/cell relative ps-2 pe-5", unitRooms[i] != null && "[&_button]:text-primary [&_button]:font-medium")} title={unitRooms[i] != null ? "Khác nơi nhận chung của lô" : undefined}>
                <RoomCell value={{ id: roomAt(i), name: roomName(roomAt(i)) }} rooms={rooms} label={`Nhận vào, thiết bị ${i + 1}`}
                  onChange={(v) => setRooms([i], v.id)} />
                {picked.has(i) && targets(i).length ? copyDown(i, "tất cả thông tin", [["Model", valueAt(i, "model")], ["Hãng", valueAt(i, "manufacturer")], ["Bảo hành (tháng)", valueAt(i, "warrantyMonths")], ["Thông tin khác", valueAt(i, "otherInfo")], ["Nhận vào", roomName(roomAt(i))]], () => copyRow(i)) : null}
              </div>
            </div>
          ))}
          {/* Trang cuối ít hơn 10 cái: thêm hàng trống để khung giữ nguyên chiều cao, không co lại khi chuyển trang. */}
          {pages > 1 ? Array.from({ length: PAGE - shown.length }, (_, k) => (
            <div key={`pad-${k}`} aria-hidden className={cn("grid items-center border-b px-4 py-0.5", cols)}><div className="h-8" /></div>
          )) : null}
          {pages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-sm">
              <span className="text-muted-foreground tabular-nums">
                Hiện <span className="text-foreground font-medium">{page * PAGE + 1}–{Math.min(received, (page + 1) * PAGE)}</span> trong {received} cái
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8" disabled={page === 0} onClick={() => setPageNo(page - 1)}>
                  <ChevronLeft /> Trước
                </Button>
                {pageButtons(page, pages).map((k, j) => k == null ? (
                  <span key={`gap-${j}`} className="text-muted-foreground px-1">…</span>
                ) : (
                  <Button key={k} type="button" size="sm" variant={k === page ? "default" : "outline"} className="h-8 min-w-8 px-2 tabular-nums"
                    aria-current={k === page ? "page" : undefined} onClick={() => setPageNo(k)}>{k + 1}</Button>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-8" disabled={page >= pages - 1} onClick={() => setPageNo(page + 1)}>
                  Sau <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
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
        <div className="bg-info-subtle flex flex-wrap items-center gap-3 border-t px-4 py-2 text-sm">
          <span className="flex-1 font-medium">Đã chọn {chosen.length} cái</span>
          <div className="w-52"><RoomCell value={{ id: null, name: "" }} rooms={rooms} label="Chuyển các cái đã chọn vào" placeholder="Chuyển vào…" onChange={(v) => setRooms(chosen, v.id)} /></div>
          <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
          <Button type="button" size="sm" className="h-8" disabled={chosen.length >= received}
            title={chosen.length >= received ? "Phải để lại ít nhất một cái" : "Các thiết bị đã chọn thành một mục riêng ngay dưới, để khai đơn giá khác"}
            onClick={() => { onSplit(chosen); setPicked(new Set()); }}>
            Tách đơn giá khác
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
  // Phiếu mới chưa có trường trên form (máy chủ tự gán khi lưu): lấy trường của tài khoản — không thì mã dự kiến không ra.
  const schoolId = (useWatch({ control, name: "school.id" }) as number | null | undefined) ?? getAuthorities()?.schoolId ?? null;
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
   * Tách đơn giá khác: những cái ĐÃ CHỌN thành một mục mới ngay dưới, cùng mã DM — chép model, hãng, đơn giá, chứng từ, nơi
   * nhận để sửa phần khác; serial đi theo đúng cái đó. Số trên hoá đơn: mục mới bằng số khai riêng, mục cũ bớt đi.
   */
  const [opening, setOpening] = useState<number | null>(null);
  const pendingNested = useRef<{ index: number; unitRooms: (number | null)[]; units: UnitInfo[] } | null>(null);
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
    const roomsOf = (l?.unitRooms ?? []) as (number | null)[];
    setValue(`${name}.${index}.unitRooms`, all.filter((i) => !pick.has(i)).map((i) => roomsOf[i] ?? null), { shouldDirty: true });
    const unitsOf = (l?.units ?? []) as UnitInfo[];
    if (unitsOf.length) setValue(`${name}.${index}.units`, all.filter((i) => !pick.has(i)).map((i) => unitsOf[i] ?? {}), { shouldDirty: true });
    insert(index + 1, {
      ...rest,
      receivedQuantity: k,
      documentQuantity: k,
      differs: false,
      varianceReason: "",
      serialText: trim(all.filter((i) => pick.has(i)).map(at)),
      unitRooms: all.filter((i) => pick.has(i)).map((i) => ((l?.unitRooms ?? []) as (number | null)[])[i] ?? null),
      units: ((l?.units ?? []) as UnitInfo[]).length ? all.filter((i) => pick.has(i)).map((i) => ((l?.units ?? []) as UnitInfo[])[i] ?? {}) : [],
    }, { shouldFocus: false });
    // Mảng lồng (từng cái) chèn kèm insert() bị field array bỏ qua: ghi lại sau khi dòng mới đã có.
    pendingNested.current = {
      index: index + 1,
      unitRooms: all.filter((i) => pick.has(i)).map((i) => roomsOf[i] ?? null),
      units: unitsOf.length ? all.filter((i) => pick.has(i)).map((i) => unitsOf[i] ?? {}) : [],
    };
    setOpening(index + 1);
  };
  // Dòng vừa tách: mở chi tiết và cuộn tới (id của dòng mới chỉ có sau khi vẽ lại).
  useEffect(() => {
    if (opening == null || !fields[opening]) return;
    const nested = pendingNested.current;
    if (nested && nested.index === opening) {
      setValue(`${name}.${opening}.unitRooms`, nested.unitRooms, { shouldDirty: true });
      setValue(`${name}.${opening}.units`, nested.units, { shouldDirty: true });
      pendingNested.current = null;
    }
    const id = fields[opening].id;
    setExpanded((prev) => new Set(prev).add(id));
    const at = opening;
    setOpening(null);
    requestAnimationFrame(() => document.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [opening, fields, name, setValue]);

  /**
   * Thêm thiết bị: đã có ĐÚNG MỘT dòng (theo hoá đơn của phiếu) cùng thiết bị, cùng đơn giá thì cộng số lượng; còn lại
   * (chưa có, đã tách thành nhiều dòng, khác đơn giá, dòng Excel có model / hãng / thông tin khác) thì thêm dòng.
   */
  const add = (rows: Added[], roomId?: number | null) => {
    const current = (getValues(name) ?? []) as any[];
    for (const { catalog, quantity = 1, unitPrice, model, manufacturer, otherInfo, fromExcel } of rows) {
      const same = current.filter((l) => Number(l?.catalog?.id) === catalog.id);
      const at = same.length === 1 && !same[0]?.ownDocuments && !otherInfo && !model && !manufacturer
        && (unitPrice == null || same[0]?.unitPrice == null || Number(same[0].unitPrice) === Number(unitPrice))
        ? current.indexOf(same[0]) : -1;
      if (at >= 0) {
        const l = current[at];
        const q = Number(l.receivedQuantity ?? 0) + quantity;
        setValue(`${name}.${at}.receivedQuantity`, q, { shouldDirty: true });
        if (fromExcel) setValue(`${name}.${at}.fromExcel`, true);
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
        fromExcel: !!fromExcel,
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
            <col className="w-28" />
            <col className="w-10" />
          </colgroup>
          <TableHeader className="bg-surface-subtle">
            <TableRow>
              <TableHead className="text-center">#</TableHead>
              <TableHead>Mã DM thiết bị</TableHead>
              <TableHead>Thiết bị <span className="text-destructive">*</span></TableHead>
              <TableHead className="pe-4 text-right">Số lượng <span className="text-destructive">*</span></TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="pe-4 text-right" title={isPurchaseCode(rule?.code) ? "Hàng mua phải có đơn giá" : undefined}>
                Đơn giá{isPurchaseCode(rule?.code) ? <span className="text-destructive"> *</span> : null}
              </TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              {/* Chi tiết bắt buộc mở: nơi nhận của thiết bị chọn ở trong (trưởng nhóm 14/11/2026). */}
              <TableHead className="pe-3 text-right" title="Chọn nơi nhận của thiết bị trong phần chi tiết">Chi tiết <span className="text-destructive">*</span></TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableEmpty colSpan={COLS} compact icon={<PackageSearch />} title="Chưa có thiết bị"
                description={locked ?? "Chọn thiết bị trong danh mục, hoặc nhập Excel theo tệp mẫu."} />
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
                    priceNo={(() => {
                      const same = (x: typeof l) => l?.catalog?.id != null && x?.catalog?.id != null && Number(x.catalog.id) === Number(l.catalog.id);
                      return lines.filter(same).length > 1 ? lines.slice(0, index).filter(same).length + 1 : undefined;
                    })()}
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
