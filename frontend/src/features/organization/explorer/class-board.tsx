import { useList } from "@refinedev/core";
import { CalendarRange, GraduationCap, ListPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MiniTable, type MiniColumn, type MiniView } from "@/features/organization/explorer/mini-table";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { QuickAddClasses, useGradeFilters } from "@/features/organization/resources/class-extra";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = new Intl.NumberFormat("vi-VN");
const students = (rows: any[]) => rows.reduce((n: number, r: any) => n + (r.studentCount ?? 0), 0);
const missing = <span className="text-muted-foreground">Chưa có</span>;

// Cột nào cũng khai bề rộng theo nội dung, chỉ cột cuối nhận phần dư — không thì trình duyệt chia đều phần dư và các
// cột cách nhau những khoảng trống lớn. Sĩ số đứng cạnh tên lớp, không nằm tận mép kia của bảng.
const COLUMNS: MiniColumn[] = [
  {
    header: "Lớp",
    className: "w-40",
    cell: (c) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{c.code}</span>
        {c.active === false ? <Badge variant="neutral">Ngừng</Badge> : null}
      </span>
    ),
  },
  { header: "Sĩ số", className: "w-24 text-right tabular-nums", cell: (c) => (c.studentCount != null ? num.format(c.studentCount) : "—") },
  { header: "GV chủ nhiệm", className: "w-80", cell: (c) => c.homeroomTeacher?.name ?? missing },
  { header: "Phòng học", cell: (c) => c.room?.name ?? missing },
];

/** Mỗi khối một nhóm thu gọn được, cùng kiểu với các bảng khác của màn Tổng quan. */
const VIEWS: MiniView[] = [
  {
    key: "grade",
    label: "Theo khối",
    groupBy: (c) => ({ key: String(c.grade?.id ?? "none"), label: c.grade?.name ?? "Chưa gán khối", icon: <GraduationCap /> }),
    summary: (rows) => `${num.format(students(rows))} HS`,
    footer: (rows) => `${num.format(rows.length)} lớp · ${num.format(students(rows))} HS`,
  },
];

/**
 * Lớp học của một trường: bảng gom theo khối. Lọc theo NĂM HỌC (mặc định năm hiện hành, vì mỗi năm một bộ lớp) và
 * theo khối — chỉ các khối của cấp học của trường.
 */
export function ClassBoard({
  schoolId,
  onCreate,
  onOpen,
  onEdit,
}: {
  schoolId: number;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const [yearId, setYearId] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const { result: yearsResult, query: yearsQuery } = useList<any>({
    resource: "school_years",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const years = useMemo(() => yearsResult?.data ?? [], [yearsResult]);
  const defaultYear = years.find((y: any) => y.current) ?? years[0];
  const defaultYearId = defaultYear ? String(defaultYear.id) : "";
  useEffect(() => {
    if (!yearId && defaultYearId) setYearId(defaultYearId);
  }, [defaultYearId, yearId]);

  const gradeFilters = useGradeFilters(schoolId);
  const filters = useMemo(
    () => [
      { field: "school.id", operator: "eq" as const, value: schoolId },
      ...(yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
    ],
    [schoolId, yearId],
  );

  // Chưa biết năm học thì chưa đọc lớp: đọc sớm là hiện lẫn lớp của mọi năm rồi mới co lại.
  if (!yearId && !(yearsQuery.isSuccess && years.length === 0)) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <QuickAddClasses schoolId={schoolId} open={quickOpen} onOpenChange={setQuickOpen} />
      <MiniTable
        resource="school_classes"
        path="/school-classes"
        filters={filters}
        columns={COLUMNS}
        views={VIEWS}
        unit="lớp"
        emptyText="Không có lớp nào."
        createLabel="Thêm lớp"
        onCreate={() => onCreate()}
        onOpen={(c) => onOpen(c.id)}
        onEdit={(c) => onEdit(c.id)}
        createMenu={[{ label: "Thêm nhanh nhiều lớp", icon: <ListPlus />, onSelect: () => setQuickOpen(true) }]}
        facet={{ field: "grade.id", resource: "grades", allLabel: "Tất cả khối", icon: <GraduationCap />, label: "khối", filters: gradeFilters }}
        // Năm hiện hành là mặc định, không tính là đang lọc: chấm ở góc nút chỉ hiện khi đang xem năm khác.
        lead={
          <IconFilter icon={<CalendarRange />} label="năm học" value={yearId || null} baseline={defaultYearId}
            onChange={(v) => v && setYearId(v)}
            groups={[{ items: years.map((y: any) => ({ key: String(y.id), label: y.code ?? y.name })) }]} />
        }
      />
    </>
  );
}
