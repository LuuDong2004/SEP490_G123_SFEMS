import { FormHint } from "@/shared/components/form/help-hint";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { useCustom } from "@refinedev/core";
import { useRef, useState, useEffect } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ListPlus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";

import { CatalogPickerDialog } from "@/features/organization/equipment-intakes/catalog-picker";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { LineDetailsFields } from "@/shared/components/voucher/voucher-details";
import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { DateInput } from "@/shared/components/form/date-input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { dateRules, maxLengthOf, numberRules, textRules, type NumberRule } from "@/shared/lib/field-rules";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { TRACKING_LABELS, intakeLineOutcome, stockQuantityOf } from "@/domains/equipment-intake/types";
import { RefField } from "@/shared/components/catalog/ref-field";
import type { VoucherFormConfig } from "@/domains/voucher/form-types";
import { EMPTY_DOCUMENT, LineDocumentFields, documentOf } from "./line-documents";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { isChemical, lineIssues } from "./readiness";

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
  // Model/hãng là của từng lô — KHÔNG chép từ dòng trước như chứng từ.
  model: null,
  manufacturer: null,
  expiryDate: null,
  // Quy cách bao bì là của từng lô (lọ 100 ml lần này, chai 500 ml lần sau) — không chép từ dòng trước.
  packUnit: { id: null },
  packSize: null,
  room: { id: null },
  ...EMPTY_DOCUMENT,
};

/**
 * Cột của bảng dòng — một chỗ khai báo cho hàng tiêu đề, từng dòng, và bảng của màn xem, để chúng
 * không lệch nhau: # · Thiết bị · Đơn giá · SL · Thành tiền · Đủ — ba cột số liền nhau bên phải (đơn giá × SL =
 * thành tiền). Không có cột Vị trí: hàng ghi tăng luôn về kho thiết bị (QLTB-382).
 */
export const LINES_GRID =
  "grid grid-cols-[1.75rem_minmax(12rem,1fr)_7.5rem_5.5rem_8rem_3.25rem] items-center gap-x-5 [&>*]:min-w-0";

/**
 * Ô số trong DÒNG của bảng không có khung: đọc như một ô của bảng, khung chỉ hiện khi rê chuột hoặc
 * đang gõ. Hai ô có khung ở mỗi dòng làm bảng thành một lưới hộp.
 */
const BARE_INPUT =
  "border-transparent bg-transparent shadow-none hover:border-input hover:bg-field focus-visible:border-ring focus-visible:bg-card " +
  // Ô số không có mũi tên tăng / giảm của trình duyệt: nó chiếm chỗ bên phải và đẩy con số lệch khỏi cột.
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
/**
 * Ô nhập số lùi sang phải đúng bằng phần đệm trong của nó, để CHỮ SỐ trong ô thẳng mép phải với tiêu đề
 * cột và với cột Thành tiền (vốn là chữ trần, sát mép cột). Khung của ô khi rê chuột lấn vào khe cột.
 */
const FLUSH_END = "-me-[calc(--spacing(3)+1px)]";

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

/**
 * Mã dự kiến, cộng phần các dòng trên cùng bộ đếm đã chiếm ({@code offset}). Chỉ là dự kiến: phiếu
 * khác duyệt trước thì lấy mất số; mã thật cấp lúc duyệt.
 */
function CodePreview({ code, offset, count }: { code: string; offset: number; count: number }) {
  const split = splitCode(code);
  if (!split || count <= 0) return null;
  const first = split.seq + offset;
  const last = first + count - 1;
  if (last > 999) return <span className="text-warning-text text-xs font-medium">Bộ mã này không đủ số trong năm</span>;
  const tail = (n: number) => `${String(n).padStart(3, "0")}.${code.split(".")[5]}`;
  return (
    <span className="text-muted-foreground text-xs" title="Mã dự kiến. Mã chính thức có sau khi lãnh đạo duyệt phiếu.">
      Mã dự kiến{" "}
      <span className="text-foreground font-mono">{withSeq(code, first)}</span>
      {count > 1 ? <> → <span className="text-foreground font-mono">…{tail(last)}</span></> : null}
    </span>
  );
}

