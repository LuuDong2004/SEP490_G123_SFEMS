import { useInvalidate, useList, useNotification } from "@refinedev/core";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { StaffPicker, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { RoomPickerField } from "../resources/room-picker";

/** Nhãn "Hành động →" trong hàng cảnh báo — bấm mở hộp thoại khai nhanh thay vì nhảy sang màn khác. */
function GapAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-primary text-xs font-medium hover:underline">
      {label} →
    </button>
  );
}

type SubjectGap = { subjectId: number; subjectName: string };

/** Bản ghi cán bộ tối thiểu để tính patch gán môn — `subjects` là danh sách ĐẦY ĐỦ (PATCH thay thế). */
type StaffRecord = Omit<StaffRow, "mainSubject"> & {
  mainSubject?: { id: number; name: string } | null;
  subjects?: { id: number }[] | null;
};

/**
 * Quyết định patch gán một môn cho một giáo viên:
 * - chưa có môn chính → đặt làm `mainSubject`;
 * - đã có môn chính → ghi thêm vào `subjects` (môn cũng dạy), phải gửi lại toàn bộ vì PATCH thay thế;
 * - đã mang môn này rồi → không gửi gì.
 */
function subjectPatch(staff: StaffRecord | undefined, subjectId: number) {
  if (staff?.mainSubject?.id === subjectId) return null;
  if (staff?.mainSubject?.id == null) return { mainSubject: { id: subjectId } };
  const subjects = (staff.subjects ?? []).map((s) => ({ id: s.id }));
  if (subjects.some((s) => s.id === subjectId)) return null;
  return { subjects: [...subjects, { id: subjectId }] };
}

/**
 * "Khai môn dạy →": mỗi môn đang thiếu giáo viên một ô chọn người, lưu một lần cho tất cả.
 * Người chọn phải là giáo viên của trường đang xem — máy chủ cũng chặn nếu sai phạm vi.
 */
