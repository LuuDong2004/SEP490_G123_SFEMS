import { useOne } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { RefField } from "@/shared/components/catalog/ref-field";
import { numberRules } from "@/shared/lib/field-rules";
import { NORM_BASIS_LABELS, quantityLabel } from "@/domains/equipment-standard/types";

/* eslint-disable @typescript-eslint/no-explicit-any */


const NONE = "__none__";

/** Văn bản nguồn: chỉ các văn bản CỦA bộ tiêu chuẩn đang chọn. */
function SourceDocumentField({ control, record }: { control: Control<any>; record?: any }) {
  const standardId = useWatch({ control, name: "standard.id" });
  const { result } = useOne<any>({
    resource: "equipment_standards",
    id: standardId ?? "",
    queryOptions: { enabled: !!standardId },
  });

  const items = useMemo(() => {
    const docs: any[] = standardId ? (result?.documents ?? []) : [];
    const list = docs.map((d) => ({ value: String(d.id), label: d.documentNo }));
    const cur = record?.sourceDocument;
    if (cur?.id && !list.some((o) => o.value === String(cur.id))) {
      list.unshift({ value: String(cur.id), label: cur.documentNo });
    }
    return list;
  }, [result, standardId, record?.sourceDocument]);

  return (
    <FormField
      control={control}
      name="sourceDocument.id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Văn bản quy định</FormLabel>
          <Select
            disabled={!standardId}
            onValueChange={(v) => field.onChange(v === NONE ? null : Number(v))}
            value={field.value == null ? "" : String(field.value)}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={standardId ? "Vui lòng chọn văn bản" : "Chọn bộ tiêu chuẩn trước"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NormFields({ control, record }: { control: Control<any>; record?: any }) {
  const { setValue } = useFormContext();
  // Cấp học của bộ tiêu chuẩn đang chọn — khối lớp và môn học lọc theo nó.
  const standardId = useWatch({ control, name: "standard.id" });
  const { result: standard } = useOne<any>({
    resource: "equipment_standards",
    id: standardId ?? "",
    queryOptions: { enabled: !!standardId },
  });
  const levelId = standardId ? standard?.educationLevel?.id : undefined;
  const byLevel = levelId ? [{ field: "educationLevel.id", operator: "eq" as const, value: levelId }] : undefined;
  return (
    <>
      <div className="form-flow">
        <RefField
          control={control}
          name="standard"
          resource="equipment_standards"
          label="Bộ tiêu chuẩn"
          current={record?.standard}
          required
          onPicked={() => {
            // Đổi bộ: văn bản và khối lớp của bộ cũ không còn hợp lệ.
            setValue("sourceDocument.id", null, { shouldDirty: true });
            setValue("grade.id", null, { shouldDirty: true });
          }}
        />
        <SourceDocumentField control={control} record={record} />
      </div>
      <div className="form-flow">
        <RefField
          control={control}
          name="equipmentType"
          resource="equipment_types"
          label="Loại thiết bị"
          current={record?.equipmentType}
        />
        <RefField
          control={control}
          name="subject"
          resource="subjects"
          label="Môn học"
          current={record?.subject}
          filters={byLevel}
        />
        <RefField
          control={control}
          name="grade"
          resource="grades"
          label="Khối lớp"
          current={record?.grade}
          filters={byLevel}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <FormField
          control={control}
          name="minQuantity"
          // `EquipmentNormRequest.minQuantity`: DECIMAL_QUANTITY.
          rules={numberRules("DECIMAL_QUANTITY", "Số lượng tối thiểu")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Số lượng tối thiểu</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="VD: 1"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <RefField control={control} name="unit" resource="units" label="Đơn vị tính" current={record?.unit} />
        <FormField
          control={control}
          name="normBasis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tính theo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? "per_school"}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(NORM_BASIS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <RefField
          control={control}
          name="roomType"
          resource="room_types"
          label="Loại phòng"
          current={record?.roomType}
        />
      </div>
    </>
  );
}

const refColumn = (key: string, header: string): ColumnDef<any, any> => ({
  id: key,
  header,
  enableSorting: false,
  cell: ({ row }) => row.original[key]?.name ?? <span className="text-muted-foreground">—</span>,
});

export const NORM_EXTRA = {
  section: { title: "Định mức" },
  defaults: {
    standard: { id: null },
    equipmentType: { id: null },
    subject: { id: null },
    grade: { id: null },
    roomType: { id: null },
    unit: { id: null },
    sourceDocument: { id: null },
    minQuantity: null,
    normBasis: "per_school",
  },
  Fields: NormFields,
  columns: [
    refColumn("standard", "Bộ tiêu chuẩn"),
    refColumn("subject", "Môn học"),
    {
      id: "minQuantity",
      header: "Số lượng",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {quantityLabel(row.original)} {row.original.unit?.name ?? ""}
        </span>
      ),
    },
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Bộ tiêu chuẩn", value: r?.standard?.name ?? "—" },
    { label: "Loại thiết bị", value: r?.equipmentType?.name ?? "—" },
    { label: "Môn học", value: r?.subject?.name ?? "Chung, không theo môn" },
    { label: "Khối lớp", value: r?.grade?.name ?? "Mọi khối" },
    { label: "Loại phòng", value: r?.roomType?.name ?? "Cả trường" },
    {
      label: "Số lượng tối thiểu",
      value: `${r?.minQuantity ?? "—"} ${r?.unit?.name ?? ""}`,
    },
    {
      label: "Tính theo",
      value: r?.normBasis ? <Badge variant="neutral">{NORM_BASIS_LABELS[r.normBasis]}</Badge> : "—",
    },
    { label: "Văn bản quy định", value: r?.sourceDocument?.documentNo ?? "—" },
  ],
};