type Preview = { counter: string | null; code: string | null; reason: string | null };

/** Đơn giá tối đa 12 chữ số (dưới một nghìn tỷ đồng) — đủ cho mọi thiết bị trường học, và thành tiền không tràn ô. */
const MAX_MONEY_DIGITS = 12;

/** Ô số trong bảng / hộp thoại. `money` hiện dấu chấm hàng nghìn khi gõ (12.000.000). */
function NumberInput({ value, onChange, money: isMoney, className, placeholder, ...rest }: {
  value: unknown;
  onChange: (v: number | null) => void;
  money?: boolean;
  className?: string;
  placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Input
      {...rest}
      inputMode={isMoney ? "numeric" : "decimal"}
      type={isMoney ? "text" : "number"}
      className={cn("h-8 text-right tabular-nums", className)}
      placeholder={placeholder}
      value={value == null || value === "" ? "" : isMoney ? money.format(Number(value)) : String(value)}
      onChange={(e) => {
        if (!isMoney) {
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
          return;
        }
        // Ô tiền định dạng lại mỗi lần gõ (12.000.000), nên con trỏ phải được đặt lại đúng chỗ — không
        // thì nó nhảy về cuối và chữ số gõ giữa chừng rơi sai chỗ. Giữ vị trí theo SỐ CHỮ SỐ đứng trước
        // con trỏ, bỏ số 0 ở đầu, và chặn ở MAX_MONEY_DIGITS chữ số (gõ thừa thì bỏ).
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        const digitsBefore = el.value.slice(0, caret).replace(/\D/g, "").replace(/^0+(?=\d)/, "").length;
        const raw = el.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        // Quá số chữ số cho phép: bỏ qua lần gõ này — ô giữ nguyên giá trị cũ, không cắt mất số ở cuối.
        if (raw.length > MAX_MONEY_DIGITS) return;
        onChange(raw === "" ? null : Number(raw));
        requestAnimationFrame(() => {
          const text = el.value;
          let pos = 0;
          for (let seen = 0; pos < text.length && seen < Math.min(digitsBefore, raw.length); pos++) {
            if (/\d/.test(text[pos])) seen++;
          }
          el.setSelectionRange(pos, pos);
        });
      }}
    />
  );
}

/**
 * Một dòng GỌN của bảng: thiết bị, số lượng và đơn giá gõ thẳng tại chỗ (việc làm nhiều nhất),
 * còn lại — chứng từ, vị trí, lệch số lượng, thông tin bổ sung, hoá đơn — trong hộp chi tiết, mở
 * bằng cách bấm vào dòng. Cột cuối nói dòng đã đủ chưa.
 */
