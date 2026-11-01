import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import type { CatalogRef, Grade } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function GradeFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <FormField
        control={control}
        name="educationLevel"
        rules={{ required: "Chọn cấp học" }}
        render={({ field }) => {
          // Giá trị trên form là tham chiếu {id, mã, tên}; ô chọn chỉ cần id, tên dùng làm nhãn khi chưa tải.
          const current = field.value as CatalogRef | null;
          return (
            <FormItem>
              <FormLabel>Cấp học</FormLabel>
              <FormControl>
                <AsyncCombobox<CatalogRef>
                  resource="education_levels"
                  value={current?.id ?? null}
                  onChange={(id) => field.onChange(id == null ? null : { id })}
                  labelOf={(level) => level.name}
                  fallbackLabel={current?.name}
                  placeholder="Chọn cấp học"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <TextField
        control={control}
        name="gradeNumber"
        label="Số khối"
        type="number"
        placeholder="10"
        description="Dùng để sắp xếp và tính định mức theo khối."
      />
    </>
  );
}

function GradeRead({ record }: { record: CatalogRecord }) {
  const grade = record as Grade;
  return (
    <>
      <ReadField label="Cấp học">{grade.educationLevel?.name}</ReadField>
      <ReadField label="Số khối">{grade.gradeNumber ?? undefined}</ReadField>
    </>
  );
}

function GradeFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <RefFilter table={table} field="educationLevel.id" resource="education_levels" all="Mọi cấp học" />;
}

export const gradeConfig: CatalogConfig = {
  resource: "grades",
  noun: "khối lớp",
  description: "Khối lớp thuộc một cấp học; định mức thiết bị tính theo khối.",
  codePlaceholder: "K10",
  namePlaceholder: "Lớp 10",
  extraKeys: ["educationLevel", "gradeNumber"],
  extraDefaults: { educationLevel: null, gradeNumber: null },
  extraColumns: [
    {
      id: "educationLevel",
      header: "Cấp học",
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (row.original as Grade).educationLevel?.name ?? "—",
    },
    {
      id: "gradeNumber",
      header: "Số khối",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (row.original as Grade).gradeNumber ?? "—",
    },
  ],
  ExtraFields: GradeFields,
  ExtraRead: GradeRead,
  ExtraFilters: GradeFilters,
};
