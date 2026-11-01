import type { Control } from "react-hook-form";

import { DateField } from "@/shared/components/form/simple-fields";
import { ReadField } from "@/shared/components/form/read-field";
import { formatPlainDate } from "@/shared/lib/format";
import type { SchoolYear } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function SchoolYearFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <DateField control={control} name="startDate" label="Ngày bắt đầu" rules={{ required: "Chọn ngày bắt đầu" }} />
      <DateField control={control} name="endDate" label="Ngày kết thúc" rules={{ required: "Chọn ngày kết thúc" }} />
    </>
  );
}

function SchoolYearRead({ record }: { record: CatalogRecord }) {
  const year = record as SchoolYear;
  return (
    <>
      <ReadField label="Ngày bắt đầu">{formatPlainDate(year.startDate)}</ReadField>
      <ReadField label="Ngày kết thúc">{formatPlainDate(year.endDate)}</ReadField>
    </>
  );
}

export const schoolYearConfig: CatalogConfig = {
  resource: "school_years",
  noun: "năm học",
  description: "Năm học và khoảng ngày của nó, dùng để lọc báo cáo và áp dụng bộ tiêu chuẩn.",
  codePlaceholder: "2026-2027",
  namePlaceholder: "Năm học 2026-2027",
  extraKeys: ["startDate", "endDate"],
  extraDefaults: { startDate: null, endDate: null },
  extraColumns: [
    {
      id: "startDate",
      header: "Bắt đầu",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as SchoolYear).startDate),
    },
    {
      id: "endDate",
      header: "Kết thúc",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as SchoolYear).endDate),
    },
  ],
  ExtraFields: SchoolYearFields,
  ExtraRead: SchoolYearRead,
};
