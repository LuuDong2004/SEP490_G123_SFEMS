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
type Lookups = { staff: StaffRow[]; rooms: Option[]; schools: Option[]; refs: Record<string, Option[]> };

/** Danh sách cho ô chọn cán bộ / phòng / trường — theo trường của phiếu. */
function useLookups(schoolId: number | null | undefined, needsSchools: boolean, refResources: string[], needsRooms = false): Lookups {
  const filters = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }, { field: "active", operator: "eq" as const, value: true }] : [];
  // Hệ thống chưa có danh mục cán bộ (`/api/staff`): ô "cán bộ" chỉ là ô gõ tên, không có gợi ý. Bật lại khi có.
  const staff = useList<any>({ resource: "staff", filters, pagination: { pageSize: 500 }, queryOptions: { enabled: false } });
  const rooms = useList<any>({ resource: "rooms", filters: schoolId ? [filters[0]] : [], pagination: { pageSize: 500 }, queryOptions: { enabled: !!schoolId && needsRooms } });
  const schools = useList<any>({ resource: "schools", pagination: { pageSize: 200 }, queryOptions: { enabled: needsSchools } });
  const reasons = useList<any>({ resource: "movement_reasons", pagination: { pageSize: 200 }, queryOptions: { enabled: refResources.includes("movement_reasons") } });
  const pick = (r: any): Option[] => (r?.result?.data ?? []).map((x: any) => ({ id: x.id, name: x.name }));
  return { staff: (staff.result?.data ?? []) as StaffRow[], rooms: pick(rooms), schools: pick(schools), refs: { movement_reasons: pick(reasons) } };
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
      return textError(textRuleOf(f), f.label, value, textMaxOf(f));
    case "date":
      return dateError(f.date === "past" ? "PAST_OR_TODAY" : "ANY", f.label, value);
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
      return <Textarea rows={1} className="field-sizing-content min-h-9" value={str} maxLength={maxLengthOf(textRuleOf(field), textMaxOf(field))} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <DateInput value={str || undefined} onChange={(v) => onChange(v ?? null)} />;
    case "time":
      return <TimeInput value={str} onChange={(v) => onChange(v || null)} />;
    case "integer":
      return <Input type="number" step={1} placeholder="Nhập số" value={str} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
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
      return (
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
    case "ref":
      return <RefSelect value={value} onChange={onChange} options={lookups.refs[field.resource ?? ""] ?? []} placeholder={pick(field.label)} />;
    default:
      // Ô chữ là ô chữ: không gợi ý tên cán bộ / phòng của trường — người ký, người nhận thường là người
      // ngoài trường, và danh sách xổ ra làm ô trông như ô chọn. Cần chọn thì khai kind staff / room.
      return <Input value={str} placeholder="Nhập" maxLength={maxLengthOf(textRuleOf(field), textMaxOf(field))} inputMode={inputModeOf(textRuleOf(field))} onChange={(e) => onChange(e.target.value)} />;
  }
}

