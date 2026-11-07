import { useWatch, type Control } from "react-hook-form";
import { useEffect, useRef } from "react";
import { useList, useOne, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";
import { SwitchField } from "@/features/catalogs/switch-field";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { StandardDocument } from "@/features/catalogs/extras/standard-documents";

const BASIS = { PER_CLASS: "Theo lớp", PER_SCHOOL: "Theo trường", PER_STUDENT: "Theo học sinh", PER_TEACHER: "Theo giáo viên", PER_ROOM: "Theo phòng" } as const;
type Norm = CatalogRecord & { standard: { name: string } | null; standardStatus: string; catalog: { name: string } | null;
  sourceDocument: StandardDocument | null;
  subject: { name: string } | null; grade: { name: string } | null; unit: { name: string } | null;
  minQuantity: number | null; normBasis: keyof typeof BASIS; basisSize: number | null;
  itemNo: string | null; gradeLevels: string | null; sectionName: string | null; topic: string | null; optional: boolean };

function DraftStandardField({ control }: { control: Control<CatalogFormValues> }) {
  const { result } = useList<{ id: number; name: string; code: string }>({
    resource: "equipment_standards",
    filters: [{ field: "status", operator: "eq", value: "DRAFT" }],
    pagination: { pageSize: 100 },
  });
  const drafts = result.data ?? [];
  return <FormField control={control} name="standard" rules={{ required: "Chọn bộ tiêu chuẩn" }}
    render={({ field }) => <FormItem>
      <FormLabel>Bộ tiêu chuẩn</FormLabel>
      <Select value={(field.value as { id?: number } | null)?.id?.toString() ?? ""}
        onValueChange={(value) => field.onChange({ id: Number(value) })}>
        <FormControl><SelectTrigger><SelectValue placeholder="Chọn bản nháp" /></SelectTrigger></FormControl>
        <SelectContent>{drafts.map((draft) => <SelectItem key={draft.id} value={String(draft.id)}>{draft.name} ({draft.code})</SelectItem>)}</SelectContent>
      </Select>
      <FormMessage />
    </FormItem>} />;
}

function SourceDocumentField({ control }: { control: Control<CatalogFormValues> }) {
  const standard = useWatch({ control, name: "standard" }) as { id?: number } | null;
  const { result } = useOne<{ documents: StandardDocument[] }>({
    resource: "equipment_standards", id: standard?.id ?? "",
    queryOptions: { enabled: standard?.id != null },
  });
  const documents = result?.documents ?? [];
  return <FormField control={control} name="sourceDocument" render={({ field }) =>
    <FormItem><FormLabel>Văn bản căn cứ của dòng</FormLabel>
      <Select value={(field.value as { id?: number } | null)?.id?.toString() ?? "none"}
        onValueChange={(value) => field.onChange(value === "none" ? { id: null } : { id: Number(value) })}>
        <FormControl><SelectTrigger><SelectValue placeholder="Chọn văn bản" /></SelectTrigger></FormControl>
        <SelectContent><SelectItem value="none">Chưa gắn văn bản</SelectItem>
          {documents.map((document) => <SelectItem key={document.id} value={String(document.id)}>{document.documentNo}</SelectItem>)}
        </SelectContent>
      </Select><FormMessage />
    </FormItem>} />;
}

function Fields({ control }: { control: Control<CatalogFormValues> }) {
  return <>
    <DraftStandardField control={control} />
    <SourceDocumentField control={control} />
    <RefSelectField control={control} name="catalog" label="Thiết bị trong danh mục" resource="equipment_catalogs" placeholder="Chọn thiết bị" />
    <RefSelectField control={control} name="subject" label="Môn học" resource="subjects" placeholder="Dùng chung" />
    <RefSelectField control={control} name="grade" label="Khối lớp" resource="grades" placeholder="Mọi khối" />
    <RefSelectField control={control} name="equipmentType" label="Loại thiết bị" resource="equipment_types" placeholder="Theo thiết bị" />
    <RefSelectField control={control} name="roomType" label="Loại phòng" resource="room_types" placeholder="Không áp dụng" />
    <RefSelectField control={control} name="unit" label="Đơn vị tính" resource="units" placeholder="Theo thiết bị" />
    <SelectField control={control} name="normBasis" label="Căn cứ tính" options={Object.entries(BASIS).map(([value, label]) => ({ value, label }))} />
    <TextField control={control} name="minQuantity" label="Số lượng tối thiểu" type="number" rules={{ min: 0 }} />
    <TextField control={control} name="basisSize" label="Trên mỗi nhóm" type="number" rules={{ min: 1 }} />
    <TextField control={control} name="quantityText" label="Số lượng theo văn bản" />
    <TextField control={control} name="unitText" label="Đơn vị theo văn bản" />
    <TextField control={control} name="itemNo" label="Số thứ tự phụ lục" />
    <TextField control={control} name="gradeLevels" label="Áp dụng cho khối lớp" placeholder="10,11,12" />
    <TextField control={control} name="sectionName" label="Mục trong phụ lục" />
    <TextField control={control} name="topic" label="Chủ đề" />
    <SwitchField control={control} name="forTeacher" label="Giáo viên sử dụng" />
    <SwitchField control={control} name="forStudent" label="Học sinh sử dụng" />
    <SwitchField control={control} name="optional" label="Thiết bị tự chọn" />
    <TextareaField control={control} name="purpose" label="Mục đích" inGrid className="sm:col-span-2" />
    <TextareaField control={control} name="description" label="Mô tả chi tiết" inGrid className="sm:col-span-2" />
  </>;
}

function Read({ record }: { record: CatalogRecord }) {
  const item = record as Norm;
  return <>
    <ReadField label="Bộ tiêu chuẩn">{item.standard?.name}</ReadField>
    <ReadField label="Văn bản căn cứ">{item.sourceDocument?.documentNo}</ReadField>
    <ReadField label="Thiết bị">{item.catalog?.name}</ReadField>
    <ReadField label="Môn học">{item.subject?.name}</ReadField>
    <ReadField label="Khối lớp">{item.grade?.name}</ReadField>
    <ReadField label="Số lượng tối thiểu">{item.minQuantity}</ReadField>
    <ReadField label="Căn cứ tính">{BASIS[item.normBasis]}</ReadField>
    <ReadField label="Cỡ nhóm">{item.basisSize}</ReadField>
    <ReadField label="Đơn vị tính">{item.unit?.name}</ReadField>
    <ReadField label="Số thứ tự phụ lục">{item.itemNo}</ReadField>
    <ReadField label="Áp dụng cho khối lớp">{item.gradeLevels}</ReadField>
    <ReadField label="Mục trong phụ lục">{item.sectionName}</ReadField>
    <ReadField label="Chủ đề">{item.topic}</ReadField>
    <ReadField label="Loại dòng">{item.optional ? "Tự chọn" : "Bắt buộc"}</ReadField>
  </>;
}

function Filters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  const { result } = useList<{ id: number }>({
    resource: "equipment_standards",
    filters: [{ field: "status", operator: "eq", value: "ACTIVE" }],
    pagination: { pageSize: 1 },
  });
  const activeId = result.data?.[0]?.id;
  const initialized = useRef(false);
  const { setColumnFilters } = table.reactTable;
  useEffect(() => {
    if (initialized.current || !activeId) return;
    initialized.current = true;
    setColumnFilters((prev) => prev.some((filter) => filter.id === "standard.id") ? prev
      : [...prev, { id: "standard.id", value: activeId }] as ColumnFiltersState);
  }, [activeId, setColumnFilters]);
  return <>
    <RefFilter table={table} field="standard.id" resource="equipment_standards" all="Mọi bộ tiêu chuẩn" />
    <RefFilter table={table} field="subject.id" resource="subjects" all="Mọi môn học" />
    <RefFilter table={table} field="grade.id" resource="grades" all="Mọi khối lớp" />
  </>;
}

