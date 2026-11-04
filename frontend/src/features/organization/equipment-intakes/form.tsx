import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type Control } from "react-hook-form";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { VoucherFormPage, type VoucherFieldsProps } from "@/shared/components/voucher/voucher-form-page";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { todayLocal } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { formatVnd } from "@/features/organization/equipment-intakes/money";
import { FUNDING_SOURCE_OPTIONS, type EquipmentIntake, type Ref } from "@/domains/equipment-intake/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RefValue = { id: number | null; name?: string | null };

const NO_REF: RefValue = { id: null };

const NEW_LINE = {
  catalog: NO_REF,
  name: "",
  documentQuantity: 1,
  receivedQuantity: 1,
  varianceReason: "",
  unitPrice: null as number | null,
  room: NO_REF,
  model: "",
  manufacturer: "",
};

const DEFAULTS = {
  intakeDate: todayLocal(),
  documentNo: "",
  documentDate: "",
  supplier: "",
  fundingSource: "",
  originSource: NO_REF,
  originNote: "",
  acquisitionMethod: NO_REF,
  schoolYear: NO_REF,
  warrantyMonths: "",
  note: "",
  lines: [] as (typeof NEW_LINE)[],
};

const refOf = (r: Ref | null | undefined): RefValue => (r ? { id: r.id, name: r.name } : NO_REF);
const idRef = (r: RefValue | null | undefined) => ({ id: r?.id ?? null });
const textOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function toForm(r: EquipmentIntake) {
  return {
    intakeDate: r.intakeDate ?? "",
    documentNo: r.documentNo ?? "",
    documentDate: r.documentDate ?? "",
    supplier: r.supplier ?? "",
    fundingSource: r.fundingSource ?? "",
    originSource: refOf(r.originSource),
    originNote: r.originNote ?? "",
    acquisitionMethod: refOf(r.acquisitionMethod),
    schoolYear: refOf(r.schoolYear),
    warrantyMonths: r.warrantyMonths ?? "",
    note: r.note ?? "",
    lines: (r.lines ?? []).map((l) => ({
      catalog: refOf(l.catalog),
      name: l.name ?? "",
      documentQuantity: l.documentQuantity,
      receivedQuantity: l.receivedQuantity,
      varianceReason: l.varianceReason ?? "",
      unitPrice: l.unitPrice,
      room: refOf(l.room),
      model: l.model ?? "",
      manufacturer: l.manufacturer ?? "",
    })),
  };
}

function toPayload(v: typeof DEFAULTS) {
  return {
    intakeDate: v.intakeDate || null,
    documentNo: textOrNull(v.documentNo),
    documentDate: v.documentDate || null,
    supplier: textOrNull(v.supplier),
    fundingSource: v.fundingSource || null,
    originSource: idRef(v.originSource),
    originNote: textOrNull(v.originNote),
    acquisitionMethod: idRef(v.acquisitionMethod),
    schoolYear: idRef(v.schoolYear),
    warrantyMonths: numOrNull(v.warrantyMonths),
    note: textOrNull(v.note),
    lines: (v.lines ?? []).map((l) => ({
      catalog: idRef(l.catalog),
      name: textOrNull(l.name),
      documentQuantity: numOrNull(l.documentQuantity),
      receivedQuantity: numOrNull(l.receivedQuantity),
      varianceReason: textOrNull(l.varianceReason),
      unitPrice: l.unitPrice ?? null,
      room: idRef(l.room),
      model: textOrNull(l.model),
      manufacturer: textOrNull(l.manufacturer),
    })),
  };
}

