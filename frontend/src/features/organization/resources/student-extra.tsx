import { useCan, useList, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { CalendarDays, GraduationCap, Hash, NotebookPen, School as SchoolIcon, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { CatalogCodeField, CatalogNameField, CatalogNoteField } from "@/shared/components/catalog/fields";
import { SwitchRow } from "@/shared/components/form/switch-row";
import { FormField, FormItem } from "@/shared/ui/form";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { NavSectionBox, NeedBox, SectionFormNav } from "@/features/organization/resources/section-nav";
import { initialsOf } from "@/features/organization/resources/staff-avatar";

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
        <DateField control={control} name="birthDate" label="Ngày sinh" dateRule="PAST_OR_TODAY" rules={BIRTH_DATE_RULES} />
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

/** Ô bắt buộc còn trống của form học sinh — theo phần, cho cột mục và chân hộp. */
function useStudentMissing(control: Control<any>) {
  const [code, name, schoolClass] = useWatch({ control, name: ["code", "name", "class"] });
  const blank = (v: unknown) => v == null || (typeof v === "object" ? (v as { id?: unknown }).id == null : String(v).trim() === "");
  return {
    info: [blank(code) && "Mã HS", blank(name) && "Họ và tên"].filter(Boolean) as string[],
    study: [blank(schoolClass) && "Lớp"].filter(Boolean) as string[],
    other: [] as string[],
  };
}

const STUDENT_SECTIONS = [
  { key: "info", title: "Thông tin chung", icon: UserRound },
  { key: "study", title: "Học tập", icon: GraduationCap },
  { key: "other", title: "Ghi chú", icon: NotebookPen },
] as const;

/**
 * Hộp Thêm / Sửa học sinh — cùng khuôn hộp cán bộ (D1): đầu hộp chữ viết tắt tên, cột mục bên trái Thông tin chung ·
 * Học tập · Ghi chú. Ngoài hộp thoại các phần xếp dọc. Không có ảnh: ảnh của trẻ vị thành niên không lưu trên hệ thống.
 */
function StudentFormBody({ control, record, config, inDialog }: { control: any; record?: any; config: CatalogConfig; inDialog?: boolean }) {
  const { id: workingYear } = useSchoolYear();
  const chosenSchool = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? chosenSchool;
  const yearId = record?.schoolYear?.id ?? workingYear;
  const missing = useStudentMissing(control);
  const need = (part: keyof typeof missing, label: string) => !!inDialog && missing[part].includes(label);
  const body = (
    <>
      <NavSectionBox k="info" title="Thông tin chung">
        <div className="empty:hidden sm:col-span-2">
          <SchoolField control={control} record={record} hideWhenFixed />
        </div>
        <NeedBox on={need("info", "Mã HS")}><CatalogCodeField control={control} config={config} fill /></NeedBox>
        <NeedBox on={need("info", "Họ và tên")}><CatalogNameField control={control} config={config} /></NeedBox>
        <DateField control={control} name="birthDate" label="Ngày sinh" dateRule="PAST_OR_TODAY" rules={BIRTH_DATE_RULES} />
        <SelectField control={control} name="gender" label="Giới tính" options={GENDER_OPTIONS} placeholder="Chọn giới tính" />
      </NavSectionBox>
      <NavSectionBox k="study" title="Học tập">
        <NeedBox on={need("study", "Lớp")}>
          <RefField control={control} name="class" resource="school_classes" label="Lớp" required current={record?.class}
            hint="Lớp của năm học đang làm việc. Đổi lớp là chuyển lớp — sĩ số hai lớp tự đếm lại."
            filters={[
              ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
              ...(yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
            ]} />
        </NeedBox>
        {/* Cột `active` của học sinh: tắt = nghỉ học / chuyển trường — giữ hồ sơ, không tính vào sĩ số lớp. */}
        {record?.id ? (
          <FormField control={control} name="active" render={({ field }) => (
            <FormItem>
              <SwitchRow checked={field.value ?? true} onCheckedChange={field.onChange} title="Đang học"
                description="Tắt khi học sinh nghỉ học hoặc chuyển trường: hồ sơ vẫn giữ, nhưng không tính vào sĩ số lớp." />
            </FormItem>
          )} />
        ) : null}
      </NavSectionBox>
      <NavSectionBox k="other" title="Ghi chú">
        <div className="min-w-0 sm:col-span-2"><CatalogNoteField control={control} /></div>
      </NavSectionBox>
    </>
  );
  const sections = STUDENT_SECTIONS.map((x) => ({ ...x, missing: missing[x.key] }));
  return inDialog ? <SectionFormNav control={control} sections={sections}>{body}</SectionFormNav> : <div className="space-y-3">{body}</div>;
}

/** Đầu hộp học sinh: chữ viết tắt tên trong vòng tròn + họ tên + giới tính + mã · lớp · ngày sinh. */
function StudentFormHeading({ record, creating, viewing }: { record?: any; creating: boolean; viewing?: boolean }) {
  const initials = creating ? "" : initialsOf(record?.name);
  const facts = creating || !record ? [] : [
    { icon: Hash, text: record.code },
    { icon: SchoolIcon, text: record.class?.name ? `Lớp ${String(record.class.name).replace(/^Lớp\s+/i, "")}` : null },
    { icon: CalendarDays, text: record.birthDate ? formatPlainDate(record.birthDate) : null },
  ].filter((f) => f.text);
  return (
    <div className="flex min-w-0 items-center gap-5 py-1 text-start">
      <span className="bg-info-subtle text-info-text ring-background shadow-e2 flex size-24 shrink-0 items-center justify-center rounded-full text-3xl font-semibold ring-4">
        {initials || <UserRound className="size-11" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-2xl leading-tight font-semibold tracking-tight">
            {creating ? "Thêm học sinh" : record?.name ?? "…"}
          </span>
          {!creating && record?.gender ? <Badge variant="info">{genderText(record.gender)}</Badge> : null}
          {!creating && record?.active === false ? <Badge variant="neutral">Đã nghỉ học</Badge> : null}
          {!creating && !viewing ? <Badge variant="warning">Đang sửa</Badge> : null}
        </div>
        {creating ? (
          <div className="text-muted-foreground text-sm font-normal">Nhập mã học sinh, họ tên và chọn lớp</div>
        ) : (
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm font-normal">
            {facts.map((f, i) => (
              <span key={i} className="inline-flex min-w-0 items-center gap-1.5">
                <f.icon className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{f.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Một ô chỉ đọc: nhãn + giá trị; trống thì chữ mờ nghiêng (ô bắt buộc trống: "Chưa khai" màu cam). */
function ViewCell({ label, value, required, blank = "Chưa có", wide }: {
  label: string; value?: ReactNode; required?: boolean; blank?: string; wide?: boolean;
}) {
  const empty = value == null || value === "";
  return (
    <div className={cn("min-w-0 space-y-1", wide && "sm:col-span-2")}>
      <div className="text-muted-foreground text-xs font-medium">{label}:</div>
      <div className={cn("min-h-6 text-sm break-words", empty && (required ? "text-warning-text" : "text-muted-foreground/80 italic"))}>
        {empty ? (required ? "Chưa khai" : blank) : value}
      </div>
    </div>
  );
}

/** Hộp XEM học sinh — cùng bố cục hộp Sửa: bấm Sửa thì hộp không đổi cỡ, không đổi bố cục. */
function StudentView({ record }: { record: any }) {
  return (
    <SectionFormNav sections={[...STUDENT_SECTIONS]}>
      <NavSectionBox k="info" title="Thông tin chung">
        <ViewCell label="Mã học sinh" value={record?.code ? <span className="font-mono">{record.code}</span> : null} required />
        <ViewCell label="Họ và tên" value={record?.name} required />
        <ViewCell label="Ngày sinh" value={record?.birthDate ? formatPlainDate(record.birthDate) : null} blank="Chưa ghi ngày sinh" />
        <ViewCell label="Giới tính" value={record?.gender ? genderText(record.gender) : null} blank="Chưa ghi giới tính" />
      </NavSectionBox>
      <NavSectionBox k="study" title="Học tập">
        <ViewCell label="Lớp" value={record?.class?.name} required />
        <ViewCell label="Khối" value={record?.grade?.name} />
        <ViewCell label="Năm học" value={record?.schoolYear?.name} />
        <ViewCell label="Trạng thái" value={record?.active === false ? "Đã nghỉ học" : "Đang học"} />
      </NavSectionBox>
      <NavSectionBox k="other" title="Ghi chú">
        <ViewCell label="Ghi chú" value={record?.note} blank="Không có ghi chú" wide />
      </NavSectionBox>
    </SectionFormNav>
  );
}

function StudentShowHeading({ record }: { record?: any }) {
  return <StudentFormHeading record={record} creating={false} viewing />;
}

/** Chân hộp: còn bao nhiêu ô bắt buộc chưa điền (cùng đếm với cột mục). */
function StudentFormFooterNote({ control }: { control: any }) {
  const m = useStudentMissing(control);
  const n = m.info.length + m.study.length;
  return n ? <span className="text-warning-text text-sm">Còn {n} ô bắt buộc chưa điền</span> : null;
}

/** Cùng luật máy chủ (`StudentService.birthDateViolation`): học sinh từ 3 đến 25 tuổi tính tới hôm nay. */
const BIRTH_DATE_RULES = { validate: { plausibleAge: (v: unknown) => {
  if (!v) return true;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  const now = new Date();
  const age = now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
  return (age >= 3 && age <= 25) || "Ngày sinh không hợp lý — học sinh phải từ 3 đến 25 tuổi";
} } };

export const STUDENT_EXTRA = {
  FormBody: StudentFormBody,
  FormHeading: StudentFormHeading,
  ShowHeading: StudentShowHeading,
  ShowBody: StudentView,
  FormFooterNote: StudentFormFooterNote,
  dialogSize: "formFit" as const,
  section: { title: "Thông tin học sinh", inline: true },
  defaults: {
    school: { id: null },
    class: { id: null },
    birthDate: null,
    gender: null,
    note: "",
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
      cell: ({ row }) => (row.original.gender ? genderText(row.original.gender) : <span className="text-muted-foreground">Chưa khai</span>),
    },
    refCell("class", "Lớp", "Chưa xếp lớp"),
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
            : c.key === "gender" ? (r.gender ? genderText(r.gender) : "Chưa khai")
              : String((r as any)[c.key] ?? "")} />
      )}
    </section>
  );
}
