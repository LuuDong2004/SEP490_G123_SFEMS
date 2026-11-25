import { useCustom, useList } from "@refinedev/core";
import { History, Lock, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { isXmlFile } from "./invoice-xml";
import { ChoiceWithNote } from "@/shared/components/form/choice-with-note";
import { HelpHint } from "@/shared/components/form/help-hint";
import { DateInput } from "@/shared/components/form/date-input";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { formatPlainDate } from "@/shared/lib/format";
import { maxLengthOf, textError, textRules } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ui/popover";
import { FUNDING_LABELS, FUNDING_OPTIONS, OTHER_ACQUISITION_CODE } from "@/domains/equipment/types";
import { AcquisitionChoice } from "./acquisition-choice";
import { CENTRALIZED_METHOD_CODE, documentDateRules, documentNoRules, headFieldsOf, isCentralized } from "./head-fields";
import { isPurchaseCode } from "./readiness";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SupplierHint = { name: string; taxCode: string | null; contact: string | null; fundingSource: string | null; acquisitionMethod: { id: number; code?: string; name?: string } | null; lastDate: string | null };
type Duplicate = { intakeId: number; code: string | null; status: string; intakeDate: string; docNo: number };

/** Giá trị trễ `ms` sau lần gõ cuối — gợi ý không hỏi máy chủ theo từng phím. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const listOf = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/**
 * Ô nhà cung cấp có DANH BẠ (254): gõ tên hoặc mã số thuế, hiện các nhà cung cấp trường đã mua (lần gần nhất trước);
 * chọn một là điền tên, mã số thuế, và — nếu hoá đơn chưa chọn — nguồn kinh phí, hình thức mua sắm của lần mua đó.
 */
function SupplierInput({ value, onChange, onBlur, name, inputRef, schoolId, onPick, placeholder, invalid }: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  name: string;
  inputRef: (el: HTMLInputElement | null) => void;
  schoolId: number | null;
  onPick: (h: SupplierHint) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(value.trim());
  const { result } = useCustom<SupplierHint[]>({
    url: `${API_URL}/equipment_intakes/suppliers`,
    method: "get",
    config: { query: { ...(schoolId ? { schoolId } : {}), q } },
    queryOptions: { enabled: open, staleTime: 60_000, retry: false },
  });
  const hints = listOf<SupplierHint>(result?.data).filter((h) => h.name.trim().toLowerCase() !== value.trim().toLowerCase() || !value);
  const show = open && hints.length > 0;
  const pick = (h: SupplierHint) => {
    onPick(h);
    setOpen(false);
  };
  return (
    <Popover open={show} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input value={value} name={name} ref={inputRef} autoComplete="off" maxLength={200} placeholder={placeholder}
          aria-invalid={invalid || undefined} role="combobox" aria-expanded={show} aria-autocomplete="list"
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { onBlur(); setTimeout(() => setOpen(false), 120); }}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hints.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(hints[active]); }
            else if (e.key === "Escape") setOpen(false);
          }} />
      </PopoverAnchor>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-80 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <p className="text-muted-foreground flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs"><History className="size-3.5" />Đã mua trước đây</p>
        <ul role="listbox" className="max-h-64 overflow-y-auto">
          {hints.map((h, i) => (
            <li key={`${h.taxCode ?? ""}-${h.name}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}
                className={cn("grid w-full gap-0.5 rounded-md px-2 py-1.5 text-start", i === active && "bg-accent")}>
                <span className="truncate text-sm font-medium">{h.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {[h.contact, h.taxCode ? `MST ${h.taxCode}` : null, h.fundingSource ? FUNDING_LABELS[h.fundingSource] ?? h.fundingSource : null,
                    h.lastDate ? `lần cuối ${formatPlainDate(h.lastDate)}` : null].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Liên hệ: có "@" thì kiểm như email, không thì như số điện thoại — cùng bộ quy tắc chuẩn và cùng cách máy chủ
 * (`EquipmentIntakeService.contactProblem`).
 */
const contactRule = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s) return true;
  const bad = s.includes("@") ? textError("EMAIL", "Email", s) : textError("PHONE", "Số điện thoại", s);
  return bad ? "Điện thoại / Email không hợp lệ (vd. 0912 345 678 hoặc ten@congty.vn)" : true;
};

/**
 * Ô trong hàng hoá đơn: co được dưới bề rộng nội dung khi xếp thành một hàng, và MỖI Ô CÓ TRẦN `max-w` — nguồn chỉ có
 * một hai ô (Đơn vị tự làm → chỉ Nguồn kinh phí) thì ô không kéo hết hàng (trưởng nhóm 14/11/2026, CLAUDE.md).
 */
const CELL = "min-w-0";

/**
 * Các ô của MỘT hoá đơn (chứng từ) trên form (254): bên giao (nhà cung cấp có danh bạ / đơn vị tặng…), mã số thuế,
 * số, ngày, nguồn kinh phí, hình thức mua sắm — MỘT HÀNG khi khối đủ rộng, mỗi ô rộng theo nội dung (trưởng nhóm
 * 14/11/2026: ô dài ngoằng). Tệp của hoá đơn là `DocumentFiles`, đặt dưới bảng thiết bị. Ô nào có tuỳ nguồn hình
 * thành (`headFieldsOf`); nguồn chỉ cho một nguồn kinh phí (tặng → tài trợ) thì ô khoá và tự điền.
 */
export function DocumentFields({ control, index, schoolId, intakeId }: {
  control: Control<any>;
  index: number;
  schoolId: number | null;
  /** Phiếu đang sửa — kiểm trùng hoá đơn bỏ qua chính nó. */
  intakeId?: number | null;
}) {
  const path = `documents.${index}`;
  const { setValue } = useFormContext();
  const { origins, ruleOf } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = ruleOf(originId);
  const code = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const head = headFieldsOf(code);
  const purchase = isPurchaseCode(code);
  const doc = useWatch({ control, name: path }) as any;
  const name = (k: string) => `${path}.${k}`;
  // Cấp trên mua tập trung: số / ngày hoá đơn có thì ghi; hình thức khoá "Mua sắm tập trung" (tự điền).
  const centralized = isCentralized(code, useWatch({ control, name: "details.centralized" }));
  const invoiceRequired = purchase && !centralized;
  const { result: centralMethods } = useList<any>({
    resource: "acquisition_methods",
    filters: [{ field: "code", operator: "eq", value: CENTRALIZED_METHOD_CODE }],
    pagination: { pageSize: 5 },
    queryOptions: { enabled: centralized },
  });
  const centralMethod = (centralMethods?.data ?? []).find((m: any) => m.code === CENTRALIZED_METHOD_CODE);
  useEffect(() => {
    if (centralized && centralMethod && doc?.acquisitionMethod?.id !== centralMethod.id) {
      setValue(name("acquisitionMethod"), { id: centralMethod.id, code: centralMethod.code, name: centralMethod.name }, { shouldDirty: true });
      setValue(name("acquisitionNote"), "", { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralized, centralMethod?.id, doc?.acquisitionMethod?.id]);

  const allowed = rule?.fundingSources ?? FUNDING_OPTIONS;

  // Hoá đơn trùng: cùng số của cùng nhà cung cấp đã ghi tăng ở phiếu khác — cảnh báo, không chặn.
  const dupNo = useDebounced(String(doc?.documentNo ?? "").trim(), 500);
  const dupTax = useDebounced(String(doc?.taxCode ?? "").trim(), 500);
  const dupSupplier = useDebounced(String(doc?.supplier ?? "").trim(), 500);
  const { result: dupResult } = useCustom<Duplicate[]>({
    url: `${API_URL}/equipment_intakes/duplicate-documents`,
    method: "get",
    config: { query: { ...(schoolId ? { schoolId } : {}), documentNo: dupNo, taxCode: dupTax, supplier: dupSupplier, ...(intakeId ? { excludeId: intakeId } : {}) } },
    queryOptions: { enabled: !!head.documentNo && !!dupNo && !!(dupTax || dupSupplier), staleTime: 30_000, retry: false },
  });
  const duplicates = listOf<Duplicate>(dupResult?.data);

  const pickSupplier = (h: SupplierHint) => {
    setValue(name("supplier"), h.name, { shouldDirty: true, shouldValidate: true });
    if (h.taxCode) setValue(name("taxCode"), h.taxCode, { shouldDirty: true });
    if (h.contact && !doc?.contact) setValue(name("contact"), h.contact, { shouldDirty: true, shouldValidate: true });
    if (!doc?.fundingSource && h.fundingSource && allowed.includes(h.fundingSource)) setValue(name("fundingSource"), h.fundingSource, { shouldDirty: true });
    if (rule?.acquisitionMethod && !doc?.acquisitionMethod?.id && h.acquisitionMethod?.id) setValue(name("acquisitionMethod"), h.acquisitionMethod, { shouldDirty: true });
  };

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-x-4 gap-y-5 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:flex">
        {head.supplier ? (
          <FormField
            control={control}
            name={name("supplier")}
            rules={textRules("SHORT_TEXT", head.supplier, { max: 200, min: 2 })}
            render={({ field, fieldState }) => (
              <FormItem data-field={name("supplier")} className={cn(CELL, "@5xl:max-w-[28rem] @5xl:flex-[1.6_1_0%]")}>
                <FormLabel required={purchase || undefined}>{centralized ? "Nhà cung cấp (nhà thầu)" : head.supplier}</FormLabel>
                {purchase ? (
                  <SupplierInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} inputRef={field.ref}
                    schoolId={schoolId} onPick={pickSupplier} placeholder="Gõ tên nhà cung cấp" invalid={!!fieldState.error} />
                ) : (
                  <FormControl>
                    <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                      maxLength={200} placeholder="Không bắt buộc" />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {purchase ? (
          <FormField
            control={control}
            name={name("contact")}
            rules={{ validate: { contact: contactRule } }}
            render={({ field }) => (
              // Liên hệ nhà cung cấp — số điện thoại HOẶC email (trưởng nhóm 14/11/2026), thay cho mã số thuế.
              <FormItem data-field={name("contact")} className={cn(CELL, "@5xl:max-w-[16rem] @5xl:flex-[1.1_1_0%]")}>
                <FormLabel>Điện thoại / Email</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}
                    name={field.name} ref={field.ref} maxLength={maxLengthOf("EMAIL")} placeholder="VD: 0912 345 678" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {head.documentNo ? (
          <FormField
            control={control}
            name={name("documentNo")}
            rules={documentNoRules(head)}
            render={({ field }) => (
              <FormItem data-field={name("documentNo")} className={cn(CELL, "@5xl:max-w-[14rem] @5xl:flex-[0.9_1_0%]")}>
                <FormLabel required={invoiceRequired || undefined}>{head.documentNo!.label}</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                    maxLength={head.documentNo!.invoice ? maxLengthOf("INVOICE_NO") : 100}
                    placeholder={centralized ? "Nếu có" : head.documentNo!.invoice ? "VD: 0001234" : "Không bắt buộc"} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {head.documentDate ? (
          <FormField
            control={control}
            name={name("documentDate")}
            rules={documentDateRules(head.documentDate)}
            render={({ field }) => (
              <FormItem data-field={name("documentDate")} className={cn(CELL, "@5xl:w-[9.5rem] @5xl:flex-none")}>
                <FormLabel required={invoiceRequired || undefined}>{head.documentDate}</FormLabel>
                <FormControl>
                  <DateInput className="max-w-none" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <DocumentFunding control={control} index={index} className={cn(CELL, "@5xl:max-w-[20rem] @5xl:flex-[1.3_1_0%]")} />
        {rule?.acquisitionMethod && centralized ? (
          <div data-field={name("acquisitionMethod")} className={cn("grid gap-2", CELL, "@5xl:max-w-[16rem] @5xl:flex-[1_1_0%]")}>
            <Label>Hình thức mua sắm</Label>
            <div className="relative">
              <Input disabled value={centralMethod?.name ?? "Mua sắm tập trung"} aria-label="Hình thức mua sắm" className="pe-8" />
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
            </div>
          </div>
        ) : rule?.acquisitionMethod ? (
          <div data-field={name("acquisitionMethod")} className={cn(CELL, "@5xl:max-w-[20rem] @5xl:flex-[1.3_1_0%]")}>
            <FormField
              control={control}
              name={name("acquisitionNote")}
              rules={doc?.acquisitionMethod?.code === OTHER_ACQUISITION_CODE ? textRules("SHORT_TEXT", "Ghi rõ hình thức mua sắm", { max: 200, min: 5 }) : undefined}
              render={({ fieldState }) => (
                <>
                  <AcquisitionChoice label="Hình thức mua sắm" clearable exclude={rule?.excludedAcquisitionMethods}
                    value={doc?.acquisitionMethod?.id ? doc.acquisitionMethod : null}
                    onChange={(m) => {
                      setValue(name("acquisitionMethod"), m ? { id: m.id, code: m.code, name: m.name } : { id: null }, { shouldDirty: true });
                      if (m?.code !== OTHER_ACQUISITION_CODE) setValue(name("acquisitionNote"), "", { shouldDirty: true });
                    }}
                    note={doc?.acquisitionNote} onNoteChange={(n) => setValue(name("acquisitionNote"), n, { shouldDirty: true, shouldValidate: true })} />
                  {fieldState.error ? <p className="text-destructive mt-2 text-sm">{fieldState.error.message}</p> : null}
                </>
              )}
            />
          </div>
        ) : null}
      </div>

      {duplicates.length ? (
        <div role="status" className="bg-warning-subtle text-warning-text flex items-start gap-2 rounded-md px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Số hoá đơn này của nhà cung cấp này đã ghi tăng ở{" "}
            {duplicates.map((d, i) => (
              <span key={d.intakeId}>
                {i ? ", " : null}
                <Link to={`/equipment-intakes/show/${d.intakeId}`} target="_blank" rel="noopener" className="font-medium underline">
                  {d.code ?? `phiếu nháp #${d.intakeId}`}
                </Link>
                {` (${formatPlainDate(d.intakeDate)})`}
              </span>
            ))}
            . Kiểm tra lại để không ghi tăng hai lần.
          </span>
        </div>
      ) : null}

    </div>
  );
}

