import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import type { Subject } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";

function SubjectFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <RefSelectField
        control={control}
        name="educationLevel"
        label="Cấp học giảng dạy"
        resource="education_levels"
        placeholder="Chọn cấp học"
        required="Chọn cấp học giảng dạy"
      />
      <RefSelectField
        control={control}
        name="subjectGroup"
        label="Tổ chuyên môn"
        resource="subject_groups"
        placeholder="Chưa xếp tổ"
      />
      <TextField
        control={control}
        name="shortCode"
        label="Ký hiệu"
        placeholder="TO"
        description="Thành phần MH trong mã tài sản; không trùng giữa các môn."
        rules={{ pattern: { value: /^[A-Za-z0-9]*$/, message: "Ký hiệu chỉ gồm chữ và số" } }}
      />
    </>
  );
}

function SubjectRead({ record }: { record: CatalogRecord }) {
  const subject = record as Subject;
  return (
    <>
      <ReadField label="Cấp học giảng dạy">{subject.educationLevel?.name}</ReadField>
      <ReadField label="Tổ chuyên môn">{subject.subjectGroup?.name}</ReadField>
      <ReadField label="Ký hiệu">
        {subject.shortCode ? <span className="font-mono">{subject.shortCode}</span> : undefined}
      </ReadField>
    </>
  );
}

function SubjectFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <RefFilter table={table} field="subjectGroup.id" resource="subject_groups" all="Mọi tổ chuyên môn" />;
}

export const subjectConfig: CatalogConfig = {
  resource: "subjects",
  noun: "môn học",
  description: "Môn học theo chương trình THPT, thuộc một cấp học và một tổ chuyên môn.",
  codeLabel: "Mã môn",
  codePlaceholder: "TOAN",
  namePlaceholder: "Toán",
  extraKeys: ["educationLevel", "subjectGroup", "shortCode"],
  extraDefaults: { educationLevel: null, subjectGroup: null, shortCode: "" },
  extraColumns: [
    {
      id: "shortCode",
      header: "Ký hiệu",
      size: 90,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs">{(row.original as Subject).shortCode ?? "—"}</span>,
    },
    {
      id: "subjectGroup",
      header: "Tổ chuyên môn",
      size: 200,
      enableSorting: false,
      cell: ({ row }) => (row.original as Subject).subjectGroup?.name ?? "—",
    },
    {
      id: "educationLevel",
      header: "Cấp học giảng dạy",
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (row.original as Subject).educationLevel?.name ?? "—",
    },
  ],
  ExtraFields: SubjectFields,
  ExtraRead: SubjectRead,
  ExtraFilters: SubjectFilters,
};
