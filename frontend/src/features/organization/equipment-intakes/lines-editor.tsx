import { useCustom, useList, useNotification } from "@refinedev/core";
import { Check, ChevronDown, Copy, ChevronLeft, ChevronRight, CircleAlert, Download, FileSpreadsheet, ListPlus, Loader2, PackageSearch, Plus, Trash2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";

import { Link } from "react-router";

import { CatalogPickerDialog } from "./catalog-picker";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { getAuthorities } from "@/shared/api/session";
import { errorMessage } from "@/shared/lib/api-error";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { API_URL } from "@/shared/api/constants";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { DateInput } from "@/shared/components/form/date-input";
import { HelpHint } from "@/shared/components/form/help-hint";
import { MoneyInput } from "@/shared/components/form/money-input";
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
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SectionHead } from "./section-head";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { intakeLineOutcome } from "@/domains/equipment-intake/types";
import { DocumentFields, DocumentFiles, hasDocumentHead } from "./document-fields";
import { useInvoiceReader, type InvoiceImport } from "./invoice-xml";
import { headFieldsOf } from "./head-fields";
import { isChemical, isPurchaseCode, lineIssues, serialError, serialsOf } from "./readiness";
import { newDocument, UNIT_KEYS, unitValue, type DocumentForm, type UnitInfo } from "./fields";

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
  room: { id: null },
  warrantyMonths: null,
  /** Chỉ trên form: hoá đơn (chứng từ) mà dòng thuộc về — `key` của một mục trong `documents` (254). */
  docKey: "",
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
  if (parts.length !== 6 || !/^\d{3,4}$/.test(parts[4])) return null;
  return { counter: [...parts.slice(0, 4), parts[5]].join("."), seq: Number(parts[4]) };
}

