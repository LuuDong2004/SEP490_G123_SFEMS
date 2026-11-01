import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import type { SubjectGroup } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";

function SubjectGroupFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <RefSelectField
      control={control}
      name="educationLevel"
      label="Cấp học"
      resource="education_levels"
      placeholder="Chọn cấp học"
      required="Chọn cấp học"
    />
  );
}

function SubjectGroupRead({ record }: { record: CatalogRecord }) {
  const group = record as SubjectGroup;
  return (
    <>
      <ReadField label="Cấp học">{group.educationLevel?.name}</ReadField>
      <ReadField label="Số môn">{group.subjectCount}</ReadField>
    </>
  );
}

function SubjectGroupFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <RefFilter table={table} field="educationLevel.id" resource="education_levels" all="Mọi cấp học" />;
}

export const subjectGroupConfig: CatalogConfig = {
  resource: "subject_groups",
  noun: "tổ chuyên môn",
  description: "Tổ chuyên môn của trường theo cấp học; số môn đếm theo các môn đã xếp vào tổ.",
  codePlaceholder: "TO_TOAN_TIN",
  namePlaceholder: "Tổ Toán – Tin",
  extraKeys: ["educationLevel"],
  extraDefaults: { educationLevel: null },
  extraColumns: [
    {
      id: "educationLevel",
      header: "Cấp học",
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (row.original as SubjectGroup).educationLevel?.name ?? "—",
    },
    {
      id: "subjectCount",
      header: "Số môn",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{(row.original as SubjectGroup).subjectCount}</span>,
    },
  ],
  ExtraFields: SubjectGroupFields,
  ExtraRead: SubjectGroupRead,
  ExtraFilters: SubjectGroupFilters,
};
