import type { Control } from "react-hook-form";

import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import type { Subject } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function SubjectFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <TextField
      control={control}
      name="shortCode"
      label="Mã môn"
      placeholder="TO"
      description="Thành phần MH trong mã tài sản; không trùng giữa các môn."
      rules={{ pattern: { value: /^[A-Za-z0-9]*$/, message: "Mã môn chỉ gồm chữ và số" } }}
    />
  );
}

function SubjectRead({ record }: { record: CatalogRecord }) {
  const shortCode = (record as Subject).shortCode;
  return (
    <ReadField label="Mã môn">{shortCode ? <span className="font-mono">{shortCode}</span> : undefined}</ReadField>
  );
}

export const subjectConfig: CatalogConfig = {
  resource: "subjects",
  noun: "môn học",
  description: "Môn học theo chương trình THPT; mã môn ngắn dùng để sinh mã tài sản.",
  codePlaceholder: "TOAN",
  namePlaceholder: "Toán",
  extraKeys: ["shortCode"],
  extraDefaults: { shortCode: "" },
  extraColumns: [
    {
      id: "shortCode",
      header: "Mã môn",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs">{(row.original as Subject).shortCode ?? "—"}</span>,
    },
  ],
  ExtraFields: SubjectFields,
  ExtraRead: SubjectRead,
};
