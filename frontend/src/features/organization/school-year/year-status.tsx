import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Gauge, Loader2, LockOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { PROFILE_STATUS_LABELS } from "@/domains/school-year/types";

import { useYearProfile } from "./profile";
import { yearLabel, useSchoolYear } from "@/shared/hooks/use-school-year";

/**
 * Hồ sơ năm học của MỘT trường trong năm đang làm việc (năm chọn trên header) — dải nhỏ đầu trang trường khi cơ quan
 * quản lý xem: trạng thái, số điểm trường đã xác nhận, ngày chốt; mở lại năm đã chốt (có lý do). Khởi tạo năm kế tiếp là
 * việc của trường (Hồ sơ năm học), Sở không làm thay. Thay cho màn "Tiến độ hồ sơ năm học" đã bỏ.
 */
export function SchoolYearStatus({ schoolId, schoolName }: { schoolId: number; schoolName?: string }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { id: yearId, year } = useSchoolYear();
  const { data: p, isLoading } = useYearProfile(schoolId, yearId);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (yearId == null) return null;
  const ready = p?.campuses.filter((c) => c.todos.length === 0).length ?? 0;

  const reopen = async () => {
    if (!reason.trim()) {
      setReasonError("Vui lòng nhập lý do mở lại");
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post("school_year_profiles/reopen", { json: { schoolId, schoolYearId: yearId, reason: reason.trim() } }).json();
      notify?.({ type: "success", message: `Đã mở lại năm học ${yearLabel(year)}${schoolName ? ` của ${schoolName}` : ""}` });
      setReopening(false);
      await qc.invalidateQueries({ queryKey: ["school_year_profiles"] });
    } catch (e) {
      setReasonError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card shadow-e1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 text-sm">
      <CalendarCheck className="text-muted-foreground size-4" />
      <span className="font-medium">Hồ sơ năm học {yearLabel(year)}</span>
      {isLoading ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : p ? (
        <>
          <Badge variant={PROFILE_STATUS_VARIANTS[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Badge>
          <span className="text-muted-foreground tabular-nums">{ready}/{p.campuses.length} điểm trường đủ dữ liệu</span>
          {p.closing?.status === "CLOSED" ? <span className="text-muted-foreground tabular-nums">· Chốt {p.closing.closedAt}</span> : null}
        </>
      ) : <span className="text-muted-foreground">Chưa có dữ liệu</span>}
      <span className="flex-1" />
      <Button asChild type="button" variant="ghost" size="sm">
        <Link to={`/equipment-minimum?school=${schoolId}`}>
          <Gauge />
          Chuẩn tối thiểu
        </Link>
      </Button>
      {p?.canReopen ? (
        <Button type="button" variant="outline" size="sm" onClick={() => { setReason(""); setReasonError(null); setReopening(true); }}>
          <LockOpen />
          Mở lại năm học
        </Button>
      ) : null}
      <AlertDialog open={reopening} onOpenChange={(o) => !o && setReopening(false)}>
        <ConfirmContent tone="warning" title={`Mở lại năm học ${yearLabel(year)}${schoolName ? ` của ${schoolName}` : ""}?`}
          description="Trường sửa được dữ liệu năm này và phải chốt lại; bản chốt cũ giữ làm lịch sử."
          cancelLabel="Không mở" confirmLabel="Mở lại" busy={busy} keepOpen onConfirm={() => void reopen()}>
          <div className="space-y-1.5">
            <Label htmlFor="reopen-reason">Lý do<span className="text-destructive"> *</span></Label>
            <Textarea id="reopen-reason" rows={2} value={reason} maxLength={1000} aria-invalid={!!reasonError || undefined}
              onChange={(e) => { setReason(e.target.value); setReasonError(null); }} placeholder="Vd. trường khai thiếu sĩ số lớp 9" />
            {reasonError ? <p className="text-destructive-text text-xs">{reasonError}</p> : null}
          </div>
        </ConfirmContent>
      </AlertDialog>
    </div>
  );
}

