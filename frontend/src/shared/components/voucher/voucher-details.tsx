import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { SelectOrText } from "@/shared/components/form/select-or-text";
import { useList } from "@refinedev/core";
import { TimeInput } from "@/shared/components/form/time-input";
import { StaffPicker, type StaffPrefer, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { ListPlus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { DateInput } from "@/shared/components/form/date-input";
import { HelpHint } from "@/shared/components/form/help-hint";
import { dateError, inputModeOf, maxLengthOf, numberError, textError, type TextRule } from "@/shared/lib/field-rules";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { DetailField, DetailSection, Details, DetailValue, VoucherFormConfig } from "@/domains/voucher/form-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");
const NONE = "__none__";
/** Phiếu có tới ngần này ô chứng từ thì bày chung MỘT lưới; nhiều hơn thì chia theo mục, có tên mục. */
const FLAT_LIMIT = 14;

type Option = { id: number; name: string };

/**
 * Ô cán bộ của phần chứng từ: ai hay được chọn nhất thì lên đầu hộp chọn. Theo KHOÁ của trường trong
 * cấu hình phiếu — thủ kho là thủ kho / cán bộ thiết bị, chủ tịch hội đồng là lãnh đạo, người dùng là giáo viên.
 */
const STAFF_PREFER: Record<string, StaffPrefer> = {
  warehouseKeeper: "keeper",
  receivedBy: "keeper",
  toManager: "keeper",
  councilChair: "leader",
  confirmedBy: "leader",
  consumedBy: "teacher",
};
type Lookups = { staff: StaffRow[]; rooms: Option[]; schools: Option[] };

/** Danh sách cho ô chọn cán bộ / phòng / trường — theo trường của phiếu. */
function useLookups(schoolId: number | null | undefined, needsSchools: boolean): Lookups {
  const filters = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }, { field: "active", operator: "eq" as const, value: true }] : [];
  const staff = useList<any>({ resource: "staff", filters, pagination: { pageSize: 500 }, queryOptions: { enabled: !!schoolId } });
  const rooms = useList<any>({ resource: "rooms", filters, pagination: { pageSize: 500 }, queryOptions: { enabled: !!schoolId } });
  const schools = useList<any>({ resource: "schools", pagination: { pageSize: 200 }, queryOptions: { enabled: needsSchools } });
  const pick = (r: any): Option[] => (r?.result?.data ?? []).map((x: any) => ({ id: x.id, name: x.name }));
  return { staff: (staff.result?.data ?? []) as StaffRow[], rooms: pick(rooms), schools: pick(schools) };
}

/**
 * Ô cán bộ có lối "Người khác" (`other`): mặc định chọn trong nhân sự của trường; bấm "Người khác" thì gõ họ tên người
 * ngoài danh sách (thành viên mời, người của Sở…) — nút này ở trong hộp chọn. Giá trị: {id, name} khi chọn, {name, other} khi gõ — chuỗi cũ của ô
 * chữ cũng hiện như gõ tay. Lỗi họ tên do form báo dưới ô (detailError — cùng luật máy chủ); ô chỉ tô viền đỏ.
 */
function StaffOrOther({ field, value, onChange, rows }: {
  field: DetailField;
  value: DetailValue;
  onChange: (v: DetailValue) => void;
  rows: StaffRow[];
}) {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as { id?: number | null; name?: string; other?: boolean }) : null;
  const typedNow = typeof value === "string" ? value : obj && obj.id == null && obj.name != null ? obj.name : null;
  const [typing, setTyping] = useState(typedNow != null);
  const label = field.label.charAt(0).toLowerCase() + field.label.slice(1);
  const error = typing && typedNow ? textError("PERSON_NAME", field.label, typedNow, 100, 2) : undefined;
  return (
    <div className="space-y-1">
      {typing ? (
        // Không có nút quay lại: xoá hết chữ (hoặc rời ô khi còn trống) là ô về hộp chọn cán bộ.
        <Input autoFocus value={typedNow ?? ""} placeholder="Họ và tên người khác" maxLength={100} aria-invalid={!!error || undefined}
          onBlur={(e) => { if (!e.target.value.trim()) { setTyping(false); onChange(null); } }}
          onChange={(e) => {
            if (!e.target.value) { setTyping(false); onChange(null); return; }
            onChange({ name: e.target.value, other: true as const });
          }} />
      ) : (
        // Nút "Người khác" nằm TRONG hộp chọn (góc phải hàng lọc): bấm thì hộp đóng, ô chuyển sang gõ họ tên.
        <StaffPicker rows={rows} prefer={STAFF_PREFER[field.key]} label={label}
          value={obj && obj.id != null ? { id: obj.id, name: obj.name } : null}
          onChange={(row) => onChange(row ? { id: row.id, name: row.name } : null)}
          onOther={() => { setTyping(true); onChange(null); }} />
      )}
    </div>
  );
}

