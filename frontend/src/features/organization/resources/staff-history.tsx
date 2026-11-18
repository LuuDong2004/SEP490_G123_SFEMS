import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History, UserPlus } from "lucide-react";

import { kyInstance } from "@/shared/api/data";
import { LoadingText } from "@/shared/components/spinner";
import { formatDateTime } from "@/shared/lib/format";
import { POSITION_LABELS, STAFF_TYPE_LABELS } from "@/domains/staff/types";

type Change = {
  id: number;
  createdAt: string;
  actorName: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

/** Tên ô trên màn hình của các trường máy chủ ghi lại. Trường lạ thì hiện nguyên tên. */
const FIELD_LABELS: Record<string, string> = {
  code: "Mã",
  name: "Họ tên",
  staffType: "Loại",
  position: "Chức vụ",
  department: "Phòng ban / bộ phận",
  phone: "Số điện thoại",
  email: "Email",
  mainSubject: "Môn chính",
  active: "Trạng thái",
  note: "Ghi chú",
  account: "Tài khoản",
  sortOrder: "Thứ tự",
};

/** Giá trị đọc được: enum lưu tên hằng (TEACHER, HIEU_TRUONG) → nhãn tiếng Việt. */
function show(field: string, value: string | null) {
  if (value == null || value === "") return null;
  if (field === "staffType") return STAFF_TYPE_LABELS[value.toLowerCase()] ?? value;
  if (field === "position") return POSITION_LABELS[value] ?? value;
  if (field === "active") return value === "true" ? "Đang làm việc" : value === "false" ? "Ngừng" : value;
  return value;
}

/**
 * Lịch sử sửa hồ sơ cán bộ (trưởng nhóm 13/11/2026): mỗi lần lưu là một mốc — ai, lúc nào, ô nào đổi từ gì sang gì,
 * mới nhất trên cùng; mốc cuối là lúc tạo hồ sơ. Cán bộ thiết bị được toàn quyền sửa, không qua duyệt, nên đây là chỗ
 * truy lại khi có sai sót. Đọc `GET /staff/{id}/history` (cùng quyền xem hồ sơ).
 */
export function StaffHistory({ recordId, createdAt }: { recordId: number; createdAt?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["staff-history", recordId],
    queryFn: () => kyInstance.get(`staff/${recordId}/history`).json<Change[]>(),
  });
  if (isLoading) return <LoadingText className="py-2" />;
  // Một lần Lưu = các dòng cùng thời điểm, cùng người.
  const saves: { key: string; at: string; actor: string; rows: Change[] }[] = [];
  for (const c of Array.isArray(data) ? data : []) {
    const key = `${c.createdAt}|${c.actorName ?? ""}`;
    const last = saves[saves.length - 1];
    if (last?.key === key) last.rows.push(c);
    else saves.push({ key, at: c.createdAt, actor: c.actorName ?? "Hệ thống", rows: [c] });
  }
  return (
    <ol className="relative space-y-4 ps-6 before:absolute before:top-1 before:bottom-1 before:left-[0.4375rem] before:w-px before:bg-border">
      {saves.map((s) => (
        <li key={s.key} className="relative">
          <span aria-hidden className="bg-primary ring-background absolute top-1.5 -left-6 size-3.5 rounded-full ring-4" />
          <div className="text-sm">
            <span className="font-medium">{s.actor}</span>
            <span className="text-muted-foreground"> · {formatDateTime(s.at)}</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {s.rows.map((r) => {
              const before = show(r.field, r.oldValue);
              const after = show(r.field, r.newValue);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-1.5 text-sm">
                  <span className="text-muted-foreground">{FIELD_LABELS[r.field] ?? r.field}:</span>
                  <span className={before ? "line-through decoration-muted-foreground/60" : "text-muted-foreground/80 italic"}>
                    {before ?? "trống"}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3.5" />
                  <span className={after ? "font-medium" : "text-muted-foreground/80 italic"}>{after ?? "trống"}</span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
      <li className="relative">
        <span aria-hidden className="bg-muted-foreground/50 ring-background absolute top-1.5 -left-6 size-3.5 rounded-full ring-4" />
        <div className="flex items-center gap-1.5 text-sm">
          <UserPlus className="text-muted-foreground size-4" />
          <span className="font-medium">Tạo hồ sơ</span>
          {createdAt ? <span className="text-muted-foreground">· {formatDateTime(createdAt)}</span> : null}
        </div>
        {saves.length === 0 ? (
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <History className="size-3.5" />Chưa có lần sửa nào.
          </p>
        ) : null}
      </li>
    </ol>
  );
}
