import { useCan, useList, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { GraduationCap } from "lucide-react";
import { useWatch, type Control } from "react-hook-form";

import { RefField } from "@/shared/components/catalog/ref-field";
import { DetailTable, type DetailColumn } from "@/shared/components/data-table/detail-table";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { DateField, SelectField } from "@/shared/components/form/simple-fields";
import { LoadingText } from "@/shared/components/spinner";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { formatPlainDate } from "@/shared/lib/format";
import { GENDER_LABELS, GENDER_OPTIONS, type Student } from "@/domains/student/types";
import { refCell } from "@/features/organization/resources/facility-extra";
import { SchoolField } from "@/features/organization/resources/school-field";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ô lọc theo lớp gửi lên máy chủ (`StudentService.ownedFilters`). */
const CLASS_FILTER_FIELD = "class.id";

const genderText = (g: string | null | undefined) => (g ? GENDER_LABELS[g as keyof typeof GENDER_LABELS] ?? g : "—");

/**
 * Ô của form học sinh: trường (chỉ hiện khi phải chọn), lớp — lớp của năm học đang làm việc (bản ghi đang sửa: năm
 * của lớp hiện tại), ngày sinh, giới tính. Năm học không có ô riêng: suy ra từ lớp.
 */
function StudentFields({ control, record }: { control: Control<any>; record?: any }) {
  const { id: workingYear } = useSchoolYear();
  const chosenSchool = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? chosenSchool;
  const yearId = record?.schoolYear?.id ?? workingYear;
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="contents">
        <RefField control={control} name="class" resource="school_classes" label="Lớp" required current={record?.class}
          hint="Lớp của năm học đang làm việc. Đổi lớp là chuyển lớp — sĩ số hai lớp tự đếm lại."
          filters={[
            ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
            ...(yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
          ]} />
        <DateField control={control} name="birthDate" label="Ngày sinh" dateRule="PAST_OR_TODAY" />
        <SelectField control={control} name="gender" label="Giới tính" options={GENDER_OPTIONS} placeholder="Chọn giới tính" />
      </div>
    </>
  );
}

/** Nút lọc theo lớp trên bảng học sinh — các lớp của năm học đang làm việc. */
function ClassTableFilter<T extends BaseRecord>({ table }: { table: UseTableReturnType<T, HttpError> }) {
  const { id: workingYear } = useSchoolYear();
  const { result } = useList<any>({
    resource: "school_classes",
    filters: workingYear != null ? [{ field: "schoolYear.id", operator: "eq", value: workingYear }] : [],
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { pageSize: 300 },
  });
  const { setColumnFilters, getState } = table.reactTable;
  const entries = getState().columnFilters as unknown as { id: string; value: unknown }[];
  const active = entries.find((e) => e.id === CLASS_FILTER_FIELD)?.value;
  return (
    <IconFilter
      icon={<GraduationCap />}
      label="lớp"
      allLabel="Mọi lớp"
      groups={[{ items: (result?.data ?? []).map((c: any) => ({ key: String(c.id), label: c.code ?? c.name })) }]}
      value={active != null && active !== "" ? String(active) : null}
      onChange={(v) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== CLASS_FILTER_FIELD);
          return (v == null ? others : [...others, { id: CLASS_FILTER_FIELD, operator: "eq", value: v }]) as ColumnFiltersState;
        })
      }
    />
  );
}

export const STUDENT_EXTRA = {
  section: { title: "Thông tin học sinh", inline: true },
  defaults: {
    school: { id: null },
    class: { id: null },
    birthDate: null,
    gender: null,
  },
  Fields: StudentFields,
  ListFilters: ClassTableFilter,
  // Danh sách là học sinh của năm học đang làm việc (header) — lọc theo năm học của lớp.
  yearField: "schoolYear.id",
  columns: [
    {
      id: "birthDate",
      header: "Ngày sinh",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{formatPlainDate(row.original.birthDate)}</span>,
    },
    {
      id: "gender",
      header: "Giới tính",
      enableSorting: false,
      cell: ({ row }) => genderText(row.original.gender),
    },
    refCell("class", "Lớp"),
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Lớp", value: r?.class?.name ?? "—" },
    { label: "Năm học", value: r?.schoolYear?.name ?? "—" },
    { label: "Ngày sinh", value: formatPlainDate(r?.birthDate) },
    { label: "Giới tính", value: genderText(r?.gender) },
  ],
};

const CLASS_STUDENT_COLUMNS: DetailColumn[] = [
  { key: "code", label: "Mã HS" },
  { key: "name", label: "Họ và tên" },
  { key: "birthDate", label: "Ngày sinh" },
  { key: "gender", label: "Giới tính" },
];

/** Số học sinh trong danh sách của lớp (kể cả học sinh ngừng); `null` khi chưa biết hoặc người xem không có quyền. */
export function useClassStudentTotal(classId: number | null | undefined): number | null {
  const mayRead = useCan({ resource: "students", action: "list" }).data?.can ?? false;
  const { result } = useList<any>({
    resource: "students",
    filters: [{ field: CLASS_FILTER_FIELD, operator: "eq", value: classId }],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: mayRead && classId != null },
  });
  return mayRead && classId != null && result?.total != null ? result.total : null;
}

/**
 * Danh sách học sinh của một lớp, dưới phần chi tiết của hộp xem lớp. Chỉ người có quyền xem học sinh (tài khoản của
 * trường) mới thấy — Sở, quản trị viên xem lớp chỉ thấy sĩ số.
 */
export function ClassStudents({ record }: { record: any }) {
  const mayRead = useCan({ resource: "students", action: "list" }).data?.can ?? false;
  const { result, query } = useList<Student>({
    resource: "students",
    filters: [{ field: CLASS_FILTER_FIELD, operator: "eq", value: record?.id }],
    pagination: { pageSize: 200 },
    queryOptions: { enabled: mayRead && record?.id != null },
  });
  if (!mayRead || record?.id == null) return null;
  const rows = result?.data ?? [];
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Học sinh của lớp</h3>
      {query.isLoading ? (
        <LoadingText className="py-4" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Lớp chưa có danh sách học sinh — sĩ số đang là số nhập tay. Thêm học sinh ở mục Học sinh hoặc qua Nhập dữ liệu đầu vào.
        </p>
      ) : (
        <DetailTable columns={CLASS_STUDENT_COLUMNS} rows={rows} compact searchPlaceholder="Tìm mã, họ tên…"
          text={(r, c) => c.key === "birthDate" ? formatPlainDate(r.birthDate)
            : c.key === "gender" ? genderText(r.gender)
              : String((r as any)[c.key] ?? "")} />
      )}
    </section>
  );
}
