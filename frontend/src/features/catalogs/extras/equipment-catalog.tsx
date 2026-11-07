import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { OptionFilter, RefFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import type { EquipmentCatalog } from "@/domains/equipment-catalog/types";
import { ASSET_CATEGORY_LABELS, PHYSICAL_LABELS, TRACKING_LABELS } from "@/domains/equipment-catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";
import { SwitchField } from "@/features/catalogs/switch-field";

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function EquipmentCatalogFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <RefSelectField control={control} name="parent" label="Nhóm cha" resource="equipment_catalogs" placeholder="Không có nhóm cha" />
      <RefSelectField control={control} name="equipmentType" label="Loại thiết bị" resource="equipment_types" placeholder="Chọn loại thiết bị" />
      <RefSelectField control={control} name="subject" label="Môn học" resource="subjects" placeholder="Dùng chung các môn" />
      <RefSelectField control={control} name="educationLevel" label="Cấp học" resource="education_levels" placeholder="Dùng chung" />
      <RefSelectField control={control} name="grade" label="Khối lớp" resource="grades" placeholder="Mọi khối" />
      <RefSelectField control={control} name="unit" label="Đơn vị tính" resource="units" placeholder="Chọn đơn vị" />
      <SelectField control={control} name="assetCategory" label="Phân loại tài sản" options={options(ASSET_CATEGORY_LABELS)} placeholder="Chọn phân loại" />
      <SelectField control={control} name="trackingType" label="Cách quản lý" options={options(TRACKING_LABELS)}
        description="Chỉ vật tư và hoá chất được quản lý theo số lượng." />
      <SelectField control={control} name="physicalOrDigital" label="Dạng thiết bị" options={options(PHYSICAL_LABELS)} placeholder="Chọn dạng" />
      <TextField control={control} name="teachingCode" label="Mã loại chuẩn" placeholder="ABC" rules={{ pattern: { value: /^$|^[A-Z]{3}$/, message: "Nhập đúng 3 chữ in hoa" } }} />
      <TextField control={control} name="model" label="Model" />
      <TextField control={control} name="manufacturer" label="Hãng sản xuất" />
      <TextField control={control} name="usefulLifeYears" label="Thời gian sử dụng (năm)" type="number" rules={{ min: 0, max: 100 }} />
      <TextField control={control} name="statisticalCode" label="Mã thống kê" />
      <TextField control={control} name="legalBasis" label="Căn cứ pháp lý" />
      <SwitchField control={control} name="usedByTeacher" label="Giáo viên sử dụng" />
      <SwitchField control={control} name="usedByStudent" label="Học sinh sử dụng" />
      <TextareaField control={control} name="description" label="Mô tả chi tiết" inGrid className="sm:col-span-2" />
    </>
  );
}

function EquipmentCatalogRead({ record }: { record: CatalogRecord }) {
  const item = record as EquipmentCatalog;
  return (
    <>
      <ReadField label="Nhóm cha">{item.parent?.name}</ReadField>
      <ReadField label="Loại thiết bị">{item.equipmentType?.name}</ReadField>
      <ReadField label="Môn học">{item.subject?.name}</ReadField>
      <ReadField label="Cấp học">{item.educationLevel?.name}</ReadField>
      <ReadField label="Khối lớp">{item.grade?.name}</ReadField>
      <ReadField label="Đơn vị tính">{item.unit?.name}</ReadField>
      <ReadField label="Phân loại tài sản">{item.assetCategory ? ASSET_CATEGORY_LABELS[item.assetCategory] : undefined}</ReadField>
      <ReadField label="Cách quản lý">{TRACKING_LABELS[item.trackingType]}</ReadField>
      <ReadField label="Dạng thiết bị">{item.physicalOrDigital ? PHYSICAL_LABELS[item.physicalOrDigital] : undefined}</ReadField>
      <ReadField label="Mã loại chuẩn">{item.teachingCode}</ReadField>
      <ReadField label="Model">{item.model}</ReadField>
      <ReadField label="Hãng sản xuất">{item.manufacturer}</ReadField>
      <ReadField label="Thời gian sử dụng">{item.usefulLifeYears == null ? undefined : `${item.usefulLifeYears} năm`}</ReadField>
      <ReadField label="Mã thống kê">{item.statisticalCode}</ReadField>
      <ReadField label="Căn cứ pháp lý">{item.legalBasis}</ReadField>
      <ReadField label="Đối tượng sử dụng">{[item.usedByTeacher && "Giáo viên", item.usedByStudent && "Học sinh"].filter(Boolean).join(", ") || undefined}</ReadField>
      <ReadField label="Danh mục tối thiểu">{item.minimumRequired ? <Badge variant="info">Thuộc danh mục</Badge> : "Ngoài danh mục"}</ReadField>
      <ReadField label="Mô tả chi tiết" className="sm:col-span-2">{item.description}</ReadField>
    </>
  );
}

function EquipmentCatalogFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <>
    <RefFilter table={table} field="equipmentType.id" resource="equipment_types" all="Mọi loại thiết bị" />
    <RefFilter table={table} field="subject.id" resource="subjects" all="Mọi môn học" />
    <OptionFilter table={table} field="trackingType" all="Mọi cách quản lý" options={options(TRACKING_LABELS)} />
    <OptionFilter table={table} field="minimumRequired" all="Mọi danh mục" options={[
      { value: "true", label: "Danh mục tối thiểu" },
      { value: "false", label: "Ngoài danh mục tối thiểu" },
    ]} />
  </>;
}

export const equipmentCatalogConfig: CatalogConfig = {
  resource: "equipment_catalogs",
  noun: "thiết bị trong danh mục",
  description: "Danh mục thiết bị dùng chung cho các trường THPT.",
  codePlaceholder: "THPT-TOAN-001",
  namePlaceholder: "Tên thiết bị",
  extraKeys: ["parent", "equipmentType", "subject", "educationLevel", "grade", "unit", "assetCategory",
    "trackingType", "physicalOrDigital", "teachingCode", "model", "manufacturer", "usefulLifeYears",
    "statisticalCode", "legalBasis", "usedByTeacher", "usedByStudent", "description"],
  extraDefaults: { parent: null, equipmentType: null, subject: null, educationLevel: null, grade: null,
    unit: null, assetCategory: null, trackingType: "SERIAL", physicalOrDigital: null, teachingCode: "",
    model: "", manufacturer: "", usefulLifeYears: null, statisticalCode: "", legalBasis: "",
    usedByTeacher: false, usedByStudent: false, description: "" },
  extraColumns: [
    { id: "equipmentType", header: "Loại thiết bị", size: 150, cell: ({ row }) => (row.original as EquipmentCatalog).equipmentType?.name ?? "—" },
    { id: "subject", header: "Môn học", size: 150, cell: ({ row }) => (row.original as EquipmentCatalog).subject?.name ?? "Dùng chung" },
    { id: "unit", header: "Đơn vị", size: 110, cell: ({ row }) => (row.original as EquipmentCatalog).unit?.name ?? "—" },
    { id: "trackingType", header: "Cách quản lý", size: 120, cell: ({ row }) => TRACKING_LABELS[(row.original as EquipmentCatalog).trackingType] },
  ],
  ExtraFields: EquipmentCatalogFields,
  ExtraRead: EquipmentCatalogRead,
  ExtraFilters: EquipmentCatalogFilters,
};
