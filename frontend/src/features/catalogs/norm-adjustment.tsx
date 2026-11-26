import { useInvalidate, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeftRight, CircleDot, Lightbulb, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useFormContext, useWatch, type Control } from "react-hook-form";

import {
  ADJUST_BASIS_LABELS,
  ADJUST_KIND_LABELS,
  ratioLabel,
  type AdjustGroup,
  type AdjustKind,
  type AdjustmentSuggestion,
  type EquipmentNorm,
} from "@/domains/equipment-standard/types";
import { kyInstance } from "@/shared/api/data";
import { EquipmentCatalogPicker } from "@/shared/components/catalog/equipment-catalog-picker";
import { RefField } from "@/shared/components/catalog/ref-field";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { SelectOrText } from "@/shared/components/form/select-or-text";
import { SelectField, TextField } from "@/shared/components/form/simple-fields";
import { Segmented } from "@/shared/components/segmented";
import { errorMessage } from "@/shared/lib/api-error";
import { NORM_ADJUSTABLE_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { LegalBasisPicker } from "./legal-doc-picker";

/**
 * Điều chỉnh của một dòng danh mục tối thiểu (changelog 276) — Sở khai tay cho từng dòng theo câu của thông tư:
 * không được phép / giảm / thay thế / dùng chung / chọn trong nhóm. Khối ở cuối form thêm / sửa, khối xem ở ngăn chi
 * tiết, hộp Ngừng áp dụng và hộp Xoá (chỉ dòng chưa được dùng).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const NORMS = "equipment_norms";

const KIND_OPTIONS: { value: AdjustKind; label: string; icon?: ReactNode }[] = [
  { value: "NONE", label: ADJUST_KIND_LABELS.NONE },
  { value: "REDUCE", label: ADJUST_KIND_LABELS.REDUCE, icon: <ArrowDown /> },
  { value: "SUBSTITUTE", label: ADJUST_KIND_LABELS.SUBSTITUTE, icon: <RefreshCw /> },
  { value: "SHARED", label: ADJUST_KIND_LABELS.SHARED, icon: <ArrowLeftRight /> },
  { value: "CHOOSE_IN_GROUP", label: ADJUST_KIND_LABELS.CHOOSE_IN_GROUP, icon: <CircleDot /> },
];

const BASIS_OPTIONS = Object.entries(ADJUST_BASIS_LABELS).map(([value, label]) => ({ value, label }));

/** Giá trị trống của khối điều chỉnh — form thêm mới. */
export const EMPTY_ADJUSTMENT = {
  kind: "NONE",
  quantity: null,
  basis: null,
  basisSize: null,
  condition: "",
  substituteCatalog: { id: null },
  substituteText: "",
  substituteRequired: false,
  group: "",
  groupPick: null,
  basisText: "",
  shared: [],
};

/** Dòng được phép điều chỉnh không. */
export const adjustable = (row: Pick<EquipmentNorm, "adjustment"> | null | undefined) =>
  !!row?.adjustment && row.adjustment.kind !== "NONE";

/** Nhãn "Được phép" / "Không được phép" — cột Điều chỉnh và ngăn chi tiết. */
export function AdjustableBadge({ row }: { row: Pick<EquipmentNorm, "adjustment"> }) {
  const allowed = adjustable(row);
  return (
    <Badge variant={NORM_ADJUSTABLE_VARIANTS[allowed ? "allowed" : "denied"]}>
      {allowed ? "Được phép" : "Không được phép"}
    </Badge>
  );
}

/** Câu tóm tắt của một gợi ý: "Giảm còn 1 bộ / 2 học sinh". */
function suggestionText(s: AdjustmentSuggestion, unit?: string | null): string {
  switch (s.kind) {
    case "REDUCE":
      return `Giảm còn ${ratioLabel(s.quantity, unit?.toLowerCase(), s.basisSize, s.basis)}`;
    case "SUBSTITUTE":
      return s.substituteText ? `Thay bằng ${s.substituteText}` : "Thay thế";
    case "CHOOSE_IN_GROUP":
      return `Chọn ${s.groupPick ?? 1} trong nhóm${s.group ? ` ${s.group.toLowerCase()}` : ""}`;
    case "SHARED":
      return "Dùng chung";
    default:
      return "";
  }
}

/**
 * Khối "Điều chỉnh" ở cuối form thêm / sửa: chọn kiểu, chỉ hiện ô của kiểu đó; trừ "Không được phép", luôn bắt buộc câu
 * căn cứ (điền sẵn từ ghi chú). Ghi chú có câu điều chỉnh nhận ra được thì có gợi ý + nút "Dùng gợi ý" — không tự áp.
 */
export function AdjustmentFields({ control, record, standard }: { control: Control<any>; record?: any; standard: any }) {
  const { setValue, getValues } = useFormContext();
  const kind: AdjustKind = useWatch({ control, name: "adjustment.kind" }) ?? "NONE";
  const note: string = useWatch({ control, name: "note" }) ?? "";
  const unitId = useWatch({ control, name: "unit.id" });
  const unit: string | null = record?.unit?.id != null && record.unit.id === unitId ? record.unit.name : null;

  const [pending, setPending] = useState(note);
  useEffect(() => {
    const t = setTimeout(() => setPending(note.trim()), 400);
    return () => clearTimeout(t);
  }, [note]);
  const { data: suggestion } = useQuery({
    queryKey: [NORMS, "adjustment-suggestion", pending],
    queryFn: () => kyInstance.get(`${NORMS}/adjustment-suggestion`, { searchParams: { note: pending } }).json<AdjustmentSuggestion>(),
    enabled: pending !== "",
    staleTime: Infinity,
  });
  const hint = pending !== "" && suggestion?.kind && suggestion.kind !== kind ? suggestion : null;

  const set = (name: string, value: unknown) => setValue(`adjustment.${name}`, value, { shouldDirty: true });
  const pickKind = (next: AdjustKind) => {
    set("kind", next);
    if (next !== "NONE" && !String(getValues("adjustment.basisText") ?? "").trim()) set("basisText", note);
    if (next === "REDUCE" && !getValues("adjustment.basis")) set("basis", getValues("normBasis") ?? null);
  };
  const applyHint = () => {
    if (!hint?.kind) return;
    set("kind", hint.kind);
    set("basisText", hint.basisText ?? note);
    if (hint.kind === "REDUCE") {
      set("quantity", hint.quantity ?? null);
      set("basis", hint.basis ?? null);
      set("basisSize", hint.basisSize ?? null);
      set("condition", hint.condition ?? "");
    }
    if (hint.kind === "SUBSTITUTE") {
      set("substituteCatalog", { id: null });
      set("substituteText", hint.substituteText ?? "");
      set("substituteRequired", !!hint.substituteRequired);
    }
    if (hint.kind === "CHOOSE_IN_GROUP") {
      if (hint.group) set("group", hint.group);
      set("groupPick", hint.groupPick ?? 1);
    }
  };

  return (
    <div className="bg-surface-subtle rounded-xl border px-4 py-3">
      {hint ? (
        <div className="bg-info-subtle text-info-text mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg py-1 ps-3 pe-1.5 text-sm">
          <Lightbulb className="size-4 shrink-0" />
          <span className="min-w-0">Ghi chú có câu điều chỉnh — gợi ý: <b>{suggestionText(hint, unit)}</b></span>
          <Button type="button" variant="outline" size="sm" className="ms-auto h-7" onClick={applyHint}>Dùng gợi ý</Button>
        </div>
      ) : null}
      {/* Câu căn cứ đứng cùng hàng với kiểu điều chỉnh (màn rộng) để form vừa một màn; màn hẹp thì xuống dòng. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
        <FormField
          control={control}
          name="adjustment.kind"
          render={() => (
            <FormItem className="max-w-full">
              <FormLabel required>Điều chỉnh</FormLabel>
              <Segmented label="Điều chỉnh" options={KIND_OPTIONS} value={kind} onChange={pickKind} className="w-fit max-w-full flex-wrap" />
            </FormItem>
          )}
        />
        {kind !== "NONE" ? (
          <TextField control={control} name="adjustment.basisText" label="Câu căn cứ trong thông tư" rule="LONG_TEXT" max={1000}
            className="min-w-[18rem] max-w-[40rem] flex-1" rules={{ required: "Vui lòng nhập câu căn cứ trong thông tư" }} />
        ) : null}
      </div>
      {kind === "REDUCE" ? <ReduceFields control={control} unit={unit} /> : null}
      {kind === "SUBSTITUTE" ? <SubstituteFields control={control} record={record} standard={standard} /> : null}
      {kind === "SHARED" ? <SharedField control={control} standard={standard} ownId={record?.catalog?.id} /> : null}
      {kind === "CHOOSE_IN_GROUP" ? <GroupFields control={control} record={record} standard={standard} /> : null}
    </div>
  );
}

/** Giảm: còn bao nhiêu / mỗi bao nhiêu đối tượng, khi nào — phải ít hơn định mức gốc (máy chủ kiểm lại đủ luật). */
function ReduceFields({ control, unit }: { control: Control<any>; unit: string | null }) {
  const [q, basis, size] = useWatch({ control, name: ["adjustment.quantity", "adjustment.basis", "adjustment.basisSize"] });
  const [baseQ, baseBasis, baseSize] = useWatch({ control, name: ["minQuantity", "normBasis", "basisSize"] });
  const empty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
  return (
    <div className="mt-4">
      <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[5rem_10rem_6rem_minmax(0,22rem)]">
        <TextField control={control} name="adjustment.quantity" label="Còn" type="number" step="any" numberRule="DECIMAL_QUANTITY"
          rules={{
            required: "Vui lòng nhập số còn lại",
            validate: (v: any, values: any) => {
              if (empty(values?.minQuantity)) return "Dòng chưa ghi Cần có — không giảm được";
              if (Number(v) <= 0) return "Phải lớn hơn 0";
              const a = values?.adjustment ?? {};
              if (a.basis !== values?.normBasis || empty(a.basisSize)) return true;
              const from = values?.basisSize && values.basisSize > 1 ? values.basisSize : 1;
              return Number(v) * from < Number(values.minQuantity) * Number(a.basisSize) || "Phải ít hơn định mức gốc";
            },
          }} />
        <SelectField control={control} name="adjustment.basis" label="Theo" options={BASIS_OPTIONS} placeholder="Vui lòng chọn"
          rules={{ required: "Vui lòng chọn đối tượng" }} />
        <TextField control={control} name="adjustment.basisSize" label="Mỗi" type="number" numberRule="COUNT"
          rules={{ required: "Vui lòng nhập số", validate: (v: any) => Number(v) >= 1 || "Ít nhất là 1" }} />
        <TextField control={control} name="adjustment.condition" label="Khi" rule="NOTE" placeholder="Nơi chưa có điều kiện"
          rules={{ required: "Vui lòng nhập khi nào được giảm" }} />
      </div>
      {!empty(q) && basis && !empty(size) ? (
        <p className="text-muted-foreground mt-2 text-[0.8125rem]">
          = {ratioLabel(Number(q), unit?.toLowerCase(), Number(size), basis)}
          {!empty(baseQ) ? <> (định mức gốc {ratioLabel(Number(baseQ), unit?.toLowerCase(), baseSize, baseBasis)})</> : null}
        </p>
      ) : null}
    </div>
  );
}

/** Thay thế: một thiết bị của danh mục, hoặc hình thức khác; có / không tính thiết bị này khi trường đã có thứ thay. */
function SubstituteFields({ control, record, standard }: { control: Control<any>; record?: any; standard: any }) {
  const { setValue } = useFormContext();
  const [text, catalogId] = useWatch({ control, name: ["adjustment.substituteText", "adjustment.substituteCatalog.id"] });
  const [choice, setChoice] = useState<"catalog" | "other" | null>(null);
  const mode = choice ?? (String(text ?? "").trim() && catalogId == null ? "other" : "catalog");
  const switchTo = (next: "catalog" | "other") => {
    setChoice(next);
    if (next === "catalog") setValue("adjustment.substituteText", "", { shouldDirty: true });
    else setValue("adjustment.substituteCatalog", { id: null }, { shouldDirty: true });
  };
  const levelId = standard?.educationLevel?.id;
  return (
    <div className="mt-4 grid gap-y-4">
      <div className="grid items-start justify-start gap-x-4 gap-y-5 sm:grid-cols-[max-content_minmax(0,26rem)]">
        <div className="grid gap-2">
          <span className="text-sm leading-none font-medium">Thay bằng</span>
          <Segmented label="Thay bằng" value={mode} onChange={switchTo} variant="card"
            options={[{ value: "catalog", label: "Thiết bị trong danh mục" }, { value: "other", label: "Hình thức khác" }]} />
        </div>
        {mode === "catalog" ? (
          <RefField control={control} name="adjustment.substituteCatalog" resource="equipment_catalogs" label="Thiết bị" required
            current={record?.adjustment?.substituteCatalog}
            filters={levelId ? [{ field: "educationLevel.id", operator: "eq", value: levelId }] : undefined}
            validate={(v: any) => v == null || v !== record?.catalog?.id || "Không thay bằng chính thiết bị này"} />
        ) : (
          <TextField control={control} name="adjustment.substituteText" label="Hình thức" rule="NOTE" placeholder="Phần mềm mô phỏng"
            rules={{ required: "Vui lòng nhập hình thức thay thế" }} />
        )}
      </div>
      <FormField
        control={control}
        name="adjustment.substituteRequired"
        render={({ field }) => (
          <label className="flex w-fit items-center gap-2 text-sm">
            <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            Khi trường đã có thứ thay thế thì không tính thiết bị này
          </label>
        )}
      />
    </div>
  );
}

/** Dùng chung: ít nhất một thiết bị của danh mục, chọn bằng hộp chọn thiết bị (cấp học của bộ). */
function SharedField({ control, standard, ownId }: { control: Control<any>; standard: any; ownId?: number }) {
  const levelId = standard?.educationLevel?.id;
  return (
    <FormField
      control={control}
      name="adjustment.shared"
      rules={{ validate: (v: any) => (Array.isArray(v) && v.length > 0) || "Chọn ít nhất một thiết bị dùng chung" }}
      render={({ field, fieldState }) => {
        const list: { id: number; code?: string | null; name: string }[] = Array.isArray(field.value) ? field.value : [];
        return (
          <FormItem className="mt-4 max-w-[60rem]">
            <FormLabel required>Dùng chung với</FormLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {list.map((c) => (
                <span key={c.id} className="bg-card inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border ps-3 pe-1 text-sm">
                  <span className="min-w-0 truncate" title={c.name}>
                    {c.code ? <span className="text-muted-foreground font-mono text-xs">{c.code} · </span> : null}
                    {c.name}
                  </span>
                  <Button type="button" variant="ghost" size="icon-sm" className="size-6" aria-label={`Bỏ ${c.name}`}
                    onClick={() => field.onChange(list.filter((x) => x.id !== c.id))}>
                    <X className="size-3.5" />
                  </Button>
                </span>
              ))}
              {/* Hộp chọn đứng cuối hàng chip — chọn một là thêm một. */}
              <div className="w-[20rem] max-w-full">
                <EquipmentCatalogPicker value={null} label="thiết bị dùng chung" invalid={!!fieldState.error} required
                  filters={levelId ? [{ field: "educationLevel.id", operator: "eq", value: levelId }] : undefined}
                  onChange={(row) => {
                    if (!row || row.id === ownId || list.some((x) => x.id === row.id)) return;
                    field.onChange([...list, { id: row.id, code: row.code ?? null, name: row.name }]);
                  }} />
              </div>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Chọn trong nhóm: nhóm có sẵn của môn (hoặc nhóm mới), số được chọn ít hơn số thiết bị của nhóm. */
function GroupFields({ control, record, standard }: { control: Control<any>; record?: any; standard: any }) {
  const { setValue } = useFormContext();
  const [subjectId, group, name] = useWatch({ control, name: ["subject.id", "adjustment.group", "name"] });
  const { data } = useQuery({
    queryKey: [NORMS, "adjust-groups", standard?.id, subjectId ?? null],
    queryFn: () => kyInstance.get(`${NORMS}/adjust-groups`, {
      searchParams: { "standard.id": String(standard.id), ...(subjectId ? { "subject.id": String(subjectId) } : {}) },
    }).json<AdjustGroup[]>(),
    enabled: !!standard?.id,
  });
  const groups = useMemo(() => data ?? [], [data]);
  const current = groups.find((g) => g.name.toLowerCase() === String(group ?? "").trim().toLowerCase());
  const members = [...(current?.items ?? []).filter((m) => m.id !== record?.id).map((m) => m.name), ...(name ? [name] : [])];
  const total = members.length;
  const picks = Array.from({ length: Math.max(1, total - 1) }, (_, i) => i + 1);
  return (
    <div className="mt-4 grid items-start gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,18rem)_10.5rem_minmax(0,28rem)]">
      <FormField
        control={control}
        name="adjustment.group"
        rules={{ required: "Vui lòng chọn hoặc đặt tên nhóm" }}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Nhóm</FormLabel>
            <SelectOrText value={field.value} options={groups.map((g) => ({ value: g.name, label: g.name }))}
              onChange={(v) => {
                field.onChange(v ?? "");
                const g = groups.find((x) => x.name === v);
                if (g?.pick) setValue("adjustment.groupPick", g.pick, { shouldDirty: true });
              }}
              onBlur={field.onBlur} invalid={!!fieldState.error} placeholder="Vui lòng chọn nhóm" maxLength={255} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="adjustment.groupPick"
        rules={{
          required: "Vui lòng chọn số được chọn",
          validate: (v: any) => total < 2 || Number(v) < total || `Phải ít hơn ${total}`,
        }}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Được chọn</FormLabel>
            <Select value={field.value == null ? "" : String(field.value)} onValueChange={(v) => { if (v !== "") field.onChange(Number(v)); }}>
              <FormControl>
                <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                  <SelectValue placeholder="Vui lòng chọn" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {[...new Set([...picks, ...(field.value ? [Number(field.value)] : [])])].sort((a, b) => a - b).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid min-w-0 gap-2">
        <span className="text-sm leading-none font-medium">Trong nhóm</span>
        <div className="bg-muted/40 text-muted-foreground flex h-9 min-w-0 items-center rounded-full border px-3.5 text-sm">
          <span className="truncate" title={members.join(" · ")}>{members.length ? members.join(" · ") : "Chưa có thiết bị"}</span>
        </div>
      </div>
    </div>
  );
}

/** Một hàng "nhãn — giá trị" của ngăn chi tiết (cùng khuôn cho cả bốn khối). */
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Khối "Điều chỉnh" của ngăn chi tiết: nhãn Được phép / Không được phép rồi các ô của kiểu. */
export function AdjustmentView({ row, standardId }: { row: EquipmentNorm; standardId?: number }) {
  const a = row.adjustment;
  const { data: groups } = useQuery({
    queryKey: [NORMS, "adjust-groups", standardId, row.subject?.id ?? null],
    queryFn: () => kyInstance.get(`${NORMS}/adjust-groups`, {
      searchParams: { "standard.id": String(standardId), ...(row.subject?.id ? { "subject.id": String(row.subject.id) } : {}) },
    }).json<AdjustGroup[]>(),
    enabled: a?.kind === "CHOOSE_IN_GROUP" && standardId != null,
  });
  const group = groups?.find((g) => g.name === a?.group);
  const unit = (row.unit?.name ?? row.unitText ?? "") || null;
  return (
    <>
      <KV label="Điều chỉnh"><AdjustableBadge row={row} /></KV>
      {a && a.kind !== "NONE" ? <KV label="Kiểu">{ADJUST_KIND_LABELS[a.kind]}</KV> : null}
      {a?.kind === "REDUCE" ? (
        <>
          <KV label="Sau giảm"><b>{ratioLabel(a.quantity, unit, a.basisSize, a.basis)}</b></KV>
          <KV label="Khi">{a.condition ?? <span className="text-muted-foreground">Chưa ghi điều kiện</span>}</KV>
        </>
      ) : null}
      {a?.kind === "SUBSTITUTE" ? (
        <>
          <KV label="Thay bằng">
            {a.substituteCatalog ? <>{a.substituteCatalog.code ? `${a.substituteCatalog.code} · ` : ""}{a.substituteCatalog.name}</> : a.substituteText ?? <span className="text-muted-foreground">Chưa khai</span>}
          </KV>
          <KV label="Đã có thứ thay">{a.substituteRequired ? "Không tính thiết bị này" : "Vẫn tính thiết bị này"}</KV>
        </>
      ) : null}
      {a?.kind === "SHARED" ? (
        <KV label="Dùng chung với">
          {a.shared.length ? a.shared.map((c) => <div key={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</div>) : <span className="text-muted-foreground">Chưa chọn thiết bị</span>}
        </KV>
      ) : null}
      {a?.kind === "CHOOSE_IN_GROUP" ? (
        <>
          <KV label="Nhóm">{a.group ?? <span className="text-muted-foreground">Chưa khai</span>}</KV>
          <KV label="Được chọn">{a.groupPick ?? <span className="text-muted-foreground">Chưa khai</span>}{group ? ` trong ${group.items.length}` : ""}</KV>
          {group ? <KV label="Trong nhóm">{group.items.map((m) => m.name).join(" · ")}</KV> : null}
        </>
      ) : null}
      {a && a.kind !== "NONE" && a.basisText && a.basisText.trim() !== (row.note ?? "").trim() ? (
        <KV label="Câu căn cứ"><span className="italic">{a.basisText}</span></KV>
      ) : null}
    </>
  );
}

/** Năm học (`school_years`), theo ngày bắt đầu. */
type SchoolYear = { id: number; code: string; name: string; startDate: string | null; current?: boolean | null };

export function useSchoolYears() {
  return useQuery({
    queryKey: ["school_years", "norm-stop"],
    queryFn: () => kyInstance.get("school_years", { searchParams: { _start: "0", _end: "200" } }).json<SchoolYear[]>(),
    staleTime: 5 * 60_000,
  });
}

/** "2026–2027". */
export const yearText = (y: Pick<SchoolYear, "code" | "name"> | undefined) =>
  y ? (/\d{4}\D+\d{4}/.exec(y.code ?? "")?.[0] ?? /\d{4}\D+\d{4}/.exec(y.name ?? "")?.[0] ?? y.name).replace(/\s*[-–]\s*/, "–") : "";

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Năm học bắt đầu ngừng của một dòng: Sở ngừng = ngày thôi áp dụng ĐÚNG ngày bắt đầu năm học (dòng ngừng trước
 * 20/11/2026 ghi ngày hôm trước — vẫn nhận ra). Không khớp năm học đã khai thì tính theo tháng 8.
 */
export function stopYearText(effectiveTo: string, years: SchoolYear[] | undefined): string {
  const next = nextDay(effectiveTo);
  const hit = (years ?? []).find((y) => y.startDate === effectiveTo) ?? (years ?? []).find((y) => y.startDate === next);
  const from = hit?.startDate ?? effectiveTo;
  if (hit) return yearText(hit);
  const [yy, mm] = from.split("-").map(Number);
  const start = mm >= 8 ? yy : yy - 1;
  return `${start}–${start + 1}`;
}

/** Hôm nay, `YYYY-MM-DD` theo giờ máy. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Dòng còn áp dụng hôm nay (ngày thôi áp dụng không tính). */
export const effectiveNow = (row: Pick<EquipmentNorm, "effectiveTo">) => !row.effectiveTo || row.effectiveTo > todayIso();

/** Dòng đã có trường dùng (tài sản, phiếu, đề xuất…) — không xoá được, chỉ ngừng áp dụng. */
export function useNormUsage(id: number | null | undefined) {
  return useQuery({
    queryKey: [NORMS, id, "usage"],
    queryFn: () => kyInstance.get(`${NORMS}/${id}/usage`).json<{ inUse: boolean }>(),
    enabled: id != null,
  });
}

/**
 * Hỏi lại rồi ngừng áp dụng một dòng từ một năm học (văn bản căn cứ + năm học bắt buộc). Dòng đã có trường dùng thì
 * không xoá — chỉ ngừng; báo cáo các năm trước giữ nguyên.
 */
export function StopNormDialog({ row, onClose }: { row: EquipmentNorm | null; onClose: () => void }) {
  const { data: years } = useSchoolYears();
  const form = useForm<{ legalDocument: number | null; schoolYear: string }>({ mode: "onChange", defaultValues: { legalDocument: null, schoolYear: "" } });
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const { open: notify } = useNotification();
  const options = useMemo(() => (years ?? [])
    .filter((y) => y.startDate && (!row?.effectiveFrom || y.startDate > row.effectiveFrom))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))), [years, row?.effectiveFrom]);
  const { reset } = form;
  useEffect(() => {
    if (!row) return;
    const current = options.find((y) => y.current) ?? options.find((y) => (y.startDate ?? "") > todayIso()) ?? options[0];
    reset({ legalDocument: null, schoolYear: current ? String(current.id) : "" });
  }, [row, options, reset]);
  const picked = options.find((y) => String(y.id) === form.watch("schoolYear"));

  const run = form.handleSubmit(async (v) => {
    if (!row) return;
    setBusy(true);
    try {
      await kyInstance.post(`${NORMS}/${row.id}/stop`, { json: { legalDocument: { id: v.legalDocument }, schoolYear: { id: Number(v.schoolYear) } } });
      await invalidate({ resource: NORMS, invalidates: ["list", "detail"], id: row.id });
      // Ngăn chi tiết: nhật ký và nút Xoá của dòng đọc lại.
      await queryClient.invalidateQueries({ queryKey: [NORMS, row.id] });
      notify?.({ type: "success", message: `Đã ngừng áp dụng "${row.name}" từ năm học ${yearText(picked)}.` });
      onClose();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không ngừng được" });
    } finally {
      setBusy(false);
    }
  });

  return (
    <AlertDialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <ConfirmContent
        tone="warning"
        title={`Ngừng áp dụng "${row?.name ?? ""}" từ năm học ${yearText(picked) || "…"}?`}
        description="Từ năm học này thiết bị không còn tính vào chuẩn tối thiểu. Báo cáo các năm trước giữ nguyên; thiết bị trên sổ của trường không đổi."
        cancelLabel="Không ngừng"
        confirmLabel="Ngừng áp dụng"
        busy={busy}
        keepOpen
        onConfirm={() => void run()}
      >
        <Form {...form}>
          <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="legalDocument"
              rules={{ required: "Vui lòng chọn văn bản căn cứ" }}
              render={({ field, fieldState }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Văn bản căn cứ</FormLabel>
                  <LegalBasisPicker value={field.value} onChange={field.onChange} invalid={!!fieldState.error} block />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="schoolYear"
              rules={{ required: "Vui lòng chọn năm học" }}
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Từ năm học</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { if (v !== "") field.onChange(v); }}>
                    <FormControl>
                      <SelectTrigger className={cn("w-full", fieldState.error && "border-destructive")}>
                        <SelectValue placeholder="Vui lòng chọn năm học" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-64">
                      {options.map((y) => <SelectItem key={y.id} value={String(y.id)}>{yearText(y)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </ConfirmContent>
    </AlertDialog>
  );
}

/** Hỏi lại rồi xoá một dòng CHƯA được dùng (thường là nhập nhầm). Đã có trường dùng thì máy chủ trả 409. */
export function DeleteUnusedNormDialog({ row, onClose, onDeleted }: { row: EquipmentNorm | null; onClose: () => void; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const run = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await kyInstance.delete(`${NORMS}/${row.id}`);
      await invalidate({ resource: NORMS, invalidates: ["list"] });
      notify?.({ type: "success", message: `Đã xoá "${row.name}" khỏi danh mục.` });
      onDeleted?.();
      onClose();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xoá được" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <ConfirmContent
        tone="danger"
        title={`Xoá "${row?.name ?? ""}" khỏi danh mục?`}
        description="Dòng chưa được trường nào dùng. Xoá rồi không khôi phục được."
        cancelLabel="Không xoá"
        confirmLabel="Xoá"
        busy={busy}
        keepOpen
        onConfirm={() => void run()}
      />
    </AlertDialog>
  );
}
