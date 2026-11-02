import type { Control } from "react-hook-form";

import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import type { SchoolType } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function SchoolTypeFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <TextField
      control={control}
      name="shortName"
      label="Tên viết tắt"
      placeholder="CL"
      description="Dùng ở chỗ hẹp như cột bảng."
    />
  );
}

function SchoolTypeRead({ record }: { record: CatalogRecord }) {
  return <ReadField label="Tên viết tắt">{(record as SchoolType).shortName ?? undefined}</ReadField>;
}

export const schoolTypeConfig: CatalogConfig = {
  resource: "school_types",
  noun: "loại hình trường",
  description: "Loại hình của trường theo Luật Giáo dục: công lập, dân lập, tư thục.",
  codePlaceholder: "CONG_LAP",
  namePlaceholder: "Công lập",
  extraKeys: ["shortName"],
  extraDefaults: { shortName: "" },
  extraColumns: [
    {
      id: "shortName",
      header: "Tên viết tắt",
      size: 140,
      enableSorting: false,
      cell: ({ row }) => (row.original as SchoolType).shortName ?? "—",
    },
  ],
  ExtraFields: SchoolTypeFields,
  ExtraRead: SchoolTypeRead,
};
