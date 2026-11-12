import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { Info } from "lucide-react";
import { useWatch, type Control } from "react-hook-form";

import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { FormField, FormItem, FormLabel } from "@/shared/ui/form";
import type { EquipmentCatalog } from "@/domains/equipment-catalog/types";
import {
  ASSET_CATEGORY_LABELS,
  CATALOG_ORIGIN_LABELS,
  PHYSICAL_LABELS,
  TRACKING_LABELS,
} from "@/domains/equipment-catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { NormsOfCatalog } from "@/features/catalogs/extras/equipment-catalog-norms";
import { MultiRefPickerField } from "@/features/catalogs/multi-ref-picker-field";
import { RefSelectField } from "@/features/catalogs/ref-select-field";
import { SwitchField } from "@/features/catalogs/switch-field";

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

const GRID = "grid gap-4 sm:grid-cols-2";

/** Lời nhắc đầu form: thiết bị của thông tư không sửa tay mã, tên, môn học. */
function CircularNotice({ control }: { control: Control<CatalogFormValues> }) {
  const byCircular = useWatch({ control, name: "minimumRequired" }) === true;
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs sm:col-span-2 [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0">
      <Info />
      {byCircular
        ? "Thiết bị thuộc danh mục tối thiểu theo thông tư: mã, tên, cấp học, môn học không sửa tay — đổi bằng bản nháp bộ tiêu chuẩn ở màn Danh mục thiết bị tối thiểu."
        : "Thiết bị thêm tay là thiết bị ngoài danh mục tối thiểu (ngoài thông tư). Thiết bị của thông tư sinh ra khi áp dụng một bộ tiêu chuẩn."}
    </p>
  );
}

/** "Đối tượng sử dụng": hai ô tích trong một khung cao bằng ô nhập. */
function AudienceField({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <FormItem>
      <FormLabel>Đối tượng sử dụng</FormLabel>
      <div className="bg-field flex h-9 items-center gap-4 rounded-md border px-3">
        {(
          [
            ["usedByTeacher", "Giáo viên"],
            ["usedByStudent", "Học sinh"],
          ] as const
        ).map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={field.value === true} onCheckedChange={(checked) => field.onChange(checked === true)} />
                {label}
              </label>
            )}
          />
        ))}
      </div>
    </FormItem>
  );
}

function EquipmentCatalogFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <div className="space-y-5 sm:col-span-2">
      <CircularNotice control={control} />

      {/* 1. Nó LÀ gì: đơn vị tính, rồi xếp vào đâu (loại, cấp học, môn, khối). */}
      <FormSection title="Thông tin thiết bị" compact>
        <div className={GRID}>
          <RefSelectField control={control} name="equipmentType" label="Loại thiết bị" resource="equipment_types" placeholder="Vui lòng chọn loại thiết bị" />
          <RefSelectField control={control} name="unit" label="Đơn vị tính" resource="units" placeholder="Vui lòng chọn đơn vị tính" />
          <RefSelectField control={control} name="educationLevel" label="Cấp học" resource="education_levels" placeholder="Vui lòng chọn cấp học" />
          <div className="hidden sm:block" />
          <MultiRefPickerField
            control={control}
            name="subjects"
            resource="subjects"
            label="Môn học"
            unitLabel="môn"
            emptyHint="Chọn được nhiều môn; môn đầu tiên vào mã tài sản."
            className="sm:col-span-2"
          />
          <MultiRefPickerField
            control={control}
            name="grades"
            resource="grades"
            label="Khối lớp"
            unitLabel="khối"
            emptyHint="Chọn được nhiều khối; để trống là mọi khối."
            className="sm:col-span-2"
          />
          <TextareaField control={control} name="description" label="Mô tả / yêu cầu kỹ thuật" placeholder="Không bắt buộc" inGrid className="sm:col-span-2" />
        </div>
      </FormSection>

      {/* 2. Ta QUẢN LÝ nó thế nào. Khai MỘT LẦN ở đây, form tài sản và dòng phiếu ghi tăng điền theo. */}
      <FormSection title="Quản lý và hạch toán" compact>
        <div className={GRID}>
          <SelectField control={control} name="trackingType" label="Cách quản lý" options={options(TRACKING_LABELS)} />
          <SelectField control={control} name="assetCategory" label="Phân loại tài sản" options={options(ASSET_CATEGORY_LABELS)} placeholder="Vui lòng chọn phân loại tài sản" />
          <SelectField control={control} name="physicalOrDigital" label="Dạng thiết bị" options={options(PHYSICAL_LABELS)} placeholder="Vui lòng chọn dạng thiết bị" />
          <TextField
            control={control}
            name="usefulLifeYears"
            label="Số năm sử dụng"
            type="number"
            placeholder="VD: 5"
            rules={{
              min: { value: 0, message: "Số năm không được âm" },
              max: { value: 100, message: "Số năm tối đa 100" },
              validate: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Số năm sử dụng phải là số nguyên",
            }}
          />
          <AudienceField control={control} />
          <SwitchField control={control} name="selfMade" label="Thiết bị tự làm" />
        </div>
      </FormSection>

      {/* 3. Thứ ít dùng: nhóm cha, mã loại chuẩn, mã thống kê. */}
      <FormSection title="Thông tin khác" compact>
        <div className={GRID}>
          <RefSelectField control={control} name="parent" label="Thuộc nhóm" resource="equipment_catalogs" placeholder="Nhóm gốc" className="sm:col-span-2" />
          <TextField
            control={control}
            name="teachingCode"
            label="Mã loại thiết bị chuẩn"
            placeholder="ABC"
            rules={{ pattern: { value: /^$|^[A-Z]{3}$/, message: "Gồm đúng 3 chữ in hoa" } }}
          />
          <TextField control={control} name="statisticalCode" label="Mã thống kê" />
        </div>
      </FormSection>
    </div>
  );
}

const names = (refs: { name: string }[] | undefined) => (refs && refs.length ? refs.map((ref) => ref.name).join(", ") : undefined);

function EquipmentCatalogRead({ record }: { record: CatalogRecord }) {
  const item = record as EquipmentCatalog;
  const audience = [item.usedByTeacher ? "Giáo viên" : null, item.usedByStudent ? "Học sinh" : null].filter(Boolean).join(", ");
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {item.minimumRequired ? <Badge variant="info">Danh mục tối thiểu</Badge> : null}
        {item.ownerSchool ? <Badge variant="warning">Ngoài danh mục · {item.ownerSchool.name}</Badge> : null}
        {item.selfMade ? <Badge variant="neutral">Thiết bị tự làm</Badge> : null}
      </div>
      <ReadField label="Loại thiết bị">{item.equipmentType?.name}</ReadField>
      <ReadField label="Đơn vị tính">{item.unit?.name}</ReadField>
      <ReadField label="Cấp học">{item.educationLevel?.name}</ReadField>
      <ReadField label="Môn học">{names(item.subjects) ?? item.subject?.name}</ReadField>
      <ReadField label="Khối lớp">{names(item.grades) ?? item.grade?.name}</ReadField>
      <ReadField label="Cách quản lý">{TRACKING_LABELS[item.trackingType]}</ReadField>
      <ReadField label="Mô tả, yêu cầu kỹ thuật" className="sm:col-span-2">
        {item.description ? <span className="whitespace-pre-line">{item.description}</span> : "Chưa có mô tả."}
      </ReadField>

      <ReadField label="Thuộc nhóm">{item.parent?.name ?? "Nhóm gốc"}</ReadField>
      <ReadField label="Nguồn">{item.ownerSchool ? "Trường tự thêm" : "Danh mục của Sở"}</ReadField>
      {item.ownerSchool ? <ReadField label="Nguồn gốc">{item.origin ? CATALOG_ORIGIN_LABELS[item.origin] : undefined}</ReadField> : null}
      <ReadField label="Mã loại thiết bị chuẩn">{item.teachingCode ?? undefined}</ReadField>

      <ReadField label="Dạng thiết bị">{item.physicalOrDigital ? PHYSICAL_LABELS[item.physicalOrDigital] : undefined}</ReadField>
      <ReadField label="Loại tài sản">{item.assetCategory ? ASSET_CATEGORY_LABELS[item.assetCategory] : undefined}</ReadField>
      <ReadField label="Mã thống kê">{item.statisticalCode ?? undefined}</ReadField>
      <ReadField label="Số năm sử dụng">{item.usefulLifeYears ?? undefined}</ReadField>

      <ReadField label="Danh mục tối thiểu">{item.minimumRequired ? "Có" : "Không"}</ReadField>
      <ReadField label="Đối tượng sử dụng">{audience || undefined}</ReadField>
      <ReadField label="Căn cứ" className="sm:col-span-2">{item.legalBasis ?? undefined}</ReadField>

      <NormsOfCatalog catalogId={item.id} />
    </>
  );
}

function EquipmentCatalogFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return (
    <>
      <OptionFilter
        table={table}
        field="ownership"
        all="Nguồn"
        options={[
          { value: "official", label: "Danh mục của Sở" },
          { value: "school", label: "Ngoài danh mục (trường thêm)" },
        ]}
      />
      <OptionFilter
        table={table}
        field="minimumRequired"
        all="Danh mục tối thiểu"
        options={[
          { value: "true", label: "Thuộc danh mục tối thiểu" },
          { value: "false", label: "Không thuộc" },
        ]}
      />
    </>
  );
}

export const equipmentCatalogConfig: CatalogConfig = {
  resource: "equipment_catalogs",
  noun: "thiết bị",
  description: "Danh mục thiết bị dùng chung cho các trường THPT.",
  codeLabel: "Mã thiết bị",
  codePlaceholder: "THPT-TO-001",
  namePlaceholder: "Bộ thước vẽ bảng dạy học",
  extraKeys: ["parent", "equipmentType", "educationLevel", "subjects", "grades", "unit", "assetCategory",
    "trackingType", "physicalOrDigital", "teachingCode", "usefulLifeYears", "statisticalCode",
    "usedByTeacher", "usedByStudent", "selfMade", "description"],
  extraDefaults: { parent: null, equipmentType: null, educationLevel: null, subjects: [], grades: [],
    unit: null, assetCategory: null, trackingType: "SERIAL", physicalOrDigital: null, teachingCode: "",
    usefulLifeYears: null, statisticalCode: "", usedByTeacher: false, usedByStudent: false, selfMade: false,
    description: "" },
  extraColumns: [
    {
      id: "ownership",
      header: "Nguồn",
      size: 200,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original as EquipmentCatalog;
        return item.ownerSchool ? (
          <Badge variant="warning" title={item.origin ? CATALOG_ORIGIN_LABELS[item.origin] : undefined}>
            Ngoài DM · {item.ownerSchool.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Danh mục Sở</span>
        );
      },
    },
    {
      id: "parent",
      header: "Thuộc nhóm",
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (row.original as EquipmentCatalog).parent?.name ?? <span className="text-muted-foreground">Nhóm gốc</span>,
    },
    {
      id: "equipmentType",
      header: "Loại thiết bị",
      size: 150,
      enableSorting: false,
      cell: ({ row }) => (row.original as EquipmentCatalog).equipmentType?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "minimumRequired",
      header: "Tối thiểu",
      size: 130,
      enableSorting: false,
      cell: ({ row }) =>
        (row.original as EquipmentCatalog).minimumRequired ? <Badge variant="info">Tối thiểu</Badge> : <Badge variant="neutral">Ngoài thông tư</Badge>,
    },
  ],
  ExtraFields: EquipmentCatalogFields,
  ExtraRead: EquipmentCatalogRead,
  ExtraFilters: EquipmentCatalogFilters,
};