export function QuickAssignTeachers({ schoolId, missing }: { schoolId: number; missing: SubjectGap[] }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<number, StaffRow | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();

  const { result, query } = useList<StaffRecord>({
    resource: "staff",
    filters: [
      { field: "school.id", operator: "eq", value: schoolId },
      { field: "staffType", operator: "eq", value: "teacher" },
      { field: "active", operator: "eq", value: true },
    ],
    pagination: { pageSize: 500 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const teachers = result?.data ?? [];

  const filled = missing.filter((s) => picks[s.subjectId]?.id);
  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      let assigned = 0;
      for (const s of missing) {
        const staff = picks[s.subjectId];
        if (!staff?.id) continue;
        const patch = subjectPatch(teachers.find((t) => t.id === staff.id), s.subjectId);
        if (!patch) continue;
        await kyInstance.patch(`staff/${staff.id}`, { json: patch }).json();
        assigned++;
      }
      notify?.({ type: "success", message: `Đã khai giáo viên cho ${assigned} môn` });
      // Số liệu chuẩn tính lại — bảng cán bộ và danh sách môn của người đó cũng đổi.
      invalidate({ resource: "purchase_proposals", invalidates: ["list", "detail"] });
      invalidate({ resource: "staff", invalidates: ["list"] });
      setOpen(false);
      setPicks({});
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GapAction label="Khai môn dạy" onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Khai môn dạy cho giáo viên</DialogTitle>
            <DialogDescription>
              Các môn bên dưới có thiết bị tính theo giáo viên mà trường chưa khai ai dạy. Chọn giáo
              viên cho từng môn rồi lưu — chưa có ai dạy thì thêm cán bộ ở màn Cán bộ trước.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {missing.map((s) => (
              <div key={s.subjectId} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]">
                <span className="truncate text-sm font-medium">{s.subjectName}</span>
                <StaffPicker
                  rows={teachers}
                  value={picks[s.subjectId] ?? null}
                  onChange={(row) => setPicks((p) => ({ ...p, [s.subjectId]: row }))}
                  loading={open && query.isLoading}
                  label="giáo viên"
                  prefer="teacher"
                />
              </div>
            ))}
            {open && !query.isLoading && teachers.length === 0 ? (
              <p className="text-warning-text text-sm">
                Trường chưa có giáo viên nào trong danh sách cán bộ.{" "}
                <Link to="/staff" className="font-medium underline">Thêm cán bộ</Link> rồi quay lại khai môn.
              </p>
            ) : null}
          </div>

          {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Để sau
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy || filled.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Lưu{filled.length ? ` (${filled.length} môn)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Ô chọn phòng không form — RoomPickerField cần react-hook-form nên bọc một form rỗng. */
function RoomPick({ schoolId, value, onChange }: {
  schoolId: number;
  value: { id: number; name?: string } | null;
  onChange: (room: { id: number; name?: string } | null) => void;
}) {
  const { control, setValue } = useForm<FieldValues>({ defaultValues: { room: value } });
  return (
    <RoomPickerField
      control={control}
      name="room"
      label="Phòng bộ môn"
      hideLabel
      schoolId={schoolId}
      onPicked={(r) => {
        const v = r ? { id: r.id, name: r.name } : null;
        setValue("room", v);
        onChange(v);
      }}
    />
  );
}

/**
 * "Gắn môn cho phòng →": mỗi môn cần phòng bộ môn một ô chọn phòng của trường, lưu một lần.
 * Một phòng chỉ phục vụ một môn (rooms.subject), nên mỗi môn chọn một phòng khác nhau.
 */
export function QuickAssignRooms({ schoolId, missing }: { schoolId: number; missing: SubjectGap[] }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<number, { id: number; name?: string } | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();

  const filled = missing.filter((s) => picks[s.subjectId]?.id);
  // Hai môn không được trỏ vào cùng một phòng — định mức đếm số phòng CỦA TỪNG môn.
  const roomIds = filled.map((s) => picks[s.subjectId]!.id);
  const duplicated = new Set(roomIds).size !== roomIds.length;

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      let assigned = 0;
      for (const s of missing) {
        const room = picks[s.subjectId];
        if (!room?.id) continue;
        await kyInstance.patch(`rooms/${room.id}`, { json: { subject: { id: s.subjectId } } }).json();
        assigned++;
      }
      notify?.({ type: "success", message: `Đã gắn phòng cho ${assigned} môn` });
      invalidate({ resource: "purchase_proposals", invalidates: ["list", "detail"] });
      invalidate({ resource: "rooms", invalidates: ["list"] });
      setOpen(false);
      setPicks({});
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GapAction label="Gắn môn cho phòng" onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Gắn phòng bộ môn</DialogTitle>
            <DialogDescription>
              Các môn bên dưới có thiết bị tính theo phòng bộ môn mà trường chưa gắn môn cho phòng
              nào. Chọn một phòng cho từng môn — một phòng chỉ phục vụ một môn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {missing.map((s) => (
              <div key={s.subjectId} className="grid items-start gap-2 sm:grid-cols-[10rem_1fr]">
                <span className="truncate pt-2 text-sm font-medium">{s.subjectName}</span>
                <RoomPick
                  schoolId={schoolId}
                  value={picks[s.subjectId] ?? null}
                  onChange={(room) => setPicks((p) => ({ ...p, [s.subjectId]: room }))}
                />
              </div>
            ))}
            {duplicated ? (
              <p className="text-warning-text text-sm">Hai môn không dùng chung một phòng — chọn phòng khác nhau.</p>
            ) : null}
          </div>

          {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Để sau
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy || filled.length === 0 || duplicated}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Lưu{filled.length ? ` (${filled.length} môn)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Cột hành động của một nhóm cảnh báo — gom dialog + nhãn cho gọn {@link SourceGaps}. */
export function GapActions({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-3">{children}</span>;
}