/** Vì sao nguồn kinh phí tự điền và khoá, theo nguồn hình thành. */
const FIXED_FUNDING_WHY: Record<string, string> = {
  PHAN_BO: "Tài sản cấp trên giao, bàn giao về thuộc ngân sách nhà nước.",
  TANG_TAI_TRO: "Tài sản được tặng, tài trợ ghi nguồn tài trợ.",
};

/** Nguồn hình thành không có chứng từ (đơn vị tự làm, kiểm kê thừa…): không có ô nào của hoá đơn ngoài nguồn kinh phí. */
export function hasDocumentHead(code: string | undefined) {
  const head = headFieldsOf(code);
  return !!(head.documentNo || head.supplier || head.documentDate);
}

/**
 * Ô "Nguồn kinh phí" của MỘT chứng từ. Đứng trong hàng ô của hoá đơn; nguồn hình thành không có chứng từ (đơn vị tự làm…)
 * thì đứng ngay hàng "Thông tin phiếu" cạnh nguồn hình thành (15/11/2026) — một khối riêng chỉ chứa một ô thì thừa.
 * Nguồn chỉ cho MỘT nguồn kinh phí (được cấp phát, bàn giao → ngân sách, tặng → tài trợ): ô khoá, tự điền; đổi sang nguồn
 * không khoá mà ô vẫn là giá trị máy điền thì gỡ.
 */
