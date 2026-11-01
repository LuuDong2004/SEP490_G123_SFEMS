import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { RefFilter } from "@/shared/components/data-table/ref-filter";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { ReadField } from "@/shared/components/form/read-field";
import { DateField } from "@/shared/components/form/simple-fields";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { formatPlainDate } from "@/shared/lib/format";
import type { CatalogRef, Semester } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function SemesterFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <FormField
        control={control}
        name="schoolYear"
        rules={{ required: "Chọn năm học" }}
        render={({ field }) => {
          // Giá trị trên form là tham chiếu {id, mã, tên}; ô chọn chỉ cần id, tên dùng làm nhãn khi chưa tải.
          const current = field.value as CatalogRef | null;
          return (
            <FormItem className="sm:col-span-2">
              <FormLabel>Năm học</FormLabel>
              <FormControl>
                <AsyncCombobox<CatalogRef>
                  resource="school_years"
                  value={current?.id ?? null}
                  onChange={(id) => field.onChange(id == null ? null : { id })}
                  labelOf={(year) => year.name}
                  fallbackLabel={current?.name}
                  placeholder="Chọn năm học"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <DateField control={control} name="startDate" label="Ngày bắt đầu" rules={{ required: "Chọn ngày bắt đầu" }} />
      <DateField control={control} name="endDate" label="Ngày kết thúc" rules={{ required: "Chọn ngày kết thúc" }} />
    </>
  );
}

function SemesterRead({ record }: { record: CatalogRecord }) {
  const semester = record as Semester;
  return (
    <>
      <ReadField label="Năm học" className="sm:col-span-2">
        {semester.schoolYear?.name}
      </ReadField>
      <ReadField label="Ngày bắt đầu">{formatPlainDate(semester.startDate)}</ReadField>
      <ReadField label="Ngày kết thúc">{formatPlainDate(semester.endDate)}</ReadField>
    </>
  );
}

function SemesterFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <RefFilter table={table} field="schoolYear.id" resource="school_years" all="Mọi năm học" />;
}

export const semesterConfig: CatalogConfig = {
  resource: "semesters",
  noun: "học kỳ",
  description: "Học kỳ của một năm học; khoảng ngày phải nằm trong năm học đó.",
  codePlaceholder: "HK1-2026-2027",
  namePlaceholder: "Học kỳ I",
  extraKeys: ["schoolYear", "startDate", "endDate"],
  extraDefaults: { schoolYear: null, startDate: null, endDate: null },
  extraColumns: [
    {
      id: "schoolYear",
      header: "Năm học",
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (row.original as Semester).schoolYear?.name ?? "—",
    },
    {
      id: "startDate",
      header: "Bắt đầu",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as Semester).startDate),
    },
    {
      id: "endDate",
      header: "Kết thúc",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as Semester).endDate),
    },
  ],
  ExtraFields: SemesterFields,
  ExtraRead: SemesterRead,
  ExtraFilters: SemesterFilters,
};