function LineRow({ control, base, index, schoolId, catalog, issues, onOpen, onPreview }: {
  control: Control<any>;
  base: string;
  index: number;
  schoolId: number | null;
  catalog: any;
  issues: string[];
  onOpen: () => void;
  onPreview: (p: Preview) => void;
}) {
  const { setValue, getValues } = useFormContext();
  const [catalogId, name, documentQuantity, receivedQuantity, unitPrice, physicalOrDigital, intakeDate] = useWatch({
    control,
    name: [
      `${base}.${index}.catalog.id`,
      `${base}.${index}.name`,
      `${base}.${index}.documentQuantity`,
      `${base}.${index}.receivedQuantity`,
      `${base}.${index}.unitPrice`,
      `${base}.${index}.physicalOrDigital`,
      "intakeDate",
    ],
  });
  const next = useCodePreview(catalogId, schoolId, physicalOrDigital, intakeDate);
  const code = next?.code ?? null;
  const reason = next?.reason ?? null;
  const counter = code ? (splitCode(code)?.counter ?? null) : null;
  useEffect(() => onPreview({ counter, code, reason }), [counter, code, reason, onPreview]);

  const tracking: string | undefined = catalog?.trackingType;
  const received = Number(receivedQuantity ?? 0);
  const mismatch = Number(documentQuantity ?? 0) !== received;
  const amount = unitPrice == null ? null : Number(unitPrice) * received;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      data-row={index}
      onClick={onOpen}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(LINES_GRID, "hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer border-b px-3 py-2 outline-none last:border-b-0")}
    >
      <span className="text-muted-foreground text-center text-sm tabular-nums">{index + 1}</span>
      <div className="min-w-0">
        {/* Một dòng chữ: tên thiết bị. Mã, cách quản lý, số tài sản sẽ sinh nằm ở chú thích khi rê chuột
            và trong hộp chi tiết của dòng — dòng phụ dưới tên chỉ làm bảng rối. */}
        <div
          className="truncate text-sm font-medium"
          title={[
            name || catalog?.name,
            catalog?.code,
            tracking ? TRACKING_LABELS[tracking] : null,
            catalogId && received > 0 ? (tracking === "BULK" ? "1 lô vật tư" : `sinh ${received} tài sản`) : null,
          ].filter(Boolean).join(" · ")}
        >
          {name || catalog?.name || (catalogId ? "Đang tải…" : <span className="text-warning-text">Chưa chọn thiết bị</span>)}
        </div>
      </div>
      <div onClick={stop} onKeyDown={stop} className={FLUSH_END}>
        <NumberInput
          money
          aria-label={`Đơn giá dòng ${index + 1}`}
          className={BARE_INPUT}
          value={unitPrice}
          placeholder="—"
          onChange={(v) => setValue(`${base}.${index}.unitPrice`, v, { shouldDirty: true })}
        />
      </div>
      <div onClick={stop} onKeyDown={stop} className={FLUSH_END}>
        <NumberInput
          aria-label={`Số lượng thực nhận dòng ${index + 1}`}
          className={BARE_INPUT}
          value={receivedQuantity}
          onChange={(v) => {
            // Chưa lệch thì SL hoá đơn đi theo — đa số dòng hai số bằng nhau, khỏi gõ hai lần.
            const path = `${base}.${index}`;
            if (Number(getValues(`${path}.documentQuantity`)) === Number(getValues(`${path}.receivedQuantity`))) {
              setValue(`${path}.documentQuantity`, v, { shouldDirty: true });
            }
            setValue(`${path}.receivedQuantity`, v, { shouldDirty: true });
          }}
        />
        {mismatch ? (
          <div className="text-warning-text mt-0.5 pe-3 text-right text-[0.6875rem] tabular-nums" title="Số lượng trên hoá đơn">HĐ {documentQuantity ?? 0}</div>
        ) : null}
      </div>
      <span className="text-right text-sm font-medium tabular-nums">
        {amount != null && amount > 0 ? money.format(amount) : <span className="text-muted-foreground">—</span>}
      </span>
      <LineStatus issues={issues} />
    </div>
  );
}