/** Ô chọn một bản ghi danh mục; giá trị trên form là `{ id, name }`, gửi đi chỉ `{ id }`. */
function RefField({ control, name, label, resource, placeholder, className, bare }: {
  control: Control<any>;
  name: string;
  label: string;
  resource: string;
  placeholder?: string;
  className?: string;
  /** Không vẽ nhãn (ô nằm trong bảng dòng). */
  bare?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {bare ? null : <FormLabel>{label}</FormLabel>}
          <FormControl>
            <AsyncCombobox<{ id: number; code?: string | null; name: string }>
              resource={resource}
              value={field.value?.id ?? null}
              fallbackLabel={field.value?.name}
              onChange={(id) => field.onChange(id == null ? NO_REF : { id })}
              onPick={(item) => field.onChange({ id: item.id, name: item.name })}
              labelOf={(item) => (item.code ? `${item.code} · ${item.name}` : item.name)}
              placeholder={placeholder ?? `Chọn ${label.toLowerCase()}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberCell({ control, name, min }: { control: Control<any>; name: string; min: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input type="number" min={min} inputMode="numeric" className="w-20 text-right tabular-nums"
              value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
              onBlur={field.onBlur} name={field.name} ref={field.ref} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Một dòng thiết bị: nhóm, tên, số lượng chứng từ / thực nhận, đơn giá, phòng nhận. */
function LineRow({ control, index, onRemove }: { control: Control<any>; index: number; onRemove: () => void }) {
  const p = `lines.${index}`;
  const [doc, recv, price] = useWatch({
    control,
    name: [`${p}.documentQuantity`, `${p}.receivedQuantity`, `${p}.unitPrice`],
  }) as [number | "", number | "", number | null];
  const differs = doc !== "" && recv !== "" && Number(doc) !== Number(recv);
  const amount = price != null && recv !== "" ? price * Number(recv) : null;
  return (
    <div className="grid gap-3 border-t px-4 py-4 first:border-t-0">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">Dòng {index + 1}</span>
        <Button type="button" variant="ghost" size="icon-sm" title="Bỏ dòng này" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <div className="grid items-start gap-3 @2xl:grid-cols-2">
        <RefField control={control} name={`${p}.catalog`} label="Nhóm thiết bị" resource="equipment_catalogs" />
        <TextField control={control} name={`${p}.name`} label="Tên trên chứng từ" placeholder="Trống = theo tên nhóm" />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <span className="text-sm font-medium">SL chứng từ</span>
          <NumberCell control={control} name={`${p}.documentQuantity`} min={1} />
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-medium">SL thực nhận</span>
          <NumberCell control={control} name={`${p}.receivedQuantity`} min={0} />
        </div>
        <FormField
          control={control}
          name={`${p}.unitPrice`}
          render={({ field }) => (
            <FormItem className="w-44">
              <FormLabel>Đơn giá</FormLabel>
              <FormControl>
                <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-1">
          <span className="text-sm font-medium">Thành tiền</span>
          <span className="flex h-9 items-center text-sm tabular-nums">{formatVnd(amount)}</span>
        </div>
      </div>
      {differs ? (
        <TextField control={control} name={`${p}.varianceReason`} label="Lý do chênh lệch"
          placeholder="Số thực nhận khác chứng từ, ghi lý do" />
      ) : null}
      <div className="grid items-start gap-3 @2xl:grid-cols-3">
        <RefField control={control} name={`${p}.room`} label="Phòng nhận" resource="rooms" placeholder="Trống = nhập kho" />
        <TextField control={control} name={`${p}.model`} label="Model" />
        <TextField control={control} name={`${p}.manufacturer`} label="Hãng sản xuất" />
      </div>
    </div>
  );
}

function LinesEditor({ control }: { control: Control<any> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = (useWatch({ control, name: "lines" }) ?? []) as { receivedQuantity: number | ""; unitPrice: number | null }[];
  const total = lines.reduce((s, l) => s + (l.unitPrice != null && l.receivedQuantity !== "" ? l.unitPrice * Number(l.receivedQuantity) : 0), 0);
  return (
    <VoucherLinesCard>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <StepTitle title="Thiết bị nhập" aside={fields.length ? `${fields.length} dòng · ${formatVnd(total)}` : undefined} />
        <Button type="button" variant="outline" size="sm" onClick={() => append({ ...NEW_LINE })}>
          <Plus />
          Thêm dòng
        </Button>
      </div>
      <div className="@container border-t">
        {fields.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            Chưa có thiết bị nào. Bấm "Thêm dòng" để khai thiết bị nhập về.
          </p>
        ) : (
          fields.map((f, i) => <LineRow key={f.id} control={control} index={i} onRemove={() => remove(i)} />)
        )}
      </div>
    </VoucherLinesCard>
  );
}

function HeadFields({ control }: VoucherFieldsProps) {
  return (
    <>
      <div className="grid items-start gap-x-4 gap-y-5 @2xl:grid-cols-2 @4xl:grid-cols-3">
        <DateField control={control} name="intakeDate" label="Ngày nhập" />
        <TextField control={control} name="supplier" label="Nhà cung cấp" />
        <RefField control={control} name="schoolYear" label="Năm học" resource="school_years" />
        <TextField control={control} name="documentNo" label="Số chứng từ" placeholder="Hoá đơn, hợp đồng, biên bản" />
        <DateField control={control} name="documentDate" label="Ngày chứng từ" />
        <SelectField control={control} name="fundingSource" label="Nguồn kinh phí" options={FUNDING_SOURCE_OPTIONS} />
        <RefField control={control} name="originSource" label="Nguồn hình thành" resource="origin_sources" />
        <RefField control={control} name="acquisitionMethod" label="Phương thức hình thành" resource="acquisition_methods" />
        <TextField control={control} name="warrantyMonths" label="Bảo hành (tháng)" type="number" />
      </div>
      <TextareaField control={control} name="note" label="Ghi chú" rows={2} />
      <LinesEditor control={control} />
    </>
  );
}

const REQUIRED = [{ name: "intakeDate", label: "Ngày nhập" }];

/** Lập / sửa phiếu nhập thiết bị (PN-01). */
export function EquipmentIntakeForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <VoucherFormPage
      mode={mode}
      defaults={DEFAULTS}
      toForm={toForm}
      toPayload={toPayload}
      required={REQUIRED}
    >
      {(props) => <HeadFields {...props} />}
    </VoucherFormPage>
  );
}
