import { CalendarCheck, CircleAlert, Gauge, Loader2 } from "lucide-react";
import { Link } from "react-router";

import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { PROFILE_STATUS_LABELS } from "@/domains/school-year/types";

import { useYearProfile } from "./profile";
import { yearLabel, useSchoolYear } from "@/shared/hooks/use-school-year";

/**
 * Hồ sơ năm học của MỘT trường trong năm đang làm việc (năm chọn trên header) — dải nhỏ đầu trang trường khi cơ quan
 * quản lý xem: Đang khai / Đã xác nhận (ngày, người, lần sửa cuối), số điểm trường đủ dữ liệu và trường còn thiếu gì để
 * Sở biết nhắc việc gì. Khai và xác nhận là việc của trường; Sở chỉ xem, được báo khi trường xác nhận.
 */
export function SchoolYearStatus({ schoolId }: { schoolId: number; schoolName?: string }) {
  const { id: yearId, year } = useSchoolYear();
  const { data: p, isLoading } = useYearProfile(schoolId, yearId);

  if (yearId == null) return null;
  const ready = p?.campuses.filter((c) => c.todos.length === 0).length ?? 0;
  // Việc còn thiếu của từng điểm trường, để cơ quan quản lý nhìn là biết nhắc trường việc gì.
  const missing = p ? p.campuses.filter((c) => c.todos.length > 0) : [];

  return (
    <div className="bg-card shadow-e1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 text-sm">
      <CalendarCheck className="text-muted-foreground size-4" />
      <span className="font-medium">Hồ sơ năm học {yearLabel(year)}</span>
      {isLoading ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : p ? (
        <>
          <Badge variant={PROFILE_STATUS_VARIANTS[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Badge>
          {p.status === "CONFIRMED" ? (
            <span className="text-muted-foreground tabular-nums">
              {p.confirmedAt}{p.confirmedBy ? ` · ${p.confirmedBy}` : ""}{p.editedAt ? ` · sửa lần cuối ${p.editedAt}` : ""}
            </span>
          ) : null}
          <span className="text-muted-foreground tabular-nums">{ready}/{p.campuses.length} điểm trường đủ dữ liệu</span>
        </>
      ) : <span className="text-muted-foreground">Chưa có dữ liệu</span>}
      <span className="flex-1" />
      <Button asChild type="button" variant="ghost" size="sm">
        <Link to={`/equipment-minimum?school=${schoolId}`}>
          <Gauge />
          Chuẩn tối thiểu
        </Link>
      </Button>
      {missing.length > 0 ? (
        <ul className="text-muted-foreground basis-full space-y-0.5 border-t pt-2 text-xs">
          {missing.map((c) => (
            <li key={c.campusId ?? c.campusName} className="flex flex-wrap items-center gap-x-1.5">
              <CircleAlert className="text-warning-text size-3.5 shrink-0" />
              <span className="text-foreground font-medium">{p!.campuses.length > 1 ? `${c.campusName}:` : "Còn thiếu:"}</span>
              {c.todos.map((t) => t.text).join(" · ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