/** Câu nhắc của ô chọn còn trống: "Vui lòng chọn <tên ô>". */
const pick = (label: string) => `Vui lòng chọn ${label.charAt(0).toLowerCase()}${label.slice(1)}`;

function RefSelect({ value, onChange, options, placeholder }: {
  value: DetailValue;
  onChange: (v: DetailValue) => void;
  options: Option[];
  placeholder?: string;
}) {
  const current = value && typeof value === "object" && !Array.isArray(value) ? (value as { id: number; name?: string }) : null;
  const merged = current && !options.some((o) => o.id === current.id)
    ? [{ id: current.id, name: current.name ?? `#${current.id}` }, ...options]
    : options;
  return (
    <Select value={current ? String(current.id) : ""}
      onValueChange={(v) => onChange(v === NONE ? null : { id: Number(v), name: merged.find((o) => String(o.id) === v)?.name })}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder ?? "Vui lòng chọn"} /></SelectTrigger>
      <SelectContent>
        {current ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
        {merged.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * Luật kiểm của một trường chứng từ — CÙNG luật `VoucherForms.coerce` ở máy chủ: `rule` của cấu hình (mặc định ô
 * một dòng SHORT_TEXT, ô nhiều dòng LONG_TEXT), trần = `max` hoặc 4000; số nguyên COUNT, tiền MONEY, phần trăm
 * PERCENT; ngày `date: "past"` là không sau hôm nay.
 */
type RuledField = DetailField;

const textRuleOf = (f: RuledField): TextRule => (f.rule as TextRule | undefined) ?? (f.kind === "textarea" ? "LONG_TEXT" : "SHORT_TEXT");
const textMaxOf = (f: RuledField) => f.max ?? 4000;

/** Lỗi của một giá trị chứng từ, đã gắn nhãn — `undefined` khi hợp lệ hoặc còn trống. */
export function detailError(field: DetailField, value: DetailValue | undefined): string | undefined {
  const f = field as RuledField;
  if (value == null || value === "") return undefined;
  switch (f.kind) {
    case "text":
    case "textarea":
      return textError(textRuleOf(f), f.label, value, textMaxOf(f), f.min);
    case "date":
      return dateError(f.date === "past" ? "PAST_OR_TODAY" : "ANY", f.label, value);
    case "staff": {
      // "Người khác": họ tên gõ tay — cùng luật VoucherForms.reference (PERSON_NAME 2–100).
      const typed = typeof value === "string" ? value : !Array.isArray(value) && typeof value === "object" && (value as any).id == null ? (value as any).name : null;
      return f.other && typed ? textError("PERSON_NAME", f.label, typed, 100, 2) : undefined;
    }
    case "integer":
      return numberError("COUNT", f.label, value);
    case "money":
      return numberError("MONEY", f.label, value);
    case "percent":
      return numberError("PERCENT", f.label, value);
    default:
      return undefined;
  }
}

/** Lỗi đầu tiên trong phần chứng từ của phiếu (đầu phiếu và mọi giai đoạn) — để form chặn lưu như máy chủ chặn. */
export function detailsError(config: VoucherFormConfig | undefined, details: Details | undefined): string | undefined {
  if (!config || !details) return undefined;
  for (const f of (config.sections ?? []).flatMap((s) => s.fields)) {
    const e = detailError(f, details[f.key]);
    if (e) return e;
  }
  return undefined;
}

/** Lỗi đầu tiên trong trường chứng từ của MỘT dòng (kể cả bảng con). */
export function lineDetailsError(config: VoucherFormConfig | undefined, details: Details | undefined): string | undefined {
  if (!config || !details) return undefined;
  for (const f of config.line ?? []) {
    const e = detailError(f, details[f.key]);
    if (e) return e;
  }
  for (const [key, columns] of Object.entries(config.lineTables ?? {})) {
    const rows = details[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      for (const c of columns) {
        const e = detailError(c, (row as Record<string, DetailValue>)[c.key]);
        if (e) return e;
      }
    }
  }
  return undefined;
}

function FieldInput({ field, value, onChange, config, lookups }: {
  field: DetailField;
  value: DetailValue;
  onChange: (v: DetailValue) => void;
  config: VoucherFormConfig;
  lookups: Lookups;
}) {
  const error = detailError(field, value);
  return (
    <>
      <FieldControl field={field} value={value} onChange={onChange} config={config} lookups={lookups} />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </>
  );
}

function FieldControl({ field, value, onChange, config, lookups }: {
  field: DetailField;
  value: DetailValue;
  onChange: (v: DetailValue) => void;
  config: VoucherFormConfig;
  lookups: Lookups;
}) {
  const str = value == null ? "" : String(value);
  switch (field.kind) {
    case "textarea":
      return <Textarea rows={1} className="field-sizing-content min-h-9" placeholder={field.placeholder} value={str} maxLength={maxLengthOf(textRuleOf(field), textMaxOf(field))} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <DateInput value={str || undefined} onChange={(v) => onChange(v ?? null)} />;
    case "time":
      return <TimeInput value={str} onChange={(v) => onChange(v || null)} />;
    case "integer":
      return <Input type="number" step={1} placeholder={field.placeholder ?? "Nhập số"} value={str} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "money":
    case "percent":
      return (
        <Input type="number" min={0} max={field.kind === "percent" ? 100 : undefined} step="any" placeholder={field.kind === "percent" ? "0–100" : "Số tiền (đ)"} value={str}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      );
    case "boolean":
      return (
        <div className="flex h-9 items-center">
          <Checkbox checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
        </div>
      );
    case "enum":
      // Ô chọn có mục "Khác" gõ tay (máy chủ gắn `other`); ô tình trạng tài sản thì chỉ chọn trong danh sách.
      if (field.other) {
        return (
          <SelectOrText value={str || null} options={config.enums[field.enum ?? ""] ?? []} clearable
            placeholder={pick(field.label)} onChange={(v) => onChange(v === "" ? null : v)} />
        );
      }
      return (
        <Select value={str} onValueChange={(v) => onChange(v === NONE ? null : v)}>
          <SelectTrigger className="w-full"><SelectValue placeholder={pick(field.label)} /></SelectTrigger>
          <SelectContent>
            {str ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
            {(config.enums[field.enum ?? ""] ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "staff":
      return field.other ? (
        <StaffOrOther field={field} value={value} onChange={onChange} rows={lookups.staff} />
      ) : (
        <StaffPicker
          rows={lookups.staff}
          prefer={STAFF_PREFER[field.key]}
          value={value && typeof value === "object" && !Array.isArray(value) ? (value as { id: number; name?: string }) : null}
          label={field.label.charAt(0).toLowerCase() + field.label.slice(1)}
          onChange={(row) => onChange(row ? { id: row.id, name: row.name } : null)}
        />
      );
    case "room":
      return <RefSelect value={value} onChange={onChange} options={lookups.rooms} placeholder="Vui lòng chọn phòng" />;
    case "school":
      return <RefSelect value={value} onChange={onChange} options={lookups.schools} placeholder="Vui lòng chọn trường" />;
    default:
      // Ô chữ là ô chữ: không gợi ý tên cán bộ / phòng của trường — người ký, người nhận thường là người
      // ngoài trường, và danh sách xổ ra làm ô trông như ô chọn. Cần chọn thì khai kind staff / room.
      return <Input value={str} placeholder={field.placeholder ?? "Nhập"} maxLength={maxLengthOf(textRuleOf(field), textMaxOf(field))} inputMode={inputModeOf(textRuleOf(field))} onChange={(e) => onChange(e.target.value)} />;
  }
}

function visibleSections(config: VoucherFormConfig | undefined, variant?: string | null) {
  return (config?.sections ?? []).filter(
    (s) => !s.inline && (!s.when || (variant != null && s.when.in.includes(variant))),
  );
}

const filled = (v: DetailValue | undefined) =>
  v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Ô nào rộng bao nhiêu trên lưới 4 cột: đoạn văn nửa hàng, chữ dài nửa hàng, còn lại một ô. */
function fieldSpan(f: DetailField, compact?: boolean) {
  if (compact) return f.wide || f.kind === "textarea" ? "sm:col-span-2" : "";
  if (f.kind === "textarea") return "@md:col-span-2";
  return f.wide ? "@md:col-span-2" : "";
}

/**
 * Các mục trường chứng từ của một phiếu, để nhập — theo mẫu của app Jmix cũ.
 *
 * <p>Vẽ thẳng trên form, không sau nút và không gập: một lưới phẳng, ô bắt buộc trước, đoạn văn dài
 * xuống cuối. Dấu * là trường phải có trước khi TRÌNH phiếu — lưu nháp thì chưa bắt buộc.
 */
export function VoucherDetailsFields({ config, value, onChange, schoolId, variant, compact, maxColumns = 4, title = "Thông tin bổ sung", hint = "Không bắt buộc" }: {
  /** Tối đa bao nhiêu cột khi khung rộng — 3 cho khối có sáu ô (biên bản phiếu ghi tăng): đủ 2 hàng, không chừa ô trống. */
  maxColumns?: 3 | 4;
  config: VoucherFormConfig | undefined;
  value: Details | undefined;
  onChange: (next: Details) => void;
  schoolId: number | null | undefined;
  variant?: string | null;
  /** Trong hộp thoại: không tiêu đề, lưới hai cột, mục nào cũng mở. */
  compact?: boolean;
  title?: string;
  hint?: ReactNode;
}) {
  const sections = visibleSections(config, variant);
  const kinds = sections.flatMap((s) => s.fields);
  const lookups = useLookups(schoolId, kinds.some((f) => f.kind === "school"));
  if (!config || sections.length === 0) return null;
  const values = value ?? {};
  const set = (key: string, v: DetailValue) => {
    const next = { ...values };
    if (v == null || v === "") delete next[key];
    else next[key] = v;
    onChange(next);
  };
  // Số cột theo số ô của khối (ô đoạn văn tính hai cột), tối đa `maxColumns`: khối ba ô chia ba cột — chia bốn thì
  // chừa một cột trống bên phải. Ô ngày giãn theo cột (bỏ trần max-w-40 của DateInput) cho thẳng mép với các ô khác.
  const all = sections.flatMap((s) => s.fields);
  const units = all.reduce((n, f) => n + (f.kind === "textarea" ? 2 : 1), 0);
  const cols = all.length <= FLAT_LIMIT ? Math.min(maxColumns, Math.max(1, units)) : maxColumns;
  const grid = compact ? "grid grid-flow-row-dense items-start gap-4 sm:grid-cols-2" : cn("grid grid-flow-row-dense items-start gap-x-4 gap-y-4 [&_[data-date-input]]:max-w-none",
    cols >= 2 && "@md:grid-cols-2", cols >= 3 && "@2xl:grid-cols-3", cols === 4 && "@4xl:grid-cols-4");
  const fieldsOf = (section: DetailSection) => (
    <div className={grid}>
      {section.fields.map((f) => (
        <div key={f.key} className={`space-y-1.5 ${fieldSpan(f, compact)}`}>
          <Label className="gap-1.5 text-xs">
            {f.label}
            {f.required ? <span className="text-destructive ms-0.5">*</span> : null}
            {f.hint ? <HelpHint>{f.hint}</HelpHint> : null}
          </Label>
          <FieldInput field={f} value={values[f.key] ?? null} onChange={(v) => set(f.key, v)} config={config} lookups={lookups} />
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h4 className="text-overline text-muted-foreground">{section.title}</h4>
            {fieldsOf(section)}
          </div>
        ))}
      </div>
    );
  }

  // Mọi ô hiện THẲNG trên form: không hộp gập, không tiêu đề mục cho từng nhóm một hai ô, không số đếm
  // "0/3". MỘT lưới, một nhịp cột:
  //   - ô NGẮN (chữ, số, ngày, ô chọn): mỗi ô đúng MỘT cột, theo thứ tự của cấu hình (ô bắt buộc lên
  //     đầu). Không ô ngắn nào dài hai cột — ô dài chen giữa đẩy ô kế nó xuống hàng và tách đôi những
  //     cặp đi liền nhau ("Từ tiết" cuối hàng trên, "Đến tiết" đầu hàng dưới);
  //   - ô ĐOẠN VĂN: hai cột, xếp SAU các ô ngắn và lấp luôn chỗ còn trống của hàng cuối — không xuống
  //     hàng riêng để lại nửa hàng trắng phía trên. Nó cao bằng một ô (tự giãn khi gõ) nên không lệch.
  // Nhãn luôn một dòng (cắt ba chấm, rê chuột thấy đủ): nhãn hai dòng đẩy ô của nó lệch khỏi hàng.
  const field = (f: DetailField) => (
    <div key={f.key} className={cn("min-w-0 space-y-1.5", f.kind === "textarea" && "@md:col-span-2")}>
      <Label className="min-w-0 gap-1.5" title={f.label}>
        <span className="truncate">
          {f.label}
          {f.required ? <span className="text-destructive ms-0.5">*</span> : null}
        </span>
        {f.hint ? <HelpHint>{f.hint}</HelpHint> : null}
      </Label>
      <FieldInput field={f} value={values[f.key] ?? null} onChange={(v) => set(f.key, v)} config={config} lookups={lookups} />
    </div>
  );
  const fieldsGrid = (fields: DetailField[]) => {
    const short = fields.filter((f) => f.kind !== "textarea").sort((x, y) => Number(!!y.required) - Number(!!x.required));
    const long = fields.filter((f) => f.kind === "textarea");
    return <div className={grid}>{[...short, ...long].map(field)}</div>;
  };
  const heading = (
    <h3 className="flex min-w-0 items-center gap-2 text-base leading-6 font-semibold">
      {title}
      <HelpHint>{hint}</HelpHint>
    </h3>
  );

  if (all.length <= FLAT_LIMIT) {
    return (
      <section className="space-y-4">
        {heading}
        {fieldsGrid(all)}
      </section>
    );
  }

  // Phiếu rất nhiều ô: giữ tên mục làm mốc cho mắt, nhưng vẫn là lưới phẳng — không khung, không gập.
  // Mục chỉ có một hai ô không đứng riêng: nó nhập vào mục đứng trước (hoặc mục kế sau, nếu nó đứng đầu) —
  // một tiêu đề cho một ô lẻ là một hàng gần như trống.
  const groups: DetailSection[] = [];
  for (const section of sections) {
    const previous = groups[groups.length - 1];
    if (previous && (section.fields.length < 3 || previous.fields.length < 3)) {
      groups[groups.length - 1] = {
        ...previous,
        title: previous.fields.length < 3 && section.fields.length >= 3 ? section.title : previous.title,
        fields: [...previous.fields, ...section.fields],
      };
    } else {
      groups.push(section);
    }
  }
  return (
    <section className="space-y-5">
      {heading}
      {groups.map((section) => (
        <div key={section.title} className="space-y-3">
          <h4 className="text-overline text-muted-foreground">{section.title}</h4>
          {fieldsGrid(section.fields)}
        </div>
      ))}
    </section>
  );
}

/** Một giá trị chứng từ thành chữ để đọc hoặc in. */
export function formatDetail(field: DetailField, value: DetailValue, config: VoucherFormConfig): string {
  if (value == null || value === "") return "";
  switch (field.kind) {
    case "date":
      return formatPlainDate(String(value));
    case "money":
      return `${money.format(Number(value))} đ`;
    case "percent":
      return `${value}%`;
    case "boolean":
      return value ? "Có" : "Không";
    case "enum":
      return config.enums[field.enum ?? ""]?.find((o) => o.value === value)?.label ?? String(value);
    case "staff":
    case "room":
    case "school":
      return typeof value === "object" && value && !Array.isArray(value) ? String((value as any).name ?? (value as any).id) : String(value);
    default:
      return String(value);
  }
}

/**
 * Các trường chứng từ ĐÃ ĐIỀN, để xem — một khung, mỗi mục một nhóm nhỏ. Trường trống
 * không hiện: năm khung đầy dấu "—" che mất năm dòng có nghĩa. Phiếu nháp còn thiếu
 * trường bắt buộc thì nói ra ở đây, trước khi người lập bấm trình rồi bị từ chối.
 */
export function VoucherDetailsView({ config, details, variant, draft, title = "Thông tin bổ sung", foldable }: {
  /** Thu gọn được (mặc định đóng), mũi tên ở tiêu đề — màn kiểm đếm dài, các khối phụ đóng sẵn. */
  foldable?: boolean;
  config: VoucherFormConfig | undefined;
  details: Details | undefined;
  variant?: string | null;
  /** Phiếu còn nháp: nhắc các trường bắt buộc chưa điền. */
  draft?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(!foldable);
  if (!config) return null;
  const values = details ?? {};
  const all = visibleSections(config, variant);
  const missing = all.flatMap((s) => s.fields).filter((f) => f.required && !filled(values[f.key]));
  const sections = all
    .map((s): DetailSection => ({ ...s, fields: s.fields.filter((f) => filled(values[f.key])) }))
    .filter((s) => s.fields.length);
  if (!sections.length && !(draft && missing.length)) return null;
  return (
    <Card className={foldable ? cn("gap-0 py-0", open && "pb-4") : undefined}>
      <CardHeader className={foldable ? "px-4 py-3" : "pb-2"}>
        {foldable ? <StepTitle title={title} open={open} onToggle={() => setOpen(!open)} />
          : <CardTitle className="text-sm font-semibold">{title}</CardTitle>}
      </CardHeader>
      {open ? (
      <CardContent className={cn("space-y-5", foldable && "px-4")}>
        {draft && missing.length ? (
          <p className="bg-warning-subtle text-warning-text rounded-md px-3 py-2 text-sm">
            Còn thiếu {missing.length} trường bắt buộc trước khi trình: {missing.map((f) => f.label).join(", ")}.
          </p>
        ) : null}
        {sections.map((s) => (
          <div key={s.title} className="space-y-2">
            {sections.length > 1 || s.title !== title ? <h4 className="text-overline text-muted-foreground">{s.title}</h4> : null}
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {s.fields.map((f) => (
                <div key={f.key} className={f.kind === "textarea" ? "flex flex-col gap-0.5 sm:col-span-2" : "flex flex-col gap-0.5"}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd className="text-foreground text-sm font-medium whitespace-pre-line">{formatDetail(f, values[f.key] ?? null, config)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
      ) : null}
    </Card>
  );
}

/** Các trường chứng từ đã điền, phẳng — cho bản in. */
export function detailFacts(config: VoucherFormConfig | undefined, details: Details | undefined, variant?: string | null) {
  if (!config || !details) return [];
  return visibleSections(config, variant)
    .flatMap((s) => s.fields)
    .filter((f) => details[f.key] != null && details[f.key] !== "")
    .map((f) => ({ label: f.label, value: formatDetail(f, details[f.key], config) }));
}

/** Bảng con trong một dòng (thông số kỹ thuật, phụ kiện của dòng đề xuất mua sắm). */
function SubTable({ columns, rows, onChange, config, lookups }: {
  columns: DetailField[];
  rows: Record<string, DetailValue>[];
  onChange: (rows: Record<string, DetailValue>[]) => void;
  config: VoucherFormConfig;
  lookups: Lookups;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid items-end gap-2" style={{ gridTemplateColumns: `${columns.map((c) => `minmax(0, ${c.grow ?? 1}fr)`).join(" ")} auto` }}>
          {columns.map((c) => (
            <div key={c.key} className="space-y-1">
              {i === 0 ? <Label className="text-xs">{c.label}</Label> : null}
              <FieldInput field={c} value={row[c.key] ?? null} config={config} lookups={lookups}
                onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [c.key]: v } : r)))} />
            </div>
          ))}
          <Button type="button" variant="ghost" size="icon" aria-label="Bỏ dòng" title="Bỏ dòng" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
        <ListPlus />
        Thêm dòng
      </Button>
    </div>
  );
}

const TABLE_TITLES: Record<string, string> = { specs: "Thông số kỹ thuật", accessoryLines: "Phụ kiện kèm theo" };

/** Số trường đã điền / tổng số trường của các mục đầu phiếu — "Khai báo 3/7". */
export function headFillCount(config: VoucherFormConfig | undefined, details: Details | undefined, variant?: string | null) {
  const fields = visibleSections(config, variant).flatMap((s) => s.fields);
  return {
    filled: fields.filter((f) => filled(details?.[f.key])).length,
    total: fields.length,
    missing: fields.filter((f) => f.required && !filled(details?.[f.key])).map((f) => f.label),
  };
}

/**
 * Nút "Chi tiết" trên một dòng phiếu: hộp thoại nhập các trường chứng từ của dòng
 * (và các bảng con của nó, nếu loại phiếu có).
 */
/** Lớp bề rộng của lưới 12 cột — viết sẵn để Tailwind sinh ra (không ghép chuỗi lớp lúc chạy). */
const SPAN_12: Record<number, string> = {
  2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4", 6: "sm:col-span-6", 8: "sm:col-span-8", 12: "sm:col-span-12",
};

/** Ô chữ của DÒNG phiếu (cột riêng của dòng, không nằm trong `details`) đặt vào hộp chi tiết — vd. tên cụ thể, thông số. */
export type LineExtraField = { key: string; label: string; placeholder?: string; max?: number; wide?: boolean };

export function LineDetailsButton({ config, value, onChange, schoolId, title, compact, label = "Chi tiết", buttonClassName, extras, extraValues, onExtraChange, layout }: {
  /** Nút chỉ có biểu tượng (kèm số mục đã điền / còn thiếu) — cho bảng nhiều cột, nơi chữ "Chi tiết" tràn ô. */
  compact?: boolean;
  config: VoucherFormConfig | undefined;
  value: Details | undefined;
  onChange: (next: Details) => void;
  schoolId: number | null | undefined;
  title?: ReactNode;
  /** Chữ trên nút và tiêu đề hộp. */
  label?: string;
  /** Thêm lớp cho nút chữ (vd. màu chữ chính để nút dễ thấy trong bảng). */
  buttonClassName?: string;
  /** Ô của dòng hiện đầu hộp (không bắt buộc), sửa cùng lượt với `details` — Huỷ là bỏ cả hai. */
  extras?: LineExtraField[];
  extraValues?: Record<string, string | null | undefined>;
  onExtraChange?: (next: Record<string, string>) => void;
  /**
   * Bố cục 12 cột do màn gọi đặt: thứ tự và bề rộng (2 / 3 / 4 / 6 / 8 / 12 cột) của từng ô — gồm cả `extras` lẫn ô
   * `details`; ô không có trong danh sách đứng sau, rộng 4. Không truyền thì xếp như cũ (mọi phiếu khác).
   */
  layout?: { key: string; span: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Details>({});
  const [extraDraft, setExtraDraft] = useState<Record<string, string>>({});
  const fields = useMemo(() => config?.line ?? [], [config]);
  const tables = Object.entries(config?.lineTables ?? {});
  const lookups = useLookups(schoolId, false);
  const extraList = extras ?? [];
  if (!extraList.length && (!config || (!fields.length && !tables.length))) return null;
  const filled = fields.filter((f) => value?.[f.key] != null).length + tables.filter(([k]) => Array.isArray(value?.[k]) && (value?.[k] as any[]).length).length
    + extraList.filter((e) => String(extraValues?.[e.key] ?? "").trim()).length;
  const openDialog = () => {
    setDraft({ ...(value ?? {}) });
    setExtraDraft(Object.fromEntries(extraList.map((e) => [e.key, String(extraValues?.[e.key] ?? "")])));
    setOpen(true);
  };
  // Trường bắt buộc của DÒNG nằm sau cái nút này, nên nút phải tự nói là còn
  // thiếu: máy chủ từ chối lúc trình với câu "Dòng 1 còn thiếu: …", và không có
  // dấu hiệu nào ở đây thì người dùng không biết mở cái gì ra để sửa.
  const missing = fields.filter((f) => f.required && value?.[f.key] == null).length;
  const shortFields = fields.filter((f) => !f.wide);
  const wideFields = fields.filter((f) => f.wide);
  return (
    <>
      {compact ? (
        <Button type="button" variant="ghost" size="icon-sm" className="relative" aria-label="Thông tin thêm của dòng" title="Thông tin thêm của dòng"
          onClick={openDialog}>
          <ListPlus />
          {missing || filled ? (
            <span className={cn("absolute -end-0.5 -top-0.5 size-2 rounded-full", missing ? "bg-warning" : "bg-primary")} aria-hidden />
          ) : null}
        </Button>
      ) : (
      <Button type="button" variant="ghost" size="sm" className={buttonClassName} onClick={openDialog}>
        {label}
        {missing ? (
          <Badge variant="warning" className="ms-1">Thiếu {missing}</Badge>
        ) : filled ? (
          <Badge variant="neutral" className="ms-1">{filled}</Badge>
        ) : null}
      </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{label === "Chi tiết" ? "Chi tiết dòng" : label}</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          {layout ? (
            <>
              {/* Bố cục riêng của màn gọi (12 cột): ô của dòng và ô `details` xếp chung theo `layout` — ô ngắn chung một
                  hàng, ô dài cả hàng; bảng con (thông số, phụ kiện) mỗi bảng một khung rộng hết hộp — đứng cạnh nhau thì ô quá hẹp để gõ. */}
              <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-12">
                {[...layout, ...fields.filter((f) => !layout.some((l) => l.key === f.key)).map((f) => ({ key: f.key, span: f.wide ? 12 : 4 }))].map(({ key, span }) => {
                  const extra = extraList.find((e) => e.key === key);
                  const field = extra ? null : fields.find((f) => f.key === key);
                  if (!extra && !field) return null;
                  const wide = span >= 12;
                  return (
                    <div key={key} className={cn("min-w-0 space-y-1.5", SPAN_12[span] ?? "sm:col-span-4")}>
                      <Label className="text-xs">
                        {extra ? extra.label : field!.label}
                        {field?.required ? <span className="text-destructive ms-0.5">*</span> : null}
                      </Label>
                      {extra ? (
                        extra.wide ? (
                          <Textarea rows={3} value={extraDraft[key] ?? ""} maxLength={extra.max} placeholder={extra.placeholder}
                            onChange={(ev) => setExtraDraft((d) => ({ ...d, [key]: ev.target.value }))} />
                        ) : (
                          <Input value={extraDraft[key] ?? ""} maxLength={extra.max} placeholder={extra.placeholder}
                            onChange={(ev) => setExtraDraft((d) => ({ ...d, [key]: ev.target.value }))} />
                        )
                      ) : (
                        <FieldInput field={wide && field!.kind === "text" ? { ...field!, kind: "textarea", rule: textRuleOf(field!) } as RuledField : field!}
                          value={draft[key] ?? null} config={config!} lookups={lookups}
                          onChange={(v) => setDraft((d) => {
                            const next = { ...d };
                            if (v == null || v === "") delete next[key];
                            else next[key] = v;
                            return next;
                          })} />
                      )}
                    </div>
                  );
                })}
              </div>
              {tables.length ? (
                <div className="grid items-start gap-4">
                  {tables.map(([key, columns]) => (
                    <div key={key} className="bg-surface-subtle min-w-0 space-y-2 rounded-lg border p-3">
                      <h4 className="text-overline text-muted-foreground">{TABLE_TITLES[key] ?? key}</h4>
                      <SubTable columns={columns} rows={(draft[key] as Record<string, DetailValue>[] | undefined) ?? []} config={config!} lookups={lookups}
                        onChange={(rows) => setDraft((d) => ({ ...d, [key]: rows as any }))} />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {!layout && extraList.length ? (
            <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-6">
              {extraList.map((e) => (
                <div key={e.key} className={cn("min-w-0 space-y-1.5", e.wide ? "sm:col-span-6" : "sm:col-span-3")}>
                  <Label className="text-xs">{e.label}</Label>
                  {e.wide ? (
                    <Textarea rows={2} value={extraDraft[e.key] ?? ""} maxLength={e.max} placeholder={e.placeholder}
                      onChange={(ev) => setExtraDraft((d) => ({ ...d, [e.key]: ev.target.value }))} />
                  ) : (
                    <Input value={extraDraft[e.key] ?? ""} maxLength={e.max} placeholder={e.placeholder}
                      onChange={(ev) => setExtraDraft((d) => ({ ...d, [e.key]: ev.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {/* Ô NGẮN (số, tiền, ô chọn) đứng trước, mỗi hàng ba ô (hai ô khi số ô không chia hết cho ba); ô DÀI
              (nguyên nhân, kết luận…) đứng sau, hai ô một hàng và cao hai dòng. Xếp theo thứ tự cấu hình thì ô
              ngắn và ô dài xen nhau, hàng nào cũng lệch. */}
          <div className={cn("grid items-start gap-x-4 gap-y-4 sm:grid-cols-6", layout && "hidden")}>
            {(layout ? [] : [...shortFields, ...wideFields]).map((f, i) => {
              const wideIndex = i - shortFields.length;
              const span = wideIndex < 0
                ? shortFields.length % 3 === 0 ? "sm:col-span-2" : "sm:col-span-3"
                : wideFields.length === 1 || (wideFields.length % 2 === 1 && wideIndex === wideFields.length - 1) ? "sm:col-span-6" : "sm:col-span-3";
              return (
              <div key={f.key} className={cn("min-w-0 space-y-1.5", span)}>
                <Label className="text-xs">
                  {f.label}
                  {f.required ? <span className="text-destructive ms-0.5">*</span> : null}
                </Label>
                <FieldInput field={wideIndex >= 0 && f.kind === "text" ? { ...f, kind: "textarea", rule: textRuleOf(f) } as RuledField : f} value={draft[f.key] ?? null} config={config!} lookups={lookups}
                  onChange={(v) => setDraft((d) => {
                    const next = { ...d };
                    if (v == null || v === "") delete next[f.key];
                    else next[f.key] = v;
                    return next;
                  })} />
              </div>
              );
            })}
          </div>
          {(layout ? [] : tables).map(([key, columns]) => (
            <div key={key} className="space-y-2">
              <h4 className="text-overline text-muted-foreground">{TABLE_TITLES[key] ?? key}</h4>
              <SubTable columns={columns} rows={(draft[key] as Record<string, DetailValue>[] | undefined) ?? []} config={config!} lookups={lookups}
                onChange={(rows) => setDraft((d) => ({ ...d, [key]: rows as any }))} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="button" disabled={!!(config && lineDetailsError(config, draft))} onClick={() => {
              onChange(draft);
              if (extraList.length) onExtraChange?.(extraDraft);
              setOpen(false);
            }}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Trường chứng từ của một dòng, gọn trên một ô: "Đơn vị tính: Bộ · Tình trạng: Tốt". */
export function lineDetailsText(config: VoucherFormConfig | undefined, details: Details | undefined) {
  if (!config || !details) return "";
  return (config.line ?? [])
    .filter((f) => details[f.key] != null)
    .map((f) => `${f.label}: ${formatDetail(f, details[f.key], config)}`)
    .join(" · ");
}