export const equipmentNormConfig: CatalogConfig = {
  resource: "equipment_norms", noun: "dòng định mức", description: "Chỉ sửa dòng của bộ tiêu chuẩn đang là bản nháp.",
  codePlaceholder: "TT39-TOAN-001", namePlaceholder: "Tên thiết bị theo phụ lục",
  extraKeys: ["standard", "catalog", "sourceDocument", "equipmentType", "subject", "grade", "roomType", "unit",
    "normBasis", "minQuantity", "basisSize", "quantityText", "unitText", "itemNo", "gradeLevels", "sectionName", "topic",
    "purpose", "description", "forTeacher", "forStudent", "optional"],
  extraDefaults: { standard: null, catalog: null, sourceDocument: null, equipmentType: null, subject: null, grade: null,
    roomType: null, unit: null, normBasis: "PER_SCHOOL", minQuantity: null, basisSize: 1,
    quantityText: "", unitText: "", itemNo: "", gradeLevels: "", sectionName: "", topic: "", purpose: "", description: "",
    forTeacher: false, forStudent: false, optional: false },
  extraColumns: [
    { id: "standard", header: "Bộ tiêu chuẩn", size: 180, enableSorting: false, cell: ({ row }) => (row.original as Norm).standard?.name ?? "—" },
    { id: "subject", header: "Môn học", size: 130, enableSorting: false, cell: ({ row }) => (row.original as Norm).subject?.name ?? "Dùng chung" },
    { id: "gradeLevels", header: "Khối lớp", size: 100, enableSorting: false, cell: ({ row }) => (row.original as Norm).gradeLevels ?? "—" },
    { id: "minQuantity", header: "Số lượng", size: 110, enableSorting: false, cell: ({ row }) => (row.original as Norm).minQuantity ?? "—" },
    { id: "normBasis", header: "Căn cứ", size: 130, enableSorting: false, cell: ({ row }) => BASIS[(row.original as Norm).normBasis] },
  ], ExtraFields: Fields, ExtraRead: Read, ExtraFilters: Filters,
  canModify: (record) => (record as Norm).standardStatus === "DRAFT",
  listLink: { to: "/catalogs/equipment-standards", label: "Xem bộ tiêu chuẩn" },
};
