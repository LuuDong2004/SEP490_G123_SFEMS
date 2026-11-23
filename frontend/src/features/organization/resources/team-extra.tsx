import type { CrudFilter } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { MultiRefPickerField } from "@/shared/components/catalog/multi-ref-picker";
import { SameSchoolRef } from "@/features/organization/resources/facility-extra";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TEACHERS: CrudFilter[] = [{ field: "staffType", operator: "eq", value: "teacher" }];

/**
 * Form tổ bộ môn: tổ trưởng, các môn tổ phụ trách, và giáo viên thuộc tổ — chọn bằng ô tích từ danh
 * sách giáo viên của CHÍNH trường đó. Một giáo viên một tổ: tích một người đang ở tổ khác là chuyển
 * người đó về tổ này (máy chủ gỡ khỏi tổ cũ).
 */
function TeamFields({ control, record }: { control: Control<any>; record?: any }) {
  const chosen = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? chosen;
  // Mã do máy chủ cấp theo quy tắc mã của trường (mặc định TO01, TO02…).
  useSchoolNextCode("subject_teams", control, record);
  const ofSchool: CrudFilter[] = [
    ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
    ...TEACHERS,
  ];

  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="sm:max-w-md">
        <SameSchoolRef control={control} record={record} name="leader" resource="staff" label="Tổ trưởng" hint="Chọn một giáo viên của trường. Tổ trưởng luôn là thành viên của tổ." current={record?.leader} extraFilters={TEACHERS} />
      </div>
      <MultiRefPickerField control={control} name="subjects" resource="subjects" label="Môn tổ phụ trách" unitLabel="môn" />
      {schoolId ? (
        <MultiRefPickerField control={control} name="members" resource="staff" label="Giáo viên thuộc tổ" hint="Mỗi giáo viên chỉ ở một tổ. Chọn người đang ở tổ khác thì người đó chuyển về tổ này." unitLabel="giáo viên" filters={ofSchool} />
      ) : null}
    </>
  );
}

const names = (list: any[] | undefined) => (list ?? []).map((x) => x.name).join(", ");

/** Mỗi mục một thẻ nhỏ; `leadId` đánh dấu tổ trưởng trong danh sách giáo viên. */
const chips = (list: any[] | undefined, leadId?: number) =>
  list?.length ? (
    // Không đệm dọc riêng: một hàng thẻ phải cao đúng bằng ô chữ bên cạnh (`min-h-9` của `ReadField`),
    // nếu không ô "Môn phụ trách" cao hơn ô "Tổ trưởng" cùng hàng.
    <div className="flex flex-wrap gap-1.5">
      {list.map((x) => (
        <Badge key={x.id} variant={x.id === leadId ? "info" : "neutral"}>
          {x.name}
          {x.id === leadId ? " · Tổ trưởng" : ""}
        </Badge>
      ))}
    </div>
  ) : (
    "—"
  );

export const SUBJECT_TEAM_EXTRA = {
  section: { title: "Thành phần của tổ" },
  defaults: {
    school: { id: null },
    leader: { id: null },
    subjects: [],
    members: [],
  },
  Fields: TeamFields,
  columns: [
    {
      id: "leader",
      header: "Tổ trưởng",
      enableSorting: false,
      cell: ({ row }) => row.original.leader?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "subjects",
      header: "Môn phụ trách",
      enableSorting: false,
      cell: ({ row }) => names(row.original.subjects) || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "memberCount",
      header: "Giáo viên",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.memberCount ?? 0}</span>,
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Tổ trưởng", value: r?.leader?.name ?? "—" },
    { label: "Môn phụ trách", value: chips(r?.subjects) },
    // Danh sách giáo viên trải hết bề ngang: mỗi người một thẻ nhỏ, không dồn thành một đoạn chữ.
    { label: `Giáo viên (${r?.memberCount ?? 0})`, value: chips(r?.members, r?.leader?.id), span: 4 as const },
  ],
};