/** ✓ khi dòng đủ để trình, ⚠N (rê chuột: còn thiếu gì) khi chưa. */
export function LineStatus({ issues }: { issues: string[] }) {
  if (!issues.length) {
    return (
      <span className="flex justify-center" aria-label="Đủ">
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

/**
 * Quy cách bao bì của vật tư, hoá chất (QLTB-501): "1 [Lọ] = [100] ml". Hoá chất mua theo lọ nhưng dùng theo
 * ml, gam — khai quy cách thì SL và đơn giá của dòng tính theo LỌ, còn lô vào sổ mang số đã quy đổi, nên xuất
 * dùng, ghi tiêu hao trừ được 30 ml chứ không phải trừ cả lọ. Bỏ chọn đơn vị bao bì là không quy đổi.
 */
function PackField({ control, path, line, catalog }: { control: Control<any>; path: string; line: any; catalog: any }) {
  const { setValue } = useFormContext();
  const baseUnit: string = catalog?.unit?.name ?? "đơn vị tính";
  const hasPack = Boolean(line?.packUnit?.id);
  const size = line?.packSize == null || line?.packSize === "" ? null : Number(line.packSize);
  const received = Number(line?.receivedQuantity ?? 0);
  // Tên bao bì vừa chọn — RefField chỉ ghi id vào form; bản ghi đã lưu thì mang sẵn tên.
  const [picked, setPicked] = useState<string | null>(null);
  const packName: string = (hasPack && (picked ?? line?.packUnit?.name)) || "bao bì";
  // "Bỏ chọn" đơn vị bao bì là không quy đổi: xoá luôn lượng, kẻo máy chủ từ chối quy cách khai dở.
  const hadPack = useRef(hasPack);
  useEffect(() => {
    if (hadPack.current && !hasPack && line?.packSize != null) setValue(`${path}.packSize`, null, { shouldDirty: true });
    hadPack.current = hasPack;
  }, [hasPack, line?.packSize, path, setValue]);
  return (
    <>
      <div className="grid gap-2 sm:col-span-6">
        <span className="flex min-h-5 items-center gap-1 text-[0.8125rem] font-medium">
          Quy cách
          <FormHint>{`Mua theo lọ, chai, hộp… thì khai một bao bì chứa bao nhiêu ${baseUnit}. SL và đơn giá ở trên khi đó tính theo bao bì; sổ ghi theo ${baseUnit} để xuất dùng lẻ được.`}</FormHint>
        </span>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_7rem_auto] items-center gap-2">
          <span className="text-muted-foreground text-sm">1</span>
          <RefField control={control} name={`${path}.packUnit`} resource="units" label="Đơn vị bao bì" hideLabel
            placeholder="Không quy đổi" current={line?.packUnit?.id ? line.packUnit : undefined}
            filters={[{ field: "allowsFraction", operator: "eq", value: false }]}
            onPicked={(row) => setPicked(row?.name ?? null)} />
          <span className="text-muted-foreground text-sm">=</span>
          <FormField
            control={control}
            name={`${path}.packSize`}
            rules={numberRules("DECIMAL_QUANTITY", "Quy cách")}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <NumberInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
                    placeholder={hasPack ? "Bắt buộc" : "—"} className="h-9" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className="text-muted-foreground max-w-24 truncate text-sm">{baseUnit}</span>
        </div>
      </div>
      <div className="grid gap-2 sm:col-span-3">
        <span className="flex min-h-5 items-center text-[0.8125rem] font-medium">Vào sổ</span>
        <div className="bg-muted/50 flex h-9 min-w-0 items-center justify-end overflow-hidden rounded-md border px-3 text-sm font-medium tabular-nums">
          <span className="truncate">
            {!hasPack ? `${received.toLocaleString("vi-VN")} ${catalog?.unit?.name ?? ""}`
              : size ? `${stockQuantityOf(received, size).toLocaleString("vi-VN")} ${baseUnit}`
              : <span className="text-muted-foreground font-normal">{`Nhập lượng trong 1 ${packName}`}</span>}
          </span>
        </div>
      </div>
    </>
  );
}

/** Ô số có nhãn trong hộp chi tiết dòng. */
function NumberField({ control, name, label, money: isMoney, placeholder, hint, className, numberRule }: {
  control: Control<any>;
  name: string;
  label: string;
  className?: string;
  money?: boolean;
  placeholder?: string;
  hint?: string;
  numberRule?: NumberRule;
}) {
  const rule = numberRule ?? (isMoney ? "MONEY" : undefined);
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? numberRules(rule, label) : undefined}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs">{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <NumberInput money={isMoney} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
              placeholder={placeholder} className="h-9" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Hộp chi tiết của MỘT dòng — mọi thứ về dòng ở một chỗ: thiết bị, số lượng và giá, vị trí nhận,
 * chứng từ & nguồn, thông tin bổ sung, hoá đơn. Ô nào cũng ghi thẳng vào form (không có "Huỷ"), nên
 * "Xong" chỉ là đóng; chuyển dòng trước / sau mà không phải đóng mở lại.
 */
function LineDialog({ control, base, index, count, schoolId, catalogs, config, issues, preview, offset, onClose, onGo, onRemove }: {
  control: Control<any>;
  base: string;
  index: number;
  count: number;
  schoolId: number | null;
  catalogs: Map<number, any>;
  config: VoucherFormConfig | undefined;
  issues: string[];
  preview: Preview | undefined;
  offset: number;
  onClose: () => void;
  onGo: (index: number) => void;
  onRemove: () => void;
}) {
  const { setValue, getValues } = useFormContext();
  const path = `${base}.${index}`;
  const line = useWatch({ control, name: path }) as any;
  const [picking, setPicking] = useState(false);
  const catalog = line?.catalog?.id ? catalogs.get(Number(line.catalog.id)) : undefined;
  const tracking: string | undefined = catalog?.trackingType;
  const received = Number(line?.receivedQuantity ?? 0);
  const mismatch = Number(line?.documentQuantity ?? 0) !== received;
  const amount = line?.unitPrice == null ? null : Number(line.unitPrice) * received;
  const hasDetails = Boolean(config?.line?.length || Object.keys(config?.lineTables ?? {}).length);

  return (
    <DialogContent size="wide" className="flex flex-col gap-0 overflow-hidden p-0">
      {/* Đầu và chân đứng yên, chỉ phần giữa cuộn: tên dòng, còn thiếu gì và nút Xong luôn trong tầm mắt. */}
      <DialogHeader className="space-y-2.5 border-b px-7 py-4 pe-12">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums">
            Dòng {index + 1}/{count}
          </span>
          <DialogTitle className="min-w-0 truncate">{catalog?.name ?? line?.name ?? "Chọn thiết bị"}</DialogTitle>
        </div>
        <DialogDescription className="sr-only">Chi tiết một dòng của phiếu ghi tăng</DialogDescription>
        {issues.length ? (
          <div className="flex flex-wrap gap-1.5">
            {issues.map((i) => (
              <span key={i} className="bg-warning-subtle text-warning-text rounded-full px-2.5 py-0.5 text-xs font-medium">{i}</span>
            ))}
          </div>
        ) : (
          <span className="text-success-text text-xs font-medium">Dòng này đã đủ để trình</span>
        )}
      </DialogHeader>

      {/* Mọi nhãn trong hộp cùng cỡ chữ và cùng chiều cao, đặt ở MỘT chỗ này: nhãn đến từ ba nguồn (ô
          của form, `RefField` dùng chung, nhãn tự viết) với ba cỡ khác nhau, và nhãn nào có dấu "?" thì
          cao hơn nhãn không có — nên ô trong cùng một hàng lệch nhau vài điểm ảnh. Các nhóm ngăn bằng
          một nét kẻ thay vì bốn khung viền lồng trong khung của hộp thoại. Khoảng cách giữa các ô và các nhóm
          để RỘNG (gap 4, py-5): hộp này mở hàng chục lần mỗi phiếu, ô sít vào nhau thì đọc mỏi và bấm nhầm —
          thà cuộn một chút ở màn thấp còn hơn nhồi cho vừa một màn.
          Mọi nhóm xếp trên lưới 12 cột: hàng nào cũng kín chiều ngang (không còn ô đứng lẻ nửa
          hàng) và cả hộp vừa một màn hình, không phải cuộn; phần giữa chỉ cuộn khi màn hình quá thấp. */}
      <div className="min-h-0 flex-1 divide-y overflow-y-auto px-7 [&_[data-slot=form-label]]:min-h-5 [&_[data-slot=form-label]]:gap-1 [&_[data-slot=form-label]]:text-[0.8125rem] [&_[data-slot=label]]:min-h-5 [&_[data-slot=label]]:text-[0.8125rem]">

      <section className="space-y-4 py-5">
        <h4 className="text-overline text-muted-foreground">Thiết bị, số lượng và vị trí</h4>
        <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-12">
          <div className="grid gap-2 sm:col-span-4">
            <span className="flex min-h-5 items-center text-[0.8125rem] font-medium">Thiết bị trong danh mục</span>
            <Button type="button" variant="outline" className="h-9 w-full justify-between overflow-hidden px-2.5 font-normal" onClick={() => setPicking(true)}>
              <span className={cn("min-w-0 truncate text-left", !catalog && "text-muted-foreground")}>
                {catalog ? catalog.name : line?.catalog?.id ? "Đang tải…" : "Chọn thiết bị…"}
              </span>
              <ChevronDown className="shrink-0 opacity-50" />
            </Button>
          </div>
          <FormField
            control={control}
            name={`${path}.name`}
            rules={textRules("NAME", "Tên trên chứng từ")}
            render={({ field }) => (
              <FormItem className="sm:col-span-4">
                <FormLabel className="text-xs">Tên trên chứng từ</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="= tên trong danh mục"
                    maxLength={maxLengthOf("NAME")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <NumberField control={control} name={`${path}.documentQuantity`} label="SL hoá đơn" numberRule="QUANTITY" className="sm:col-span-2" hint="Số lượng ghi trên hoá đơn / hợp đồng" />
          <NumberField control={control} name={`${path}.receivedQuantity`} label="SL thực nhận" numberRule="QUANTITY_OR_ZERO" className="sm:col-span-2" hint="Lệch với hoá đơn thì ghi lý do" />
          <NumberField control={control} name={`${path}.unitPrice`} label="Đơn giá (đ)" className="sm:col-span-3" money />
          <div className="grid gap-2 sm:col-span-3">
            <span className="flex min-h-5 items-center text-[0.8125rem] font-medium">Thành tiền</span>
            <div className="bg-muted/50 flex h-9 min-w-0 items-center justify-end overflow-hidden rounded-md border px-3 text-sm font-medium tabular-nums"
              title={amount != null && amount > 0 ? `${money.format(amount)} đ` : undefined}>
              <span className="truncate">{amount != null && amount > 0 ? `${money.format(amount)} đ` : "—"}</span>
            </div>
          </div>
          {/* Hạn sử dụng chỉ vật tư tiêu hao, hoá chất có (QLTB-391) — chép xuống lô khi duyệt, để màn
              Thiết bị báo sắp hết hạn. Hoá chất thì bắt buộc lúc trình. */}
          {tracking === "BULK" ? (
            <FormField
              control={control}
              name={`${path}.expiryDate`}
              rules={dateRules("ANY", "Hạn sử dụng")}
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel className="text-xs" required={isChemical(line, catalog)}>Hạn sử dụng</FormLabel>
                  <FormControl>
                    <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          {tracking === "BULK" ? <PackField control={control} path={path} line={line} catalog={catalog} /> : null}
          {mismatch ? (
            <div className="sm:col-span-12">
              <FormField
                control={control}
                name={`${path}.varianceReason`}
                rules={textRules("NOTE", "Lý do lệch số lượng", { max: 255 })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs" required>
                      Lý do lệch số lượng
                    </FormLabel>
                    <FormControl>
                      <Input className="border-warning" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}
                        name={field.name} placeholder="VD: thiếu 2 cái, giao bổ sung sau" maxLength={maxLengthOf("NOTE", 255)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
        </div>
        <CatalogPickerDialog
          mode="single"
          open={picking}
          onOpenChange={setPicking}
          schoolId={schoolId}
          exclude={new Set()}
          onPick={(rows) => {
            const picked = rows[0];
            if (picked) {
              setValue(`${path}.catalog.id`, picked.id, { shouldDirty: true });
              if (!getValues(`${path}.name`) && picked.name) setValue(`${path}.name`, picked.name, { shouldDirty: true });
              // Loại tài sản và vật lý/số đi theo THIẾT BỊ — không có ô nhập ở đây.
              if (picked.assetCategory) setValue(`${path}.assetCategory`, picked.assetCategory, { shouldDirty: true });
              if (picked.physicalOrDigital) setValue(`${path}.physicalOrDigital`, picked.physicalOrDigital, { shouldDirty: true });
            }
            setPicking(false);
          }}
        />
        <p className="bg-muted/50 text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 rounded-md px-3.5 py-2.5 text-xs">
          <span>
            Khi duyệt: <span className="text-foreground">{intakeLineOutcome(tracking, stockQuantityOf(received, line?.packUnit?.id ? line?.packSize : null), line?.packUnit?.id && line?.packSize ? catalog?.unit?.name : undefined)}</span>
          </span>
          {preview?.code ? (
            <CodePreview code={preview.code} offset={offset} count={tracking === "BULK" ? Math.min(received, 1) : received} />
          ) : preview?.reason && line?.catalog?.id ? (
            <span className="text-warning-text">{preview.reason}</span>
          ) : null}
        </p>
      </section>

      {/* Trước chứng từ: nhóm này mang ô bắt buộc (Lý do tăng). Nó thường chỉ có một hai ô, nên đứng chung
          hàng với hoá đơn của dòng — mỗi bên nửa hộp — thay vì mỗi thứ chiếm trọn một hàng gần như trống. */}
      <div className={cn("grid items-start gap-x-8 gap-y-4 py-5", hasDetails && "sm:grid-cols-12")}>
        {hasDetails ? (
          <section className="space-y-4 sm:col-span-5">
            <h4 className="text-overline text-muted-foreground">Lý do và thông tin bổ sung</h4>
            <Controller
              control={control}
              name={`${path}.details`}
              render={({ field }) => (
                <LineDetailsFields config={config} value={field.value} onChange={field.onChange} schoolId={schoolId} />
              )}
            />
          </section>
        ) : null}
        <section className={hasDetails ? "sm:col-span-7" : undefined}>
          {line?.id ? (
            <AttachmentsPanel
              resource="equipment_intake_lines"
              title="Hoá đơn của dòng"
              recordId={line.id}
              canWrite
              compact
              description="Hoá đơn, hợp đồng của dòng hàng này. Xem lại được ở từng tài sản sau khi nhập."
            />
          ) : (
            <div className="space-y-4">
              <h4 className="text-overline text-muted-foreground">Hoá đơn của dòng</h4>
              {/* Có nhãn như ô bên trái để khung nét đứt đứng ngang hàng với ô "Lý do tăng", không nhô lên trên nó. */}
              <div className="space-y-1.5">
                <span className="flex min-h-5 items-center text-[0.8125rem] font-medium">Tệp đính kèm</span>
                <p className="text-muted-foreground flex h-9 items-center rounded-md border border-dashed px-3 text-xs">
                  Lưu phiếu rồi đính kèm hoá đơn của dòng này ở đây.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="py-5">
        <LineDocumentFields control={control} base={base} index={index} />
      </section>

      </div>

      <DialogFooter className="bg-surface-subtle items-center gap-2 border-t px-7 py-3.5 sm:justify-between">
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 />
          Xoá dòng
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" disabled={index === 0} onClick={() => onGo(index - 1)} aria-label="Dòng trước">
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground w-10 text-center text-xs tabular-nums">{index + 1}/{count}</span>
          <Button type="button" variant="outline" size="icon" disabled={index >= count - 1} onClick={() => onGo(index + 1)} aria-label="Dòng sau">
            <ChevronRight />
          </Button>
          <Button type="button" onClick={onClose}>Xong</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

/** Dòng phải có thiết bị, và lệch số lượng phải có lý do — database giữ cả hai, nên lưu nháp cũng phải đủ. */
export function lineSaveProblem(line: any): string | null {
  if (!line?.catalog?.id) return "Chưa chọn thiết bị";
  if (Number(line.documentQuantity ?? 0) !== Number(line.receivedQuantity ?? 0) && !String(line.varianceReason ?? "").trim()) {
    return "Lệch số lượng, phải ghi lý do";
  }
  if (line.receivedQuantity == null || Number(line.receivedQuantity) < 0) return "Số lượng không hợp lệ";
  return null;
}

/**
 * Bảng dòng hàng của phiếu nhập — GỌN: mỗi dòng một hàng (thiết bị, SL, đơn giá, thành tiền, vị
 * trí, trạng thái), bấm vào dòng mở hộp chi tiết. Thêm dòng bằng "Chọn từ danh mục" — chọn nhiều
 * thiết bị một lần, nên dòng nào cũng có thiết bị ngay từ đầu.
 *
 * @param editing chỉ số dòng đang mở (thẻ tóm tắt bên phải mở được một dòng còn thiếu)
 */
export function IntakeLinesEditor({ control, catalogs, editing, onEdit, picking, onPicking, headFunding, name = "lines" }: {
  control: Control<any>;
  catalogs: Map<number, any>;
  editing: number | null;
  onEdit: (index: number | null) => void;
  picking: boolean;
  onPicking: (open: boolean) => void;
  headFunding?: string | null;
  name?: string;
}) {
  const config = useVoucherForm("equipment_intakes");
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = useOriginRules().ruleOf(originId);
  const { fields, append, remove } = useFieldArray({
    control,
    name,
    rules: {
      validate: (rows: any[]) => {
        const bad = (rows ?? []).findIndex((l) => lineSaveProblem(l));
        return bad < 0 || `Dòng ${bad + 1}: ${lineSaveProblem(rows[bad])}`;
      },
    },
  });
  const { getValues } = useFormContext();
  // Dòng mới chép chứng từ của dòng cuối — phần lớn phiếu một nhà cung cấp, một hoá đơn.
  const newLine = (extra: Record<string, unknown> = {}) => {
    const all = (getValues(name) ?? []) as any[];
    return { ...EMPTY_LINE, ...documentOf(all[all.length - 1]), ...extra };
  };
  const schoolId = useWatch({ control, name: "school.id" }) ?? null;
  const lines = (useWatch({ control, name }) ?? []) as any[];

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
      const l = lines[j];
      const q = Number(l?.receivedQuantity ?? 0);
      return sum + (catalogs.get(Number(l?.catalog?.id))?.trackingType === "BULK" ? Math.min(q, 1) : q);
    }, 0);
  };


  const chosen = new Set<number>(lines.map((l) => Number(l?.catalog?.id)).filter((id) => Number.isFinite(id)));
  const issuesOf = (i: number) => {
    const l = lines[i];
    return lineIssues(l, l?.catalog?.id ? catalogs.get(Number(l.catalog.id)) : undefined, config, headFunding, rule);
  };

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
        <StepTitle
          title="Thiết bị nhận"
        />
        {fields.length ? <AddLinesButton label="Thêm thiết bị" onClick={() => onPicking(true)} /> : null}
      </div>

      <CatalogPickerDialog
        open={picking}
        onOpenChange={onPicking}
        schoolId={schoolId}
        exclude={chosen}
        onPick={(rows, roomId) => {
          const first = fields.length;
          for (const c of rows) {
            append(newLine({
              catalog: { id: c.id },
              name: c.name ?? "",
              assetCategory: c.assetCategory ?? null,
              physicalOrDigital: c.physicalOrDigital ?? "PHYSICAL",
              room: { id: roomId },
            }));
          }
          onPicking(false);
          if (rows.length) onEdit(first);
        }}
      />

      {fields.length === 0 ? (
        <AddLinesEmpty label="Thêm thiết bị" hint="Chọn từ danh mục, rồi nhập số lượng" icon={<ListPlus />}
          onClick={() => onPicking(true)} />
      ) : (
        <div className="overflow-x-auto border-t">
          <div className="min-w-[46rem]">
            <div className={cn(LINES_GRID, "bg-surface-subtle text-overline text-muted-foreground border-b px-3 py-2")}>
              <span className="text-center">#</span>
              <span>Thiết bị</span>
              <span className="text-right">Đơn giá</span>
              <span className="text-right" title="Số lượng thực nhận">SL</span>
              <span className="text-right">Thành tiền</span>
              <span className="text-center" title="Đủ để trình chưa">Đủ</span>
            </div>
            {fields.map((field, index) => (
              <LineRow
                key={field.id}
                control={control}
                base={name}
                index={index}
                schoolId={schoolId}
                catalog={lines[index]?.catalog?.id ? catalogs.get(Number(lines[index].catalog.id)) : undefined}
                issues={issuesOf(index)}
                onOpen={() => onEdit(index)}
                onPreview={reporter(field.id)}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={editing != null && editing < fields.length} onOpenChange={(o) => !o && onEdit(null)}>
        {editing != null && editing < fields.length ? (
          <LineDialog
            key={fields[editing].id}
            control={control}
            base={name}
            index={editing}
            count={fields.length}
            schoolId={schoolId}
            catalogs={catalogs}
            config={config}
            issues={issuesOf(editing)}
            preview={previews[fields[editing].id]}
            offset={offsetOf(editing)}
            onClose={() => onEdit(null)}
            onGo={onEdit}
            onRemove={() => {
              const at = editing;
              onEdit(null);
              remove(at);
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
