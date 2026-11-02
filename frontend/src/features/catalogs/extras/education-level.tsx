import type { Control } from "react-hook-form";

import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import type { EducationLevel } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function EducationLevelFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <TextField
      control={control}
      name="shortName"
      label="Tên viết tắt"
      placeholder="THPT"
      description="Dùng ở chỗ hẹp như cột bảng, nhãn."
    />
  );
}

function EducationLevelRead({ record }: { record: CatalogRecord }) {
  return <ReadField label="Tên viết tắt">{(record as EducationLevel).shortName ?? undefined}</ReadField>;
}

export const educationLevelConfig: CatalogConfig = {
  resource: "education_levels",
  noun: "cấp học",
  description: "Cấp học của trường; phạm vi đồ án là cấp THPT.",
  // API cấp học chưa dùng quy tắc sinh mã: mã luôn phải gõ.
  codeRequired: true,
  codePlaceholder: "THPT",
  namePlaceholder: "Trung học phổ thông",
  extraKeys: ["shortName"],
  extraDefaults: { shortName: "" },
  extraColumns: [
    {
      id: "shortName",
      header: "Viết tắt",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => (row.original as EducationLevel).shortName ?? "—",
    },
  ],
  ExtraFields: EducationLevelFields,
  ExtraRead: EducationLevelRead,
};