function visibleSections(config: VoucherFormConfig | undefined, stage?: string, variant?: string | null) {
  return (config?.sections ?? []).filter(
    (s) => (s.stage ?? null) === (stage ?? null) && (!s.when || (variant != null && s.when.in.includes(variant))),
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
export function VoucherDetailsFields({ config, value, onChange, schoolId, stage, variant, compact, title = "Thông tin bổ sung", hint = "Không bắt buộc" }: {
  config: VoucherFormConfig | undefined;
  value: Details | undefined;
  onChange: (next: Details) => void;
  schoolId: number | null | undefined;
  stage?: string;
  variant?: string | null;
  /** Trong hộp thoại: không tiêu đề, lưới hai cột, mục nào cũng mở. */
  compact?: boolean;
  title?: string;
  hint?: ReactNode;
}) {
  const sections = visibleSections(config, stage, variant);
  const kinds = sections.flatMap((s) => s.fields);
  const lookups = useLookups(schoolId, kinds.some((f) => f.kind === "school"),
    kinds.filter((f) => f.kind === "ref").map((f) => f.resource ?? ""), kinds.some((f) => f.kind === "room" || f.suggest === "room"));
  if (!config || sections.length === 0) return null;
  const values = value ?? {};
  const set = (key: string, v: DetailValue) => {
    const next = { ...values };
    if (v == null || v === "") delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const grid = compact ? "grid grid-flow-row-dense items-start gap-4 sm:grid-cols-2" : "grid grid-flow-row-dense items-start gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4";
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
  const all = sections.flatMap((s) => s.fields);
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
        <div key={`${section.stage ?? ""}${section.title}`} className="space-y-3">
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
    case "ref":
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
export function VoucherDetailsView({ config, details, stage, variant, draft, title = "Thông tin bổ sung" }: {
  config: VoucherFormConfig | undefined;
  details: Details | undefined;
  stage?: string;
  variant?: string | null;
  /** Phiếu còn nháp: nhắc các trường bắt buộc chưa điền. */
  draft?: boolean;
  title?: string;
}) {
  if (!config) return null;
  const values = details ?? {};
  const all = visibleSections(config, stage, variant);
  const missing = all.flatMap((s) => s.fields).filter((f) => f.required && !filled(values[f.key]));
  const sections = all
    .map((s): DetailSection => ({ ...s, fields: s.fields.filter((f) => filled(values[f.key])) }))
    .filter((s) => s.fields.length);
  if (!sections.length && !(draft && missing.length)) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {draft && missing.length ? (
          <p className="bg-warning-subtle text-warning-text rounded-md px-3 py-2 text-sm">
            Còn thiếu {missing.length} trường bắt buộc trước khi trình: {missing.map((f) => f.label).join(", ")}.
          </p>
        ) : null}
        {sections.map((s) => (
          <div key={`${s.stage ?? ""}${s.title}`} className="space-y-2">
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
    </Card>
  );
}

/** Các trường chứng từ đã điền, phẳng — cho bản in. */
export function detailFacts(config: VoucherFormConfig | undefined, details: Details | undefined, variant?: string | null) {
  if (!config || !details) return [];
  return (config.sections ?? [])
    .filter((s) => !s.when || (variant != null && s.when.in.includes(variant)))
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
        <div key={i} className="grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto` }}>
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

/**
 * Trường chứng từ của MỘT dòng, vẽ thẳng trên trang (không sau nút) — cho hộp thoại chi tiết dòng,
 * nơi chúng đứng cạnh số lượng, giá và chứng từ của chính dòng đó. Ghi ngay mỗi lần đổi.
 */
export function LineDetailsFields({ config, value, onChange, schoolId, stage }: {
  config: VoucherFormConfig | undefined;
  value: Details | undefined;
  onChange: (next: Details) => void;
  schoolId: number | null | undefined;
  stage?: string;
}) {
  const fields = useMemo(() => (config?.line ?? []).filter((f) => (f.stage ?? null) === (stage ?? null)), [config, stage]);
  const tables = Object.entries(config?.lineTables ?? {});
  const lookups = useLookups(schoolId, false, fields.filter((f) => f.kind === "ref").map((f) => f.resource ?? ""),
    fields.some((f) => f.kind === "room" || f.suggest === "room"));
  if (!config || (!fields.length && !tables.length)) return null;
  const values = value ?? {};
  const set = (key: string, v: DetailValue) => {
    const next = { ...values };
    if (v == null || v === "") delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="space-y-4">
      {/* Một ô đứng một mình thì chiếm trọn hàng — chia hai cột chỉ để lại nửa hàng trống bên cạnh nó. */}
      <div className={cn("grid items-start gap-x-4 gap-y-4", fields.length > 1 && "sm:grid-cols-2")}>
        {fields.map((f) => (
          <div key={f.key} className={f.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
            <Label className="text-xs">
              {f.label}
              {f.required ? <span className="text-destructive ms-0.5">*</span> : null}
            </Label>
            <FieldInput field={f} value={values[f.key] ?? null} config={config} lookups={lookups} onChange={(v) => set(f.key, v)} />
          </div>
        ))}
      </div>
      {tables.map(([key, columns]) => (
        <div key={key} className="space-y-2">
          <h4 className="text-overline text-muted-foreground">{TABLE_TITLES[key] ?? key}</h4>
          <SubTable columns={columns} rows={(values[key] as Record<string, DetailValue>[] | undefined) ?? []} config={config} lookups={lookups}
            onChange={(rows) => onChange({ ...values, [key]: rows as any })} />
        </div>
      ))}
    </div>
  );
}

/** Số trường đã điền / tổng số trường của các mục đầu phiếu (theo `stage`) — "Khai báo 3/7". */
export function headFillCount(config: VoucherFormConfig | undefined, details: Details | undefined, stage?: string, variant?: string | null) {
  const fields = visibleSections(config, stage, variant).flatMap((s) => s.fields);
  return {
    filled: fields.filter((f) => filled(details?.[f.key])).length,
    total: fields.length,
    missing: fields.filter((f) => f.required && !f.stage && !filled(details?.[f.key])).map((f) => f.label),
  };
}

/**
 * Nút "Chi tiết" trên một dòng phiếu: hộp thoại nhập các trường chứng từ của dòng
 * (và các bảng con của nó, nếu loại phiếu có).
 */
export function LineDetailsButton({ config, value, onChange, schoolId, stage, title, compact }: {
  /** Nút chỉ có biểu tượng (kèm số mục đã điền / còn thiếu) — cho bảng nhiều cột, nơi chữ "Chi tiết" tràn ô. */
  compact?: boolean;
  config: VoucherFormConfig | undefined;
  value: Details | undefined;
  onChange: (next: Details) => void;
  schoolId: number | null | undefined;
  stage?: string;
  title?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Details>({});
  const fields = useMemo(() => (config?.line ?? []).filter((f) => (f.stage ?? null) === (stage ?? null)), [config, stage]);
  const tables = Object.entries(config?.lineTables ?? {});
  const lookups = useLookups(schoolId, false, fields.filter((f) => f.kind === "ref").map((f) => f.resource ?? ""),
    fields.some((f) => f.kind === "room" || f.suggest === "room"));
  if (!config || (!fields.length && !tables.length)) return null;
  const filled = fields.filter((f) => value?.[f.key] != null).length + tables.filter(([k]) => Array.isArray(value?.[k]) && (value?.[k] as any[]).length).length;
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
          onClick={() => { setDraft({ ...(value ?? {}) }); setOpen(true); }}>
          <ListPlus />
          {missing || filled ? (
            <span className={cn("absolute -end-0.5 -top-0.5 size-2 rounded-full", missing ? "bg-warning" : "bg-primary")} aria-hidden />
          ) : null}
        </Button>
      ) : (
      <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft({ ...(value ?? {}) }); setOpen(true); }}>
        Chi tiết
        {missing ? (
          <Badge variant="warning" className="ms-1">Thiếu {missing}</Badge>
        ) : filled ? (
          <Badge variant="neutral" className="ms-1">{filled}</Badge>
        ) : null}
      </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="form" className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết dòng</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          {/* Ô NGẮN (số, tiền, ô chọn) đứng trước, mỗi hàng ba ô (hai ô khi số ô không chia hết cho ba); ô DÀI
              (nguyên nhân, kết luận…) đứng sau, hai ô một hàng và cao hai dòng. Xếp theo thứ tự cấu hình thì ô
              ngắn và ô dài xen nhau, hàng nào cũng lệch. */}
          <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-6">
            {[...shortFields, ...wideFields].map((f, i) => {
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
                <FieldInput field={wideIndex >= 0 && f.kind === "text" ? { ...f, kind: "textarea", rule: textRuleOf(f) } as RuledField : f} value={draft[f.key] ?? null} config={config} lookups={lookups}
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
          {tables.map(([key, columns]) => (
            <div key={key} className="space-y-2">
              <h4 className="text-overline text-muted-foreground">{TABLE_TITLES[key] ?? key}</h4>
              <SubTable columns={columns} rows={(draft[key] as Record<string, DetailValue>[] | undefined) ?? []} config={config} lookups={lookups}
                onChange={(rows) => setDraft((d) => ({ ...d, [key]: rows as any }))} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="button" disabled={!!lineDetailsError(config, draft)} onClick={() => { onChange(draft); setOpen(false); }}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Trường chứng từ của một dòng, gọn trên một ô: "Đơn vị tính: Bộ · Tình trạng khi mượn: Tốt". */
export function lineDetailsText(config: VoucherFormConfig | undefined, details: Details | undefined, stage?: string) {
  if (!config || !details) return "";
  return (config.line ?? [])
    .filter((f) => (stage === undefined || (f.stage ?? null) === (stage ?? null)) && details[f.key] != null)
    .map((f) => `${f.label}: ${formatDetail(f, details[f.key], config)}`)
    .join(" · ");
}
