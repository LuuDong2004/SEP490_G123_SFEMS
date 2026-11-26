import { GraduationCap } from "lucide-react";
import { useMemo } from "react";

import { MiniTable, type MiniColumn, type MiniView } from "@/features/organization/explorer/mini-table";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { formatPlainDate } from "@/shared/lib/format";
import { GENDER_LABELS } from "@/domains/student/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });

const COLUMNS: MiniColumn[] = [
  {
    header: "Mã HS",
    className: "w-44",
    cell: (s) => (
      <span className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{s.code}</span>
        {s.active === false ? <Badge variant="neutral">Ngừng</Badge> : null}
      </span>
    ),
  },
  { header: "Họ và tên", className: "w-64", cell: (s) => s.name },
  { header: "Ngày sinh", className: "w-28 tabular-nums", cell: (s) => formatPlainDate(s.birthDate) },
  { header: "Giới tính", className: "w-24", cell: (s) => (s.gender ? GENDER_LABELS[s.gender as keyof typeof GENDER_LABELS] ?? s.gender : "—") },
  { header: "Lớp", cell: (s) => s.class?.code ?? s.class?.name ?? "—" },
];

/** Gom theo lớp — dòng nhóm có số học sinh đang học (học sinh ngừng không tính vào sĩ số). */
const VIEWS: MiniView[] = [
  {
    key: "class",
    label: "Theo lớp",
    groupBy: (s) => ({ key: String(s.class?.id ?? "none"), label: s.class?.name ?? "Chưa gán lớp", icon: <GraduationCap /> }),
    summary: (rows) => `${num.format(rows.filter((r: any) => r.active !== false).length)} HS`,
    footer: (rows) => `${num.format(rows.filter((r: any) => r.active !== false).length)} học sinh đang học`,
  },
  { key: "list", label: "Danh sách", hint: "Bảng phẳng, phân trang" },
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
      views={VIEWS}
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
