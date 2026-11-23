import { useCan, useNotification } from "@refinedev/core";
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
import { PROFILE_STATUS_LABELS, type ProgressRow } from "@/domains/school-year/types";

import { InitYearDialog } from "./init-year";
import { useYearProfile } from "./profile";
import { yearLabel, useSchoolYear } from "@/shared/hooks/use-school-year";

/**
 * Hồ sơ năm học của MỘT trường trong năm đang làm việc (năm chọn trên header) — dải nhỏ đầu trang trường khi cơ quan
 * quản lý xem: trạng thái, số điểm trường đã xác nhận, ngày chốt; mở lại năm đã chốt (có lý do), khởi tạo năm kế tiếp.
 * Thay cho màn "Tiến độ hồ sơ năm học" đã bỏ.
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
  const [initOpen, setInitOpen] = useState(false);

  if (yearId == null) return null;
  const confirmed = p?.campuses.filter((c) => c.status === "CONFIRMED").length ?? 0;

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
          <span className="text-muted-foreground tabular-nums">{confirmed}/{p.campuses.length} điểm trường đã xác nhận</span>
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
      {p?.canWrite && p.nextYear ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setInitOpen(true)}>
          <CalendarCheck />
          Khởi tạo {p.nextYear.name.replace("Năm học ", "năm học ")}
        </Button>
      ) : null}
      {initOpen && p?.nextYear ? (
        <InitYearDialog fromYear={p.schoolYearName} target={p.nextYear} schoolIds={[schoolId]}
          onClose={() => setInitOpen(false)} onDone={() => setInitOpen(false)} />
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

/**
 * Nút "Khởi tạo năm học …" của cơ quan quản lý ở mục Trường học: khởi tạo năm đang làm việc (header) cho mọi trường
 * trong phạm vi (lên lớp, chép phân công, điều chỉnh từ năm liền trước). Trường đã khởi tạo thì máy chủ bỏ qua.
 */
export function InitYearForSchoolsButton() {
  const { open: notify } = useNotification();
  const { year } = useSchoolYear();
  const canInit = useCan({ resource: "school_year_profiles", action: "create" }).data?.can ?? false;
  const [schoolIds, setSchoolIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  if (!canInit || !year) return null;

  const open = async () => {
    setLoading(true);
    try {
      const rows = await kyInstance.get("school_year_profiles/progress", { searchParams: { yearId: String(year.id) } }).json<ProgressRow[]>();
      if (!rows.length) {
        notify?.({ type: "error", message: "Chưa có trường nào để khởi tạo năm học" });
        return;
      }
      setSchoolIds(rows.map((r) => r.schoolId));
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void open()}>
        {loading ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
        Khởi tạo năm học {yearLabel(year)}
      </Button>
      {schoolIds ? (
        <InitYearDialog target={{ id: year.id, name: year.name }} schoolIds={schoolIds}
          onClose={() => setSchoolIds(null)} onDone={() => setSchoolIds(null)} />
      ) : null}
    </>
  );
}