function withSeq(code: string, seq: number) {
  const parts = code.split(".");
  parts[4] = String(seq).padStart(4, "0");
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

type Room = { id: number; name: string; roomType?: { code?: string } | null };

/** Kho của trường: phòng loại KHO — cùng quy tắc `isStoreroom` ở máy chủ; không có mã loại thì theo tên. */
export function storeroomOf(rooms: Room[]): Room | undefined {
  return rooms.find((r) => r.roomType?.code === "KHO") ?? rooms.find((r) => /(^|\s)kho(\s|$)/i.test(r.name ?? ""));
}

const NO_ROOM = "__store__";

/** `placeholder`: ô chọn để ÁP một lượt (thanh chọn nhiều cái) — luôn trống, chọn xong là áp. */
function RoomCell({ value, onChange, rooms, label, placeholder }: { value: any; onChange: (v: { id: number | null }) => void; rooms: Room[]; label: string; placeholder?: string }) {
  // Chưa chọn phòng = về kho: trường có phòng kho thật thì hiện đúng phòng đó (không thì ô trống — trưởng nhóm 14/11/2026).
  const store = storeroomOf(rooms);
  const id = value?.id ? String(value.id) : store ? String(store.id) : "";
  const options = [
    ...(id && !rooms.some((r) => String(r.id) === id) ? [{ id: Number(id), name: value?.name ?? "…" }] : []),
    ...rooms,
  ];
  return (
    <Select value={placeholder ? "" : id || NO_ROOM} onValueChange={(v) => { if (v) onChange({ id: v === NO_ROOM ? null : Number(v) }); }}>
      <SelectTrigger size="sm" aria-label={label} className="bg-card h-8 w-full shadow-none">
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

/**
 * Hàng công cụ đầu bảng: MỘT nút "Thêm thiết bị" (bấm thẳng = mở hộp chọn trong danh mục) và mũi tên bên cạnh mở "Nhập từ
 * Excel" / "Tải tệp mẫu Excel" (bản mẫu 15/11/2026: hai nút ngang nhau cùng thêm dòng thì rối mắt). Không có ô tìm (trưởng
 * nhóm 13/11/2026: không cần — hộp chọn danh mục đã có tìm). Thông tin phiếu chưa khai xong (`locked` là lý do) thì
 * chưa thêm thiết bị được: dòng thiết bị đọc nguồn hình thành, nguồn kinh phí của phiếu — chỉ còn tải tệp mẫu.
 */
function LinesToolbar({ onAdd, onBrowse, locked }: { onAdd: (rows: Added[]) => void; onBrowse: () => void; locked?: string }) {
  const [pasting, setPasting] = useState(false);
  const { open: notify } = useNotification();

  const fileInput = useRef<HTMLInputElement>(null);
  /**
   * Nhập tệp Excel theo mẫu. Máy chủ đọc và KIỂM từng dòng (số lượng nguyên, đơn giá) rồi trả lỗi theo số dòng Excel;
   * form khớp mã với danh mục trong MỘT lần gọi cho cả tệp (`codes=`, 100 mã một lượt) — trước đây mỗi dòng một lần
   * gọi, 200 dòng mất 11 giây và dính giới hạn tần suất. Dòng lỗi hoặc không có mã thì không thêm, báo theo dòng.
   */
  async function importFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    setPasting(true);
    try {
      const lines = await kyInstance.post("equipment_intakes/lines-file", { body: form, timeout: DOWNLOAD_TIMEOUT })
        .json<{ row: number; code: string; quantity: number | null; unitPrice: number | null; model: string | null;
          manufacturer: string | null; otherInfo: string | null; error: string | null }[]>();
      const codes = [...new Set(lines.filter((l) => !l.error).map((l) => l.code))];
      const byCode = new Map<string, PickedCatalog>();
      for (let i = 0; i < codes.length; i += 100) {
        const chunk = codes.slice(i, i + 100);
        const found = await kyInstance.get("equipment_catalogs", {
          searchParams: { codes: chunk.join(","), active: "true", _start: "0", _end: String(chunk.length * 2) },
        }).json<PickedCatalog[]>();
        for (const c of Array.isArray(found) ? found : []) byCode.set(String(c.code ?? "").toUpperCase(), c);
      }
      const added: Added[] = [];
      const problems: string[] = [];
      for (const l of lines) {
        const row = l.error ? undefined : byCode.get(l.code);
        if (l.error) problems.push(`Dòng ${l.row}: ${l.error}`);
        else if (!row) problems.push(`Dòng ${l.row}: không có mã ${l.code} trong danh mục`);
        if (!row) continue;
        added.push({ fromExcel: true, catalog: row, quantity: l.quantity ?? 1, unitPrice: l.unitPrice ?? undefined,
          model: l.model, manufacturer: l.manufacturer, otherInfo: l.otherInfo });
      }
      if (added.length) onAdd(added);
      notify?.({
        type: problems.length ? "error" : "success",
        message: problems.length
          ? `Đã thêm ${added.length}/${lines.length} dòng từ tệp ${file.name}, ${problems.length} dòng chưa nhận`
          : `Đã thêm ${added.length} dòng từ tệp ${file.name}`,
        description: problems.length
          ? `${problems.slice(0, 6).join(" · ")}${problems.length > 6 ? ` · và ${problems.length - 6} dòng khác` : ""}. Sửa trong tệp rồi nhập lại các dòng đó.`
          : undefined,
      });
    } catch (error) {
      notify?.({ type: "error", message: "Không nhập được tệp Excel", description: await errorMessage(error) });
    } finally {
      setPasting(false);
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
      {locked ? (
        <span className="text-warning-text me-1 inline-flex items-center gap-1.5 text-xs font-medium">
          <CircleAlert className="size-3.5 shrink-0" />
          {locked}
        </span>
      ) : null}
      <input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }} />
      {/* Nút tách đôi: phần chữ là cách thêm thường dùng nhất, mũi tên mở các cách còn lại. */}
      <div className="inline-flex">
        <Button type="button" variant="outline" className="h-9 rounded-e-none border-e-0" onClick={onBrowse} disabled={!!locked || pasting}>
          {pasting ? <Loader2 className="animate-spin" /> : <Plus />}
          Thêm thiết bị
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="h-9 rounded-s-none px-2.5" disabled={pasting} aria-label="Cách thêm thiết bị khác">
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Chưa khai xong thông tin phiếu: chỉ còn tải tệp mẫu (soạn trước được), chưa thêm được. */}
            {locked ? null : (
              <>
                <DropdownMenuItem onSelect={onBrowse}>
                  <ListPlus />
                  Chọn trong danh mục
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                  <FileSpreadsheet />
                  Nhập từ Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => void downloadTemplate()}>
              <Download />
              Tải tệp mẫu Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ một dòng

const COLS = 9;

/**
 * Một dòng của bảng lưới: số lượng, đơn giá, phòng nhận gõ thẳng tại chỗ; ⌄ mở ngay dưới dòng phần chi tiết (model,
 * hãng, bảo hành, hạn dùng / quy cách của vật tư, số serial, nhận khác hoá đơn, hoá đơn riêng).
 */
function LineRow({ control, path, index, catalog, estimate, rooms, schoolId, issues, expanded, onToggle, onRemove, onSplit, separate, priceNo, preview, offset, onPreview, moveTargets, onMove }: {
  /** Đơn giá dự toán của kế hoạch mua sắm (phiếu lập từ kế hoạch) — chỉ là chữ mờ trong ô, không phải giá trị. */
  estimate?: number | null;
  /** Hoá đơn khác của phiếu — chuyển thiết bị sang (khai nhầm hoá đơn). */
  moveTargets: { key: string; label: string }[];
  onMove: (key: string) => void;
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
  // Lô vật tư, hoá chất không quy đổi bao bì: số lượng luôn theo đơn vị tính của danh mục (g, ml…).
  const unitName = catalog?.unit?.name;
  const expiryMissing = tracking === "bulk" && isChemical(line, catalog) && received > 0 && !line?.expiryDate;

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
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
                // Ô hẹp: "~" là dự toán; rê chuột thấy đủ chữ.
                placeholder={estimate ? `~${money.format(estimate)}` : "0"}
                maxValue={numberMax("UNIT_PRICE")}
                aria-label={`Đơn giá dòng ${index + 1}`} aria-invalid={!!fieldState.error || undefined}
                title={fieldState.error?.message ?? (estimate ? `Dự toán theo kế hoạch: ${money.format(estimate)} đ — nhập giá thật theo chứng từ` : undefined)}
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
            title={tracking === "serial" ? `${serialCount}/${received} máy đã có serial — bấm để xem chi tiết`
              : tracking === "bulk" ? "Hạn sử dụng, model, hãng, nơi nhận của lô" : "Model, hãng, bảo hành, nhận khác hoá đơn, hoá đơn riêng"}
            className={cn("hover:bg-muted ms-auto flex h-8 max-w-full items-center gap-1 rounded-md px-2 text-xs tabular-nums",
              serialBad || expiryMissing ? "text-warning-text font-medium" : "text-muted-foreground")}>
            <span className="truncate">
              {tracking === "serial" ? `${serialCount}/${received}`
                : tracking === "bulk" ? (line?.expiryDate ? `HSD ${formatPlainDate(line.expiryDate)}` : expiryMissing ? "Thiếu HSD" : "Chi tiết") : "Chi tiết"}
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
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={COLS} className="px-4 pt-2 pb-5 whitespace-normal">
            <LineDetail control={control} path={path} line={line} catalog={catalog} preview={preview} offset={offset} onSplit={onSplit} rooms={rooms} priceNo={priceNo}
              moveTargets={moveTargets} onMove={onMove} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Phần mở ngay dưới dòng. */
function LineDetail({ control, path, line, catalog, preview, offset, onSplit, rooms, priceNo, moveTargets, onMove }: {
  priceNo?: number;
  moveTargets: { key: string; label: string }[];
  onMove: (key: string) => void;
  control: Control<any>;
  path: string;
  line: any;
  catalog: any;
  preview: Preview | undefined;
  offset: number;
  onSplit: (positions: number[]) => void;
  rooms: Room[];
}) {
  const { setValue } = useFormContext();
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
  return (
    // Dạng HÀNG VÀ CỘT (phương án A, trưởng nhóm 14/11/2026): một hàng ô chung của cả mục, hai liên kết mở ô hiếm dùng,
    // rồi bảng từng thiết bị — không khung thẻ trái / phải.
    <div className="grid gap-3">
      {/* Chưa chọn thiết bị (chưa biết cách quản lý) thì còn hàng ô chung; từng cái và theo lô đều là BẢNG ở dưới. */}
      {tracking !== "serial" && tracking !== "bulk" ? (
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
      </div>
      ) : null}

      {moveTargets.length ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">Chuyển sang</span>
          <Select value="" onValueChange={(v) => { if (v) onMove(v); }}>
            <SelectTrigger size="sm" className="h-8 w-56" aria-label="Chuyển thiết bị sang chứng từ khác"><SelectValue placeholder="Chọn chứng từ khác…" /></SelectTrigger>
            <SelectContent>{moveTargets.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      {tracking === "bulk" ? (
        <LotPanel control={control} path={path} line={line} catalog={catalog} rooms={rooms} received={received}
          code={preview?.code ?? null} reason={line?.catalog?.id ? preview?.reason ?? null : null} offset={offset} priceNo={priceNo} />
      ) : (
        <UnitsPanel control={control} path={path} tracking={tracking} count={unitCount} received={received}
          outcome={intakeLineOutcome(tracking, received)}
          code={preview?.code ?? null} reason={line?.catalog?.id ? preview?.reason ?? null : null} offset={offset} onSplit={onSplit} rooms={rooms} lineRoomId={line?.room?.id ?? null} priceNo={priceNo} />
      )}
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
  // Tiêu đề và ô dùng CÙNG một lưới, cùng khoảng cách cột (gap-x-2); chữ tiêu đề thụt px-3 = lề trong của ô nhập, nên
  // tiêu đề thẳng cột với chữ trong ô (trưởng nhóm 14/11/2026: cột lệch). Cột cuối hẹp dành cho nút chép cả hàng.
  const cols = cn("gap-x-2", received >= 2
    ? "grid-cols-[1.25rem_1.5rem_10rem_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_minmax(8rem,1.4fr)_11rem_1.5rem]"
    : "grid-cols-[1.5rem_10rem_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_minmax(8rem,1.4fr)_11rem_1.5rem]");
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
  const roomName = (id: number | null) => (id == null ? "Kho thiết bị" : rooms.find((r) => r.id === id)?.name ?? "…");
  // Sao chép chỉ dùng khi đã ĐÁNH DẤU thiết bị (trưởng nhóm 14/11/2026): giá trị ô bấm chép sang đúng các cái đã chọn.
  // Biểu tượng ở từng ô (chép ô đó) và ở cột cuối (chép cả hàng) — như bản 178c8759; không có hàng "Áp cho".
  const targets = (i: number) => chosen.filter((k) => k !== i);
  /** Cột cuối: chép cả hàng (model, hãng, bảo hành, thông tin khác, nơi nhận) sang các cái đã chọn. */
  const copyRow = (i: number, t: number[]) => {
    const vals = Object.fromEntries(UNIT_KEYS.map((k) => [k, valueAt(i, k)])) as UnitInfo;
    const next: UnitInfo[] = Array.from({ length: received }, (_, k) => {
      const cur = units[k] ?? {};
      return Object.fromEntries(UNIT_KEYS.map((x) => [x, cur[x] !== undefined ? cur[x] : valueAt(k, x)])) as UnitInfo;
    });
    for (const k of t) next[k] = { ...vals };
    setValue(`${path}.units`, next, { shouldDirty: true });
    setRooms(t, roomAt(i));
  };
  const same = (a: unknown, b: unknown) => String(a ?? "").trim() === String(b ?? "").trim();
  /**
   * Nút sao chép chỉ ở hàng ĐÃ CHỌN, ô ĐÃ CÓ giá trị, và còn ít nhất một cái chọn KHÁC giá trị — các cái đã giống hết
   * thì không hiện nữa, tránh nhầm là chưa chép (trưởng nhóm 14/11/2026).
   */
  /** Chép chỉ sang những cái chọn CÒN KHÁC giá trị — cái đã giống thì bỏ khỏi danh sách (trưởng nhóm 14/11/2026). */
  const cellTargets = (i: number, key: (typeof UNIT_KEYS)[number]) => targets(i).filter((k) => !same(valueAt(k, key), valueAt(i, key)));
  const rowTargets = (i: number) => targets(i).filter((k) => UNIT_KEYS.some((key) => !same(valueAt(k, key), valueAt(i, key))) || roomAt(k) !== roomAt(i));
  const canCopy = (i: number, key: (typeof UNIT_KEYS)[number]) => {
    const v = valueAt(i, key);
    return picked.has(i) && v != null && String(v).trim() !== "" && cellTargets(i, key).length > 0;
  };
  /** Cột cuối: hiện khi còn cái chọn khác ở bất kỳ ô nào (kể cả nơi nhận). */
  const canCopyRow = (i: number) => picked.has(i) && rowTargets(i).length > 0;
  // Bấm sao chép thì hỏi lại trước khi ghi đè; hộp hỏi nói rõ chép TỪ cái nào SANG cái nào, từng ô thành giá trị gì.
  const [copying, setCopying] = useState<{ from: number; to: number[]; what: string; facts: [string, unknown][]; run: (to: number[]) => void } | null>(null);
  const copyButton = (from: number, to: number[], what: string, facts: [string, unknown][], onCopy: (to: number[]) => void, inline = false) => {
    const label = `Chép ${what} sang ${to.length} thiết bị đã chọn`;
    return (
      <button type="button" onClick={() => setCopying({ from, to, what, facts, run: onCopy })}
        title={label} aria-label={label}
        className={cn("text-primary hover:bg-info-subtle rounded p-0.5", inline ? "mx-auto block" : "absolute top-1/2 right-1 -translate-y-1/2")}>
        <Copy className="size-3.5" />
      </button>
    );
  };
  const listNo = (t: number[]) => (t.length <= 6 ? t.map((k) => k + 1).join(", ") : `${t.slice(0, 5).map((k) => k + 1).join(", ")} và ${t.length - 5} cái khác`);
  /** Enter ở ô serial (máy quét mã vạch tự gõ Enter): xuống ô serial của cái tiếp theo, sang trang nếu cần. */
  const serialId = (i: number) => `${path}-serial-${i}`.replace(/\./g, "-");
  const nextSerial = (i: number) => {
    if (i + 1 >= received) return;
    const p = Math.floor((i + 1) / PAGE);
    if (p !== page) setPageNo(p);
    requestAnimationFrame(() => document.getElementById(serialId(i + 1))?.focus());
  };
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
  const pad = (n: number) => String(n).padStart(4, "0");
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
            cancelLabel="Không chép" confirmLabel="Chép" onConfirm={() => { copying.run(copying.to); setCopying(null); }} />
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
          <div className={cn("bg-muted text-foreground/80 sticky top-0 z-10 grid items-center border-b px-4 py-1.5 text-xs font-semibold", cols)}>
            {canPick ? (
              <Checkbox aria-label="Chọn tất cả" checked={chosen.length === received ? true : chosen.length ? "indeterminate" : false}
                onCheckedChange={(v) => setPicked(v === true ? new Set(Array.from({ length: received }, (_, i) => i)) : new Set())} />
            ) : null}
            <span>#</span>
            <span className="flex items-center gap-1">Mã dự kiến <HelpHint>{why}</HelpHint></span>
            {/* Thụt bằng lề trong của ô nhập (px-3) để tiêu đề thẳng với chữ trong ô. */}
            <span className="truncate px-3">Số serial</span>
            <span className="truncate px-3">Model</span>
            <span className="truncate px-3">Hãng</span>
            <span className="truncate px-3" title="Bảo hành (tháng)">Bảo hành</span>
            <span className="truncate px-3">Thông tin khác</span>
            <span className="truncate px-3">Nhận vào</span>
            <span />
          </div>
          {shown.map((i) => (
            <div key={i} className={cn("grid items-center border-b px-4 py-0.5 last:border-b-0", cols, picked.has(i) && "bg-info-subtle")}>
              {canPick ? <Checkbox aria-label={`Chọn thiết bị ${i + 1}`} checked={picked.has(i)} onCheckedChange={() => toggle(i)} /> : null}
              <span className="text-muted-foreground text-sm tabular-nums">{i + 1}</span>
              <span className="truncate font-mono text-xs">
                {split && first != null && first + i <= 9999 ? <SeqCode code={withSeq(code!, first + i)} /> : reason ? <span className="text-warning-text font-sans">—</span> : "…"}
              </span>
              <Input id={serialId(i)} value={slots[i] ?? ""} aria-label={`Số serial thiết bị ${i + 1}`} placeholder="Quét hoặc nhập serial" maxLength={50}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextSerial(i); } }}
                aria-invalid={!!slotError(i) || undefined} title={slotError(i)}
                className={cn(CELL_INPUT, "font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case", UNIT_PH)}
                onChange={(e) => setAt(i, e.target.value)}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (!/\r?\n/.test(t.trim())) return;
                  e.preventDefault();
                  pasteAt(i, t);
                }} />
              <div className="relative min-w-0">
                <Input value={String(valueAt(i, "model") ?? "")} aria-label={`Model thiết bị ${i + 1}`} maxLength={maxLengthOf("SHORT_TEXT", 50)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.model === undefined && "text-muted-foreground")} placeholder="Nhập model"
                  onChange={(e) => setUnit([i], "model", e.target.value)} />
                {canCopy(i, "model") ? copyButton(i, cellTargets(i, "model"), "model", [["Model", valueAt(i, "model")]], (to) => setUnit(to, "model", valueAt(i, "model"))) : null}
              </div>
              <div className="relative min-w-0">
                <Input value={String(valueAt(i, "manufacturer") ?? "")} aria-label={`Hãng thiết bị ${i + 1}`} maxLength={maxLengthOf("SHORT_TEXT", 100)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.manufacturer === undefined && "text-muted-foreground")} placeholder="Nhập hãng"
                  onChange={(e) => setUnit([i], "manufacturer", e.target.value)} />
                {canCopy(i, "manufacturer") ? copyButton(i, cellTargets(i, "manufacturer"), "hãng", [["Hãng", valueAt(i, "manufacturer")]], (to) => setUnit(to, "manufacturer", valueAt(i, "manufacturer"))) : null}
              </div>
              <div className="relative min-w-0">
                <IntInput value={valueAt(i, "warrantyMonths")} aria-label={`Bảo hành thiết bị ${i + 1}`} placeholder="Số tháng"
                  className={cn(CELL_INPUT, "pe-6 text-left text-xs", UNIT_PH)} onChange={(v) => setUnit([i], "warrantyMonths", v)} />
                {canCopy(i, "warrantyMonths") ? copyButton(i, cellTargets(i, "warrantyMonths"), "bảo hành", [["Bảo hành (tháng)", valueAt(i, "warrantyMonths")]], (to) => setUnit(to, "warrantyMonths", valueAt(i, "warrantyMonths"))) : null}
              </div>
              <div className="relative min-w-0">
                <Input value={String(valueAt(i, "otherInfo") ?? "")} aria-label={`Thông tin khác thiết bị ${i + 1}`} maxLength={maxLengthOf("NOTE", undefined)}
                  className={cn(CELL_INPUT, "pe-6 text-xs", UNIT_PH, units[i]?.otherInfo === undefined && "text-muted-foreground")} placeholder="Ghi thêm nếu cần"
                  onChange={(e) => setUnit([i], "otherInfo", e.target.value)} />
                {canCopy(i, "otherInfo") ? copyButton(i, cellTargets(i, "otherInfo"), "thông tin khác", [["Thông tin khác", valueAt(i, "otherInfo")]], (to) => setUnit(to, "otherInfo", valueAt(i, "otherInfo"))) : null}
              </div>
              <div className={cn("min-w-0", unitRooms[i] != null && "[&_button]:text-primary [&_button]:font-medium")} title={unitRooms[i] != null ? "Khác nơi nhận chung của lô" : undefined}>
                <RoomCell value={{ id: roomAt(i), name: roomName(roomAt(i)) }} rooms={rooms} label={`Nhận vào, thiết bị ${i + 1}`}
                  onChange={(v) => setRooms([i], v.id)} />
              </div>
              <div>
                {canCopyRow(i) ? copyButton(i, rowTargets(i), "tất cả thông tin", [["Model", valueAt(i, "model")], ["Hãng", valueAt(i, "manufacturer")], ["Bảo hành (tháng)", valueAt(i, "warrantyMonths")], ["Thông tin khác", valueAt(i, "otherInfo")], ["Nhận vào", roomName(roomAt(i))]], (to) => copyRow(i, to), true) : null}
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

/**
 * Chi tiết của dòng THEO LÔ (vật tư, hoá chất): cùng dạng bảng với "Từng thiết bị" — một hàng, vì cả lô là một mã.
 * Không quy đổi bao bì: số lượng của dòng đã là số theo đơn vị tính của danh mục (g, ml…), lọ / chai chỉ là đồ đựng.
 * Cột riêng của lô là Hạn sử dụng (bắt buộc với hoá chất), thay cho Số serial của thiết bị từng cái.
 */
function LotPanel({ control, path, line, catalog, rooms, received, code, reason, offset, priceNo }: {
  control: Control<any>;
  path: string;
  line: any;
  catalog: any;
  rooms: Room[];
  received: number;
  code: string | null;
  reason: string | null;
  offset: number;
  priceNo?: number;
}) {
  const { setValue } = useFormContext();
  const unit: string = catalog?.unit?.name ?? "";
  const chemical = isChemical(line, catalog);
  const split = code ? splitCode(code) : null;
  const first = split ? split.seq + offset : null;
  const pad = (n: number) => String(n).padStart(4, "0");
  const why = split && first != null
    ? (split.seq > 1 ? `Đã có ${split.seq - 1} thiết bị cùng loại` : "Chưa có thiết bị nào cùng loại")
      + (offset ? `, dòng trên dùng ${offset} số` : "") + ` và STT sẽ bắt đầu là ${pad(first)}`
    : "Mã sinh tự động sau khi duyệt";
  // Lưới giống bảng từng thiết bị, nhưng chỉ những cột có nghĩa với vật tư, hoá chất: không model, không bảo hành.
  // # · mã dự kiến · hạn sử dụng · hãng sản xuất · thông tin khác (quy cách đóng gói, độ tinh khiết…) · nhận vào.
  const cols = "gap-x-2 grid-cols-[1.5rem_10rem_9.5rem_minmax(9rem,1fr)_minmax(12rem,2fr)_11rem]";
  const text = (key: "manufacturer" | "otherInfo", label: string, rule: "SHORT_TEXT" | "NOTE", max: number | undefined, placeholder: string) => (
    <FormField
      control={control}
      name={`${path}.${key}`}
      rules={textRules(rule, label, max ? { max } : undefined)}
      render={({ field, fieldState }) => (
        <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref}
          maxLength={maxLengthOf(rule, max)} placeholder={placeholder} aria-label={label}
          aria-invalid={!!fieldState.error || undefined} title={fieldState.error?.message}
          className={cn(CELL_INPUT, "text-xs", UNIT_PH)} />
      )}
    />
  );
  return (
    <section className="bg-card overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h4 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          {priceNo ? `Đơn giá số ${priceNo}` : "Lô vật tư"} · {received.toLocaleString("vi-VN", { useGrouping: false })} {unit}
        </h4>
        <span className="text-muted-foreground text-xs">Cả lô chung một mã</span>
      </div>
      {received > 0 ? (
        <div className="border-t">
          <div className={cn("bg-muted text-foreground/80 grid items-center border-b px-4 py-1.5 text-xs font-semibold", cols)}>
            <span>#</span>
            <span className="flex items-center gap-1">Mã dự kiến <HelpHint>{why}</HelpHint></span>
            <span className="truncate px-3">Hạn sử dụng{chemical ? <span className="text-destructive"> *</span> : null}</span>
            <span className="truncate px-3">Hãng sản xuất</span>
            <span className="truncate px-3">Thông tin khác</span>
            <span className="truncate px-3">Nhận vào</span>
          </div>
          <div className={cn("grid items-center px-4 py-0.5", cols)}>
            <span className="text-muted-foreground text-sm tabular-nums">1</span>
            <span className="truncate font-mono text-xs">
              {split && first != null && first <= 9999 ? <SeqCode code={withSeq(code!, first)} /> : reason ? <span className="text-warning-text font-sans">—</span> : "…"}
            </span>
            <FormField
              control={control}
              name={`${path}.expiryDate`}
              rules={mergeRules(dateRules("ANY", "Hạn sử dụng"), chemical ? { required: "Hoá chất phải có hạn sử dụng" } : {})}
              render={({ field, fieldState }) => (
                // Ô ngày như mọi ô của bảng: không khung tới khi rê chuột / đang gõ; thiếu thì viền đỏ.
                <div title={fieldState.error?.message} className={cn(fieldState.error && "[&_input]:border-destructive [&_input]:bg-destructive-subtle")}>
                  <DateInput className="max-w-none" inputClassName={cn(CELL_INPUT, "text-xs", UNIT_PH)}
                    value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </div>
              )}
            />
            {text("manufacturer", "Hãng sản xuất", "SHORT_TEXT", 100, "Nhập hãng")}
            {text("otherInfo", "Thông tin khác", "NOTE", undefined, "VD: lọ 500 g, độ tinh khiết 99%")}
            <div className="min-w-0">
              <RoomCell value={line?.room} rooms={rooms} label="Nhận vào"
                onChange={(v) => { setValue(`${path}.room`, v, { shouldDirty: true }); setValue(`${path}.unitRooms`, [], { shouldDirty: true }); }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground border-t px-4 py-3 text-sm">{intakeLineOutcome("bulk", received)}</div>
      )}
    </section>
  );
}

/** `values.lines.3` theo đường dẫn "lines.3". */
function pathValue(values: any, path: string) {
  return path.split(".").reduce((v, k) => v?.[k], values);
}

// ------------------------------------------------------------------ cả bảng

/** "hoá đơn" / "biên bản tặng" / "quyết định giao" / "chứng từ" — tên chứng từ theo nguồn; null = nguồn không có chứng từ. */
/**
 * "3 loại thiết bị · số lượng 25" (trưởng nhóm 14/11/2026): loại = số thiết bị danh mục KHÁC NHAU (một thiết bị tách
 * nhiều đơn giá vẫn là một loại), số lượng = tổng số nhận.
 */
export function countText(rows: any[], short = false): string {
  const kinds = new Set(rows.map((l) => l?.catalog?.id).filter((id) => id != null && id !== "")).size;
  const units = rows.reduce((s, l) => s + Number(l?.receivedQuantity ?? 0), 0);
  return `${kinds} loại${short ? "" : " thiết bị"} · số lượng ${money.format(units)}`;
}

export function documentNoun(code: string | undefined): string | null {
  const label = headFieldsOf(code).documentNo?.label;
  return label ? label.replace(/^Số /, "") : null;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Hoá đơn và thiết bị" của phiếu ghi tăng (254, bản mẫu chốt 14/11/2026): mỗi HOÁ ĐƠN một khối — nhà cung cấp, mã số
 * thuế, số, ngày, nguồn kinh phí, hình thức mua sắm, tệp — và bảng thiết bị của nó ngay dưới; "+ Thêm hoá đơn" ở cuối.
 * Thiết bị khai nhầm hoá đơn thì chuyển sang hoá đơn khác trong phần chi tiết của dòng.
 *
 * <p>Các dòng vẫn là MỘT mảng \`lines\` (mỗi dòng mang \`docKey\`), xếp theo thứ tự hoá đơn — số dòng, mã dự kiến nối
 * tiếp đúng như máy chủ cấp lúc duyệt.
 *
 * @param reveal dòng mà khối "Trước khi trình" muốn mở ({@code at} đổi mỗi lần bấm, để bấm lại vẫn mở)
 */
export function IntakeLinesEditor({ control, catalogs, reveal, name = "lines", open = true, onToggle, locked, intakeId, actions, expandAll }: {
  control: Control<any>;
  /** Khối đang mở (form phiếu cho thu gọn); thu gọn thì chỉ còn tên khối và số thiết bị, tổng tiền. */
  open?: boolean;
  onToggle?: () => void;
  catalogs: Map<number, any>;
  reveal: { index: number; at: number } | null;
  name?: string;
  /** Thông tin phiếu chưa khai xong — lý do, hiện cạnh nút; khi đó chưa thêm thiết bị được. */
  locked?: string;
  /** Phiếu đang sửa (kiểm trùng hoá đơn bỏ qua chính nó). */
  intakeId?: number | null;
  /** Nút thêm ở đầu khối. */
  actions?: React.ReactNode;
  /** Đổi giá trị = mở mọi hoá đơn đang thu gọn (form cần tới một ô bên trong). */
  expandAll?: number;
}) {
  const config = useVoucherForm("equipment_intakes");
  const originId = useWatch({ control, name: "originSource.id" });
  const { origins, ruleOf } = useOriginRules();
  const rule = ruleOf(originId);
  const originCode = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const noun = documentNoun(originCode);
  // Lập từ kế hoạch mua sắm: đơn giá KHÔNG điền sẵn (đó là dự toán, không phải giá thật) — ô đơn giá hiện dự toán làm
  // chữ mờ để người lập so khi gõ giá theo chứng từ / quyết định giao.
  const source = useWatch({ control, name: "source" }) as { resource?: string; id?: number } | null;
  const proposalId = source?.resource === "purchase_proposals" && source.id ? source.id : null;
  const { data: estimates } = useQuery({
    queryKey: ["intake-estimates", proposalId],
    enabled: proposalId != null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await kyInstance.get(`purchase_proposals/${proposalId}/intake-lines`).json<{ catalogId: number; unitPrice: number | null }[]>();
      return new Map(rows.filter((r) => Number(r.unitPrice) > 0).map((r) => [r.catalogId, Number(r.unitPrice)]));
    },
  });
  // Chưa chọn nguồn hình thành, hoặc nguồn không có chứng từ: không có ô nào của chứng từ ở đây (nguồn kinh phí của nguồn
  // không chứng từ đứng ở hàng "Thông tin phiếu"; chưa chọn nguồn thì chưa biết hỏi gì).
  const headless = !originCode || !hasDocumentHead(originCode);
  const { setValue, getValues } = useFormContext();
  const { fields, insert, remove, move } = useFieldArray({
    control,
    name,
    rules: {
      validate: (rows: any[]) => {
        const bad = (rows ?? []).findIndex((l) => lineSaveProblem(l));
        return bad < 0 || `Dòng ${bad + 1}: ${lineSaveProblem(rows[bad])}`;
      },
    },
  });
  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({ control, name: "documents" });
  // Phiếu mới chưa có trường trên form (máy chủ tự gán khi lưu): lấy trường của tài khoản — không thì mã dự kiến không ra.
  const schoolId = (useWatch({ control, name: "school.id" }) as number | null | undefined) ?? getAuthorities()?.schoolId ?? null;
  const lines = (useWatch({ control, name }) ?? []) as any[];
  const documents = (useWatch({ control, name: "documents" }) ?? []) as DocumentForm[];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Hoá đơn đang THU GỌN (theo khoá hoá đơn) — mặc định mở hết; ô bên trong vẫn gắn với form khi thu gọn.
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const fold = (key: string) => setFolded((prev) => {
    const next = new Set(prev);
    if (!next.delete(key)) next.add(key);
    return next;
  });
  // Mở ngay TRONG lần vẽ này (không chờ effect): form trao con trỏ cho ô bên trong ngay sau đó.
  const [seenExpand, setSeenExpand] = useState(expandAll);
  if (expandAll !== seenExpand) {
    setSeenExpand(expandAll);
    if (folded.size) setFolded(new Set());
  }
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const docIndex = (key: string | undefined) => {
    const i = documents.findIndex((d) => d.key === key);
    return i < 0 ? 0 : i;
  };
  const labelOf = (i: number) => {
    const d = documents[i];
    return `${cap(noun ?? "chứng từ")} ${i + 1}${d?.supplier ? ` · ${d.supplier}` : d?.documentNo ? ` · số ${d.documentNo}` : ""}`;
  };

  // Luôn có ít nhất một hoá đơn; dòng chưa thuộc hoá đơn nào (lập từ kế hoạch, Excel, phiếu cũ) vào hoá đơn đầu.
  useEffect(() => {
    if (!documents.length) {
      appendDoc(newDocument(), { shouldFocus: false });
      return;
    }
    const keys = new Set(documents.map((d) => d.key));
    lines.forEach((l, i) => {
      if (l && !keys.has(l.docKey)) setValue(`${name}.${i}.docKey`, documents[0].key);
    });
  }, [documents, lines, name, setValue, appendDoc]);

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
    const docKey = getValues(`${name}.${reveal.index}.docKey`);
    if (docKey) setFolded((prev) => (prev.has(docKey) ? new Set([...prev].filter((k) => k !== docKey)) : prev));
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
   * Tách đơn giá khác: những cái ĐÃ CHỌN thành một mục mới ngay dưới, cùng mã DM, cùng hoá đơn — chép model, hãng, đơn
   * giá, nơi nhận để sửa phần khác; serial đi theo đúng cái đó.
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
    setValue(`${name}.${index}.documentQuantity`, keep, { shouldDirty: true });
    setValue(`${name}.${index}.serialText`, trim(all.filter((i) => !pick.has(i)).map(at)), { shouldDirty: true });
    const roomsOf = (l?.unitRooms ?? []) as (number | null)[];
    setValue(`${name}.${index}.unitRooms`, all.filter((i) => !pick.has(i)).map((i) => roomsOf[i] ?? null), { shouldDirty: true });
    const unitsOf = (l?.units ?? []) as UnitInfo[];
    if (unitsOf.length) setValue(`${name}.${index}.units`, all.filter((i) => !pick.has(i)).map((i) => unitsOf[i] ?? {}), { shouldDirty: true });
    insert(index + 1, {
      ...rest,
      receivedQuantity: k,
      documentQuantity: k,
      serialText: trim(all.filter((i) => pick.has(i)).map(at)),
      unitRooms: all.filter((i) => pick.has(i)).map((i) => roomsOf[i] ?? null),
      units: unitsOf.length ? all.filter((i) => pick.has(i)).map((i) => unitsOf[i] ?? {}) : [],
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

  /** Chỗ chèn dòng mới của hoá đơn \`key\`: ngay sau dòng cuối của hoá đơn đó (hoặc của các hoá đơn trước nó). */
  const insertAt = (current: any[], key: string) => {
    const di = docIndex(key);
    let pos = 0;
    current.forEach((l, i) => { if (docIndex(l?.docKey) <= di) pos = i + 1; });
    return pos;
  };

  /**
   * Thêm thiết bị vào hoá đơn \`key\`: hoá đơn đó đã có ĐÚNG MỘT dòng cùng thiết bị, cùng đơn giá thì cộng số lượng; còn lại
   * (chưa có, đã tách nhiều dòng, khác đơn giá, dòng Excel có model / hãng / thông tin khác) thì thêm dòng.
   */
  const add = (rows: Added[], key: string, roomId?: number | null) => {
    const current = [...((getValues(name) ?? []) as any[])];
    for (const { catalog, quantity = 1, unitPrice, model, manufacturer, otherInfo, fromExcel } of rows) {
      const same = current.filter((l) => Number(l?.catalog?.id) === catalog.id && l?.docKey === key);
      const at = same.length === 1 && !otherInfo && !model && !manufacturer
        // Dòng Excel chỉ gộp khi CÙNG đơn giá (cùng trống hoặc cùng số): dòng trống giá không nhận giá của dòng khác
        // (B12). Chọn từ danh mục (không kèm giá) thì vẫn cộng vào dòng sẵn có.
        && (fromExcel
          ? (unitPrice ?? null) === (same[0]?.unitPrice == null || same[0]?.unitPrice === "" ? null : Number(same[0].unitPrice))
          : unitPrice == null || same[0]?.unitPrice == null || Number(same[0].unitPrice) === Number(unitPrice))
        ? current.indexOf(same[0]) : -1;
      if (at >= 0) {
        const l = current[at];
        const q = Number(l.receivedQuantity ?? 0) + quantity;
        setValue(`${name}.${at}.receivedQuantity`, q, { shouldDirty: true });
        setValue(`${name}.${at}.documentQuantity`, q, { shouldDirty: true });
        if (fromExcel) setValue(`${name}.${at}.fromExcel`, true);
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
        docKey: key,
      };
      const pos = insertAt(current, key);
      insert(pos, line, { shouldFocus: false });
      current.splice(pos, 0, line);
    }
  };

  /** Chuyển một thiết bị sang hoá đơn khác: đổi \`docKey\` và dời dòng xuống cuối hoá đơn đó. */
  const moveLine = (index: number, key: string) => {
    const current = [...((getValues(name) ?? []) as any[])];
    setValue(`${name}.${index}.docKey`, key, { shouldDirty: true });
    const rest = current.filter((_, i) => i !== index);
    const pos = insertAt(rest, key);
    if (pos !== index) move(index, pos);
  };

  /** Xoá hoá đơn cùng các thiết bị của nó. */
  const dropDocument = (di: number) => {
    const key = documents[di]?.key;
    const idx = lines.map((l, i) => (l?.docKey === key ? i : -1)).filter((i) => i >= 0);
    if (idx.length) remove(idx);
    removeDoc(di);
  };

  /**
   * Hoá đơn điện tử vừa chọn ở ô "Tệp hoá đơn" của MỘT hoá đơn: điền nhà cung cấp, mã số thuế, số, ngày vào chính hoá đơn
   * đó — chỉ những ô còn trống, không đè thứ người dùng đã gõ — và thêm các thiết bị đã ghép vào hoá đơn đó. Tệp XML đã
   * nằm trong ô tệp, không thêm lại.
   */
  const importInvoice = (r: InvoiceImport, key: string) => {
    const di = documents.findIndex((d) => d?.key === key);
    if (di < 0) return;
    const head = { supplier: r.supplier, taxCode: r.taxCode, contact: r.contact, documentNo: r.documentNo, documentDate: r.documentDate };
    for (const [k, v] of Object.entries(head)) {
      const current = getValues(`documents.${di}.${k}`);
      if (v && (current == null || String(current).trim() === "")) setValue(`documents.${di}.${k}`, v, { shouldDirty: true, shouldValidate: true });
    }
    add(r.rows.map((x) => ({ catalog: x.catalog, quantity: x.quantity, unitPrice: x.unitPrice })), key);
  };
  const invoiceReader = useInvoiceReader(importInvoice);

  const browsingDoc = browsing ? documents.find((d) => d.key === browsing) : undefined;
  const chosen = new Set<number>(lines.filter((l) => l?.docKey === browsing).map((l) => Number(l?.catalog?.id)).filter((id) => Number.isFinite(id)));
  const purchase = isPurchaseCode(rule?.code);

  return (
    <div>
      <div className={cn("px-5", open ? "pt-4 pb-3" : "py-4")}>
        <SectionHead title={noun ? `Thông tin ${noun} và thiết bị` : "Thông tin thiết bị ghi tăng"} open={open} onToggle={() => onToggle?.()}
          aside={lines.length ? `${noun && documents.length > 1 ? `${documents.length} ${noun} · ` : ""}${countText(lines)}` : undefined}
          summary={lines.length ? countText(lines) : <span className="text-destructive">Chưa có thiết bị</span>}
          actions={actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : undefined} />
        {invoiceReader.dialog}
      </div>
      <CatalogPickerDialog
        open={browsing != null}
        onOpenChange={(o) => { if (!o) setBrowsing(null); }}
        schoolId={schoolId}
        exclude={chosen}
        title={browsingDoc && noun && documents.length > 1 ? `Chọn thiết bị cho ${labelOf(docIndex(browsing ?? undefined)).toLowerCase()}` : undefined}
        onPick={(rows, roomId) => {
          if (browsing) add(rows.map((c) => ({ catalog: c })), browsing, roomId);
          setBrowsing(null);
        }}
      />
      <AlertDialog open={removing != null} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        {removing != null ? (
          <ConfirmContent tone="danger" title={`Xoá ${labelOf(removing).toLowerCase()}?`}
            description={`${lines.filter((l) => l?.docKey === documents[removing]?.key).length} thiết bị của ${noun ?? "chứng từ"} này cũng bị xoá khỏi phiếu. Muốn giữ thiết bị thì chuyển chúng sang ${noun ?? "chứng từ"} khác trước.`}
            cancelLabel="Không xoá" confirmLabel="Xoá" onConfirm={() => { dropDocument(removing); setRemoving(null); }} />
        ) : null}
      </AlertDialog>
      <div className={cn("grid gap-4 px-5 pt-1 pb-5", !open && "hidden")}>
        {docFields.map((docField, di) => {
          const doc = documents[di];
          if (!doc) return null;
          const docLines = fields.map((f, i) => ({ f, i })).filter(({ i }) => lines[i]?.docKey === doc.key);
          const isFolded = !!noun && folded.has(doc.key);
          const others = documents.map((d, j) => ({ key: d.key, label: labelOf(j) })).filter((d) => d.key !== doc.key);
          return (
            <section key={docField.id} className="bg-card @container overflow-hidden rounded-lg border" data-field={`documents.${di}`}>
              {noun ? (
                <header className={cn("bg-surface-subtle flex items-center gap-3 px-4 py-2", !isFolded && "border-b")}>
                  <button type="button" onClick={() => fold(doc.key)} aria-expanded={!isFolded}
                    title={isFolded ? `Mở ${noun} này` : `Thu gọn ${noun} này`}
                    className="hover:bg-muted -ms-1.5 me-auto flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-start">
                    <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isFolded && "-rotate-90")} />
                    <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{cap(noun)} {di + 1}</span>
                    {/* Không nhắc lại các ô ngay bên dưới (trưởng nhóm 14/11/2026, CLAUDE.md): tóm tắt chỉ khi THU GỌN — lúc đó
                        các ô bị ẩn, cần biết hoá đơn nào. */}
                    {isFolded ? (
                      <span className="text-muted-foreground min-w-0 truncate text-sm">
                        {[doc.supplier, doc.documentNo ? `Số ${doc.documentNo}` : null].filter(Boolean).join(" · ") || "Chưa khai"}
                      </span>
                    ) : null}
                  </button>
                  <span className="text-muted-foreground hidden text-sm whitespace-nowrap tabular-nums sm:inline">
                    {docLines.length ? countText(docLines.map(({ i }) => lines[i])) : "Chưa có thiết bị"}
                  </span>
                  {documents.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" className="hover:text-destructive size-8" title={`Xoá ${noun} này`}
                      onClick={() => (docLines.length ? setRemoving(di) : removeDoc(di))}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </header>
              ) : null}
              <div className={cn(isFolded && "hidden")}>
                {/* Nguồn không có chứng từ: ô duy nhất (nguồn kinh phí) đã đứng ở hàng "Thông tin phiếu". */}
                {headless ? null : (
                  <div className="p-4">
                    <DocumentFields control={control} index={di} schoolId={schoolId} intakeId={intakeId} />
                  </div>
                )}
                {/* Nút thêm thiết bị ở ĐẦU bảng (trưởng nhóm 14/11/2026). */}
                <div className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-2.5", !headless && "border-t")}>
                  <span className="text-sm font-medium">
                    Thiết bị
                    {docLines.length ? <span className="text-muted-foreground ms-1.5 font-normal tabular-nums">({countText(docLines.map(({ i }) => lines[i]), true)})</span> : null}
                  </span>
                  <LinesToolbar locked={locked} onAdd={(rows) => add(rows, doc.key)} onBrowse={() => setBrowsing(doc.key)} />
                </div>
                <div className="overflow-x-auto border-t">
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
                        <TableHead className="pe-4 text-right" title={purchase ? "Hàng mua phải có đơn giá" : undefined}>
                          Đơn giá{purchase ? <span className="text-destructive"> *</span> : null}
                        </TableHead>
                        <TableHead className="text-right">Thành tiền</TableHead>
                        {/* Chi tiết bắt buộc mở: nơi nhận của thiết bị chọn ở trong (trưởng nhóm 14/11/2026). */}
                        <TableHead className="pe-3 text-right" title="Chọn nơi nhận của thiết bị trong phần chi tiết">Chi tiết <span className="text-destructive">*</span></TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docLines.length === 0 ? (
                        <TableEmpty colSpan={COLS} compact icon={<PackageSearch />} title="Chưa có thiết bị"
                          description={locked ?? (purchase
                            ? "Thêm thiết bị, hoặc chọn tệp XML hoá đơn điện tử ở ô Tệp hoá đơn."
                            : "Thêm thiết bị trong danh mục, hoặc nhập từ Excel.")} />
                      ) : docLines.map(({ f: field, i: index }) => {
                        const l = lines[index];
                        const catalog = l?.catalog?.id ? catalogs.get(Number(l.catalog.id)) : undefined;
                        const same = (x: any) => l?.catalog?.id != null && x?.catalog?.id != null && Number(x.catalog.id) === Number(l.catalog.id) && x?.docKey === l?.docKey;
                        return (
                          <Fragment key={field.id}>
                            <LineRow
                              control={control}
                              path={`${name}.${index}`}
                              index={index}
                              catalog={catalog}
                              estimate={estimates?.get(Number(l?.catalog?.id)) ?? null}
                              rooms={rooms}
                              schoolId={schoolId}
                              issues={lineIssues(l, catalog, config, doc.fundingSource, rule)}
                              expanded={expanded.has(field.id)}
                              onToggle={() => setExpanded((prev) => {
                                const next = new Set(prev);
                                if (!next.delete(field.id)) next.add(field.id);
                                return next;
                              })}
                              onRemove={() => remove(index)}
                              onSplit={(positions) => split(index, positions)}
                              separate={lines.slice(0, index).some(same)}
                              priceNo={lines.filter(same).length > 1 ? lines.slice(0, index).filter(same).length + 1 : undefined}
                              preview={previews[field.id]}
                              offset={offsetOf(index)}
                              onPreview={reporter(field.id)}
                              moveTargets={noun ? others : []}
                              onMove={(key) => moveLine(index, key)}
                            />
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Tệp của hoá đơn: sau bảng thiết bị, vùng thả một dòng. */}
                {noun ? (
                  <div className="border-t px-4 py-3">
                    <DocumentFiles control={control} index={di}
                      onInvoiceXml={purchase && !locked ? (file) => invoiceReader.read(file, doc.key) : undefined} />
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
        {/* Thêm hoá đơn: ngay dưới hoá đơn cuối — chỗ người dùng vừa khai xong (trưởng nhóm 14/11/2026). */}
        {noun ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" className="h-9" onClick={() => appendDoc(newDocument(), { shouldFocus: false })}>
              <Plus />
              Thêm {noun}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