export function DocumentFunding({ control, index, className }: { control: Control<any>; index: number; className?: string }) {
  const name = (k: string) => `documents.${index}.${k}`;
  const { setValue } = useFormContext();
  const { ruleOf } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = ruleOf(originId);
  const funding = (useWatch({ control, name: name("fundingSource") }) ?? null) as string | null;
  const allowed = rule?.fundingSources ?? FUNDING_OPTIONS;
  const fundingOptions = [
    ...(funding && !allowed.includes(funding) ? [{ value: funding, label: `${FUNDING_LABELS[funding] ?? funding} (không còn phù hợp)` }] : []),
    ...FUNDING_OPTIONS.filter((v) => allowed.includes(v)).map((v) => ({ value: v, label: FUNDING_LABELS[v] })),
  ];
  const fixedFunding = rule && allowed.length === 1 ? allowed[0] : null;
  const autoFunding = useRef<string | null>(null);
  useEffect(() => {
    if (fixedFunding) {
      autoFunding.current = fixedFunding;
      if (funding !== fixedFunding) setValue(name("fundingSource"), fixedFunding, { shouldDirty: true });
    } else if (autoFunding.current) {
      if (funding === autoFunding.current) setValue(name("fundingSource"), null, { shouldDirty: true });
      autoFunding.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedFunding, funding]);

  // Nguồn hình thành chỉ cho MỘT nguồn kinh phí: không có gì để chọn — ô chỉ xem có khoá và lý do, không dấu *.
  if (fixedFunding) {
    return (
      <div data-field={name("fundingSource")} className={cn("grid content-start gap-2", className)}>
        <span className="flex items-center gap-1.5 text-sm leading-none font-medium">
          Nguồn kinh phí
          <HelpHint>{FIXED_FUNDING_WHY[rule?.code ?? ""] ?? "Nguồn hình thành này chỉ có một nguồn kinh phí."}</HelpHint>
        </span>
        <div className="bg-surface-subtle text-muted-foreground flex h-9 items-center justify-between gap-2 rounded-full border px-3.5 text-sm">
          <span className="truncate">{FUNDING_LABELS[fixedFunding] ?? fixedFunding}</span>
          <Lock className="size-3.5 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <FormField
      control={control}
      name={name("fundingNote")}
      rules={funding === "OTHER" ? textRules("SHORT_TEXT", "Ghi rõ nguồn kinh phí", { max: 200, min: 5 }) : undefined}
      render={({ field: note, fieldState }) => (
        <FormItem data-field={name("fundingSource")} className={className}>
          <FormLabel required={rule?.fundingRequired === "ALWAYS" || undefined}>Nguồn kinh phí</FormLabel>
          <ChoiceWithNote value={funding ?? ""} options={fundingOptions} otherValue="OTHER" disabled={!rule || !!fixedFunding}
            clearable={!fixedFunding} invalid={!!fieldState.error}
            placeholder={rule ? "Vui lòng chọn nguồn kinh phí" : "Chọn nguồn hình thành trước"}
            notePlaceholder="Nguồn khác: ghi rõ" noteMax={maxLengthOf("SHORT_TEXT", 200)}
            onChange={(v) => {
              setValue(name("fundingSource"), v || null, { shouldDirty: true });
              if (v !== "OTHER") setValue(name("fundingNote"), "", { shouldDirty: true });
            }}
            note={note.value} onNoteChange={note.onChange} onNoteBlur={note.onBlur} />
          {!fixedFunding && rule?.fundingRequired === "WHEN_COST" ? <p className="text-muted-foreground text-xs">Bắt buộc khi có chi phí</p> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Tệp của MỘT hoá đơn (chứng từ): vùng thả một dòng, đặt cuối khối hoá đơn — sau bảng thiết bị. Hoá đơn đã lưu thì
 * lưu ngay khi chọn; chưa lưu thì giữ trên form (`pendingFiles`), đẩy lên sau khi lưu phiếu. Nguồn không có chứng từ
 * (không có bên giao, không có số) thì không có ô này.
 *
 * <p>`onInvoiceXml`: hoá đơn mua sắm — chọn tệp XML hoá đơn điện tử ở đây thì đọc luôn (điền nhà cung cấp, số, ngày,
 * ghép thiết bị). Không có nút "Đọc hoá đơn điện tử" riêng: đằng nào cũng phải đính tệp hoá đơn.
 */
export function DocumentFiles({ control, index, onInvoiceXml }: {
  control: Control<any>;
  index: number;
  onInvoiceXml?: (file: File) => void;
}) {
  const path = `documents.${index}`;
  const { setValue } = useFormContext();
  const { origins } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const code = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const head = headFieldsOf(code);
  const purchase = isPurchaseCode(code);
  const doc = useWatch({ control, name: path }) as any;
  const centralized = isCentralized(code, useWatch({ control, name: "details.centralized" }));
  if (!head.documentNo && !head.supplier) return null;
  const files = (doc?.pendingFiles ?? []) as File[];
  const title = purchase ? (centralized ? "Tệp hoá đơn (nếu có)" : "Tệp hoá đơn") : head.documentNo ? `Tệp ${head.documentNo.label.replace(/^Số /, "")}` : "Tệp chứng từ";
  const onAdded = onInvoiceXml ? (list: File[]) => { const xml = list.find(isXmlFile); if (xml) onInvoiceXml(xml); } : undefined;
  return (
    <div data-field={`${path}.files`}>
      {doc?.id ? (
        <AttachmentsPanel field compact resource="equipment_intake_documents" recordId={doc.id} canWrite required={purchase && !centralized} title={title}
          hint="Bản scan hoặc tệp hoá đơn điện tử · lưu ngay khi chọn" onAdded={onAdded} />
      ) : (
        <PendingAttachments field compact files={files} onChange={(f) => setValue(`${path}.pendingFiles`, f, { shouldDirty: true })}
          required={purchase && !centralized} title={title} hint="Tải lên khi lưu phiếu" onAdded={onAdded} />
      )}
    </div>
  );
}
