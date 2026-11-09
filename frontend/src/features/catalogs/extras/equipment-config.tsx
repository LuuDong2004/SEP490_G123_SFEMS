import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type Control } from "react-hook-form";

import { ReadField } from "@/shared/components/form/read-field";
import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { DATA_TYPE_LABELS, type EquipmentConfig } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { MultiRefPickerField } from "@/features/catalogs/multi-ref-picker-field";
import { RefSelectField } from "@/features/catalogs/ref-select-field";

const DATA_TYPE_OPTIONS = Object.entries(DATA_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const NEW_ATTRIBUTE = {
  id: null,
  code: "",
  name: "",
  dataType: "text",
  measureUnit: "",
  required: false,
  options: [],
};

/** Ô lựa chọn cho kiểu "Chọn từ danh sách": mỗi dòng một giá trị, lưu thành mảng. */
function OptionsInput({ control, index }: { control: Control<CatalogFormValues>; index: number }) {
  const dataType = useWatch({ control, name: `attributes.${index}.dataType` });
  if (dataType !== "enum") return null;
  return (
    <FormField
      control={control}
      name={`attributes.${index}.options`}
      render={({ field }) => (
        <FormItem className="mt-4">
          <FormLabel>Các lựa chọn (mỗi dòng một giá trị)</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              value={Array.isArray(field.value) ? (field.value as string[]).join("\n") : ""}
              onChange={(e) => field.onChange(e.target.value.split("\n"))}
              onBlur={field.onBlur}
              placeholder={"LCD\nLED\nOLED"}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function AttributesField({ control }: { control: Control<CatalogFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "attributes" as never, keyName: "_key" });

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Thông số kỹ thuật</span>
        <Button type="button" variant="outline" size="sm" onClick={() => append(NEW_ATTRIBUTE as never)}>
          <Plus />
          Thêm thông số
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          Chưa có thông số nào.
        </p>
      ) : (
        fields.map((item, i) => (
          <div key={item._key} className="border-border relative rounded-lg border p-4">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Xoá thông số"
              className="text-muted-foreground hover:text-destructive absolute top-2 right-2"
              onClick={() => remove(i)}
            >
              <Trash2 />
            </Button>
            <div className="grid gap-4 pr-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_7rem_auto] sm:items-start">
              <TextField
                control={control}
                name={`attributes.${i}.name`}
                label="Tên thông số"
                placeholder="Công suất"
                rules={{ required: "Nhập tên" }}
              />
              <TextField
                control={control}
                name={`attributes.${i}.code`}
                label="Mã"
                placeholder="cong_suat"
                rules={{
                  required: "Nhập mã",
                  pattern: { value: /^[A-Za-z0-9_]+$/, message: "Chữ không dấu, số, _" },
                }}
              />
              <SelectField control={control} name={`attributes.${i}.dataType`} label="Kiểu dữ liệu" options={DATA_TYPE_OPTIONS} />
              <TextField control={control} name={`attributes.${i}.measureUnit`} label="Đơn vị" placeholder="W" />
              <FormField
                control={control}
                name={`attributes.${i}.required`}
                render={({ field }) => (
                  <FormItem className="items-center">
                    <FormLabel>Bắt buộc</FormLabel>
                    <FormControl>
                      <Switch className="mt-2" checked={field.value === true} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <OptionsInput control={control} index={i} />
          </div>
        ))
      )}
    </div>
  );
}

function EquipmentConfigFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <TextareaField control={control} name="description" label="Mô tả" rows={2} inGrid className="sm:col-span-2" />
      <MultiRefPickerField
        control={control}
        name="scopeTypes"
        resource="equipment_types"
        label="Áp dụng cho loại thiết bị"
        unitLabel="loại"
        emptyHint="Để trống thì dùng cho mọi loại thiết bị."
        className="sm:col-span-2"
      />
      <FormField
        control={control}
        name="defaultConfig"
        render={({ field }) => (
          <FormItem className="border-border flex flex-row items-center justify-between gap-6 rounded-lg border px-4 py-2.5 sm:col-span-2 sm:max-w-xs">
            <FormLabel>Bộ mặc định</FormLabel>
            <FormControl>
              <Switch checked={field.value === true} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <TextField control={control} name="documentNo" label="Số hiệu văn bản" placeholder="37/2021/TT-BGDĐT" />
      <TextField control={control} name="documentName" label="Trích yếu" />
      <DateField control={control} name="issueDate" label="Ngày ban hành" />
      <div className="hidden sm:block" />
      <RefSelectField control={control} name="startSchoolYear" label="Năm học bắt đầu" resource="school_years" placeholder="Chọn năm học" />
      <RefSelectField control={control} name="endSchoolYear" label="Năm học kết thúc" resource="school_years" placeholder="Chọn năm học" />
      <AttributesField control={control} />
    </>
  );
}

function scopeText(config: EquipmentConfig) {
  return config.scopeTypes.length === 0 ? "Mọi loại" : config.scopeTypes.map((type) => type.name).join(", ");
}

function EquipmentConfigRead({ record }: { record: CatalogRecord }) {
  const config = record as EquipmentConfig;
  const years =
    !config.startSchoolYear && !config.endSchoolYear
      ? "Không giới hạn"
      : `${config.startSchoolYear?.name ?? "…"} → ${config.endSchoolYear?.name ?? "nay"}`;
  const documentText = config.documentNo
    ? `${config.documentNo}${config.documentName ? ` — ${config.documentName}` : ""}`
    : undefined;

  return (
    <>
      <ReadField label="Mô tả" className="sm:col-span-2">{config.description || undefined}</ReadField>
      <ReadField label="Loại thiết bị áp dụng" className="sm:col-span-2">{scopeText(config)}</ReadField>
      <ReadField label="Bộ mặc định">{config.defaultConfig ? "Có" : "Không"}</ReadField>
      <ReadField label="Ngày ban hành">{config.issueDate ? formatPlainDate(config.issueDate) : undefined}</ReadField>
      <ReadField label="Văn bản" className="sm:col-span-2">{documentText}</ReadField>
      <ReadField label="Năm học áp dụng" className="sm:col-span-2">{years}</ReadField>
      <ReadField label="Thông số kỹ thuật" className="sm:col-span-2">
        {config.attributes.length === 0 ? undefined : (
          <ul className="space-y-1 py-1">
            {config.attributes.map((attribute) => (
              <li key={attribute.id} className="flex flex-wrap items-center gap-2">
                <span>{attribute.name}</span>
                <Badge variant="neutral">{DATA_TYPE_LABELS[attribute.dataType] ?? attribute.dataType}</Badge>
                {attribute.measureUnit ? <span className="text-muted-foreground font-normal">({attribute.measureUnit})</span> : null}
                {attribute.required ? <span className="text-destructive text-xs font-normal">bắt buộc</span> : null}
                {attribute.dataType === "enum" && attribute.options.length ? (
                  <span className="text-muted-foreground text-xs font-normal">{attribute.options.join(" · ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ReadField>
    </>
  );
}

export const equipmentConfigConfig: CatalogConfig = {
  resource: "equipment_configs",
  noun: "bộ thông số kỹ thuật",
  description: "Các thông số mà từng loại thiết bị phải khai.",
  codePlaceholder: "TS-MAY-CHIEU",
  namePlaceholder: "Thông số máy chiếu",
  extraKeys: [
    "description",
    "defaultConfig",
    "scopeTypes",
    "documentNo",
    "documentName",
    "issueDate",
    "startSchoolYear",
    "endSchoolYear",
    "attributes",
  ],
  extraDefaults: {
    description: "",
    defaultConfig: false,
    scopeTypes: [],
    documentNo: "",
    documentName: "",
    issueDate: null,
    startSchoolYear: null,
    endSchoolYear: null,
    attributes: [],
  },
  extraColumns: [
    {
      id: "scopeTypes",
      header: "Loại thiết bị",
      size: 220,
      enableSorting: false,
      cell: ({ row }) => {
        const config = row.original as EquipmentConfig;
        return config.scopeTypes.length === 0 ? <span className="text-muted-foreground">Mọi loại</span> : scopeText(config);
      },
    },
    {
      id: "attributes",
      header: "Số thông số",
      size: 110,
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{(row.original as EquipmentConfig).attributes.length}</span>,
    },
    {
      id: "defaultConfig",
      header: "Mặc định",
      size: 110,
      enableSorting: false,
      cell: ({ row }) => ((row.original as EquipmentConfig).defaultConfig ? <Badge variant="info">Mặc định</Badge> : null),
    },
  ],
  ExtraFields: EquipmentConfigFields,
  ExtraRead: EquipmentConfigRead,
};
