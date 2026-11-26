import { GraduationCap } from "lucide-react";
import { useMemo } from "react";

import { MiniTable, type MiniColumn } from "@/features/organization/explorer/mini-table";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { formatPlainDate } from "@/shared/lib/format";
import { GENDER_VARIANTS } from "@/shared/lib/status-variants";
import { GENDER_LABELS, type StudentGender } from "@/domains/student/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Cột dàn theo tỉ lệ bề ngang bảng (không cố định rem): màn rộng thì các cột giãn đều, Ghi chú lấy phần còn lại.
const COLUMNS: MiniColumn[] = [
  {
    header: "Mã HS",
    className: "w-[16%]",
    cell: (s) => (
      <span className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{s.code}</span>
        {s.active === false ? <Badge variant="neutral">Nghỉ học</Badge> : null}
      </span>
    ),
  },
  { header: "Họ và tên", className: "w-[22%]", cell: (s) => s.name },
  { header: "Ngày sinh", className: "w-[12%] tabular-nums", cell: (s) => formatPlainDate(s.birthDate) },
  {
    header: "Giới tính",
    className: "w-[10%]",
    cell: (s) => (s.gender in GENDER_LABELS
      ? <Badge variant={GENDER_VARIANTS[s.gender as StudentGender]}>{GENDER_LABELS[s.gender as StudentGender]}</Badge>
      : <span className="text-muted-foreground">Chưa khai</span>),
  },
  { header: "Lớp", className: "w-[12%]", cell: (s) => s.class?.code ?? s.class?.name ?? <span className="text-muted-foreground">Chưa xếp lớp</span> },
  {
    header: "Ghi chú",
    className: "whitespace-normal",
    cell: (s) => (s.note ? <span className="text-muted-foreground line-clamp-2" title={s.note}>{s.note}</span> : null),
  },
];

/**
 * Gom theo lớp NHƯNG phân trang thật: máy chủ xếp học sinh theo lớp (thứ tự lớp, mã lớp) rồi số thứ tự, tên — mỗi trang
 * là một khúc liền, dòng tiêu đề lớp vẽ khi lớp đổi (lớp nối từ trang trước ghi "(tiếp)"). Trước đây đọc một lần tối đa
 * 500 em rồi chia nhóm: trường 2.000 em mất học sinh ở nhiều lớp và không có phân trang.
 */
const BY_CLASS = (s: any) => ({ key: String(s.class?.id ?? "none"), label: s.class?.name ?? "Chưa gán lớp", icon: <GraduationCap /> });
const SORTERS = [
  { field: "schoolClass.sortOrder", order: "asc" as const },
  { field: "schoolClass.code", order: "asc" as const },
  { field: "sortOrder", order: "asc" as const },
  { field: "name", order: "asc" as const },
  { field: "id", order: "asc" as const },
];

/**
 * Học sinh của một trường, năm học đang làm việc (ô năm học trên header): gom theo lớp, lọc theo lớp, tìm theo mã hoặc
 * họ tên. Thêm / xem / sửa trong hộp thoại; xoá có hỏi lại. Sĩ số lớp tự đếm sau mỗi lần thêm, chuyển lớp, xoá.
 */
export function StudentBoard({
  schoolId,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
}: {
  schoolId: number;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (row: { id: number; name?: string }) => void;
}) {
  const { id: workingYear, years, loading: yearsLoading } = useSchoolYear();
  const yearId = workingYear != null ? String(workingYear) : "";
  const filters = useMemo(
    () => [
      { field: "school.id", operator: "eq" as const, value: schoolId },
      ...(yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
    ],
    [schoolId, yearId],
  );
  // Chưa biết năm học thì chưa đọc: đọc sớm là hiện lẫn học sinh của mọi năm rồi mới co lại.
  if (!yearId && (yearsLoading || years.length > 0)) return <Skeleton className="h-64 w-full" />;
  return (
    <MiniTable
      resource="students"
      path="/students"
      filters={filters}
      columns={COLUMNS}
      groupBy={BY_CLASS}
      sorters={SORTERS}
      unit="học sinh"
      emptyText="Chưa có học sinh nào. Thêm từng em, hoặc nhập cả danh sách qua Nhập dữ liệu đầu vào (trang Học sinh)."
      createLabel="Thêm học sinh"
      searchPlaceholder="Tìm theo mã học sinh hoặc họ tên..."
      onCreate={() => onCreate()}
      onOpen={(s) => onOpen(s.id)}
      onEdit={(s) => onEdit(s.id)}
      onDelete={(s) => onDelete({ id: s.id, name: s.name })}
      facet={{
        field: "class.id",
        resource: "school_classes",
        allLabel: "Tất cả lớp",
        icon: <GraduationCap />,
        label: "lớp",
        filters,
      }}
    />
  );
}
