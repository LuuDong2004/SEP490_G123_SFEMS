import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import type { Grade } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";

function GradeFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <RefSelectField
        control={control}
        name="educationLevel"
        label="Cấp học"
        resource="education_levels"
        placeholder="Chọn cấp học"
        required="Chọn cấp học"
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
