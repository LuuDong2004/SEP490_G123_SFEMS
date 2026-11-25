import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus, Check, CircleAlert, CircleCheck, FileCheck2, MapPinned } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { currentPortal } from "@/shared/api/portal";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { EmptyState, TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { QueryError } from "@/shared/components/query-error";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PROFILE_STATUS_LABELS, type CampusProfile, type ProfileTodo, type YearProfile } from "@/domains/school-year/types";

import { InitYearDialog } from "./init-year";
import { yearLabel, useSchoolYear } from "@/shared/hooks/use-school-year";

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });
const RESOURCE = "school_year_profiles";

/** Màn khai từng phần dữ liệu còn thiếu. */
const TODO_LINKS: Record<ProfileTodo["part"], { to: string; label: string }> = {
  classes: { to: "/school-classes", label: "Lớp học" },
  teachers: { to: "/staff-assignments", label: "Phân công giáo viên" },
  rooms: { to: "/rooms", label: "Phòng" },
  equipment: { to: "/equipment", label: "Thiết bị" },
  adjustments: { to: "/equipment-minimum", label: "Chuẩn tối thiểu" },
};

export function useYearProfile(schoolId: number | null, yearId: number | null) {
  return useQuery({
    queryKey: [RESOURCE, "profile", schoolId ?? "own", yearId],
    // Không chỉ rõ trường thì là trường của người gọi — chỉ cổng trường có.
    enabled: yearId != null && (schoolId != null || currentPortal() === "school"),
    queryFn: ({ signal }) => kyInstance.get(RESOURCE, {
      signal,
      searchParams: { yearId: String(yearId), ...(schoolId ? { schoolId: String(schoolId) } : {}) },
    }).json<YearProfile>(),
  });
}

/** Khoá `usePersistentState` của tab đang mở ở màn trường (`SchoolWorkspace`), và giá trị của tab Năm học. */
const SCHOOL_TAB_KEY = "explorer.schoolTab";
const YEAR_TAB = "year";

/**
 * `/school-year-profile` — đường cũ (thông báo đã gửi, dấu trang). Hồ sơ năm học nay là tab "Năm học" của màn
 * Trường học: lớp, phân công, phòng, thiết bị theo điểm trường là dữ liệu của trường, không phải của phân hệ Thiết bị.
 * Tài khoản trường: mở tab đó (giữ `?year=`). Cơ quan quản lý: trạng thái năm của từng trường xem ở trang trường đó.
 */
export function SchoolYearProfilePage() {
  const location = useLocation();
  if (currentPortal() === "school") {
    try {
      window.sessionStorage.setItem(SCHOOL_TAB_KEY, JSON.stringify(YEAR_TAB));
    } catch {
      // bộ nhớ bị chặn: vẫn chuyển sang màn trường, chỉ không mở sẵn tab
    }
    return <Navigate to={{ pathname: "/school-explorer", search: location.search }} replace />;
  }
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Hồ sơ năm học" />
      <FillBox>
        <EmptyState icon={<CalendarCheck />} title="Hồ sơ năm học là của từng trường"
          description={<>Trạng thái năm học của một trường xem ở trang trường đó trong mục <Link className="text-primary underline" to="/school-explorer">Trường học</Link>.</>} />
      </FillBox>
    </ListView>
  );
}

/**
 * Hồ sơ năm học của trường đang đăng nhập — nội dung tab "Năm học" của màn Trường học (trưởng nhóm 25/11/2026). Năm học
 * mới thành hiện hành thì có nút "Khai dữ liệu năm học …" (lên lớp, chép phân công, điều chỉnh từ năm trước); trường rà
 * soát, sửa từng điểm trường rồi lãnh đạo trường "Xác nhận đã khai" — Sở được báo. Không khoá: xác nhận rồi vẫn sửa được,
 * hồ sơ ghi lần sửa cuối.
 */
export function SchoolYearProfileBody() {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { id: yearId, setId, year } = useSchoolYear();
  const { data: p, isLoading, isError, error, refetch, isFetching } = useYearProfile(null, yearId);
  const [todos, setTodos] = useState<CampusProfile | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!p) return;
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/confirm`, { json: { schoolYearId: p.schoolYearId } }).json<YearProfile>();
      notify?.({ type: "success", message: `Đã xác nhận khai dữ liệu năm học ${yearLabel(year)}, Sở đã được báo` });
      setConfirming(false);
      await qc.invalidateQueries({ queryKey: [RESOURCE] });
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  if (isError && !p) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  const confirmed = p?.status === "CONFIRMED";
  const ready = p?.campuses.filter((c) => c.todos.length === 0).length ?? 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {p ? <Badge variant={PROFILE_STATUS_VARIANTS[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Badge> : null}
        <span className="flex-1" />
        {p?.initYear ? (
          <Button type="button" onClick={() => setInitOpen(true)}>
            <CalendarPlus />
            Khai dữ liệu {p.initYear.name.replace("Năm học ", "năm học ")}
          </Button>
        ) : null}
      </div>
      {confirmed ? (
        <div className="bg-success-subtle text-success-text flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-4 py-2 text-sm">
          <CircleCheck className="size-4" />
          <span>Đã xác nhận {p?.confirmedAt}{p?.confirmedBy ? ` · ${p.confirmedBy}` : ""}</span>
          {p?.editedAt ? <span className="text-muted-foreground">· Sửa lần cuối {p.editedAt}</span> : null}
          <span className="text-muted-foreground ms-auto text-xs">Vẫn sửa được khi có thay đổi trong năm</span>
        </div>
      ) : p?.initYear ? (
        <div className="bg-info-subtle text-info-text flex items-start gap-2 rounded-lg px-4 py-2.5 text-sm">
          <CalendarPlus className="mt-0.5 size-4 shrink-0" />
          <span>
            {p.initYear.name} đã là năm học hiện hành. Bấm <b>Khai dữ liệu</b> để lên lớp tự động và chép phân công giáo viên
            {p.initYear.fromName ? ` từ ${p.initYear.fromName.toLowerCase()}` : ""}, rồi rà soát, sửa và xác nhận đã khai.
          </span>
        </div>
      ) : null}
      {/* Nói luôn quy trình: màn chỉ có số và nút mờ thì không ai hiểu vì sao chưa xác nhận được (góp ý 23/11/2026). */}
      {p && !confirmed ? (
        <ol className="text-muted-foreground grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <li><span className="text-foreground font-medium">1. Khai đủ dữ liệu</span> của từng điểm trường: lớp và sĩ số,
            phân công giáo viên, phòng, thiết bị đã xếp phòng. Ô màu cam là còn thiếu, bấm vào để sửa.</li>
          <li><span className="text-foreground font-medium">2. Hiệu trưởng xác nhận đã khai</span> khi mọi điểm trường đã
            đủ, Sở được báo. Sau đó trường vẫn sửa được, thiết bị mới vào sổ qua phiếu ghi tăng.</li>
        </ol>
      ) : null}
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
          <Table>
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                <TableHead>Điểm trường</TableHead>
                <TableHead>Lớp, sĩ số</TableHead>
                <TableHead>Giáo viên đã phân công</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Thiết bị trên sổ</TableHead>
                <TableHead className="w-48">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !p ? <TableSkeletonRows cols={6} rows={2} /> : p.campuses.length === 0 ? (
                <TableEmpty colSpan={6} icon={<MapPinned />} title="Trường chưa có điểm trường" />
              ) : p.campuses.map((c) => {
                const part = (k: ProfileTodo["part"]) => c.todos.find((t) => t.part === k);
                const cell = (k: ProfileTodo["part"], text: string) => (
                  <PartCell todo={part(k)} text={text} link={TODO_LINKS[k]} />
                );
                return (
                  <TableRow key={c.campusId ?? "main"}>
                    <TableCell className="font-medium">{c.campusName}</TableCell>
                    <TableCell>{cell("classes", `${num.format(c.classes)} lớp · ${num.format(c.students)} học sinh`)}</TableCell>
                    <TableCell>{cell("teachers", `${num.format(c.assignedTeachers)} / ${num.format(c.teachers)} giáo viên`)}</TableCell>
                    <TableCell>{cell("rooms", `${num.format(c.rooms)} phòng`)}</TableCell>
                    <TableCell>{cell("equipment", `${num.format(c.equipment)} thiết bị`)}</TableCell>
                    <TableCell>
                      {c.todos.length > 0 ? (
                        // Còn thiếu: nói còn mấy việc, bấm ra danh sách việc.
                        <button type="button" onClick={() => setTodos(c)}
                          className="text-warning-text inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
                          <CircleAlert className="size-4" />
                          Còn {c.todos.length} việc
                        </button>
                      ) : (
                        <Badge variant="success"><Check />Đủ dữ liệu</Badge>
                      )}
                      {c.pendingAdjustments ? (
                        <button type="button" onClick={() => setTodos(c)} className="text-warning-text mt-1 block text-xs hover:underline">
                          {c.pendingAdjustments} điều chỉnh chờ xác nhận lại
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {p && !confirmed ? (
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">Đủ dữ liệu {ready}/{p.campuses.length} điểm trường</span>
            <span className="flex-1" />
            {p.canConfirm ? (
              <>
                {!p.ready ? (
                  <span className="text-muted-foreground text-xs">Khai đủ dữ liệu ở {p.campuses.length} điểm trường thì mới xác nhận được</span>
                ) : null}
                <Button type="button" disabled={!p.ready || busy} onClick={() => setConfirming(true)}>
                  <FileCheck2 />
                  Xác nhận đã khai
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">Hiệu trưởng xác nhận đã khai</span>
            )}
          </div>
        ) : null}
      </div>
      <Dialog open={!!todos} onOpenChange={(o) => !o && setTodos(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{todos?.campusName}: việc còn thiếu</DialogTitle>
          </DialogHeader>
          {todos?.todos.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {todos.todos.map((t) => (
                <li key={t.part + t.text} className="flex items-center gap-3 px-4 py-2.5">
                  <CircleAlert className="text-warning-text size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <Link to={TODO_LINKS[t.part].to} className="text-primary shrink-0 text-xs font-medium hover:underline">
                    {TODO_LINKS[t.part].label} →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-success-text text-sm">Đã đủ dữ liệu.</p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        {p ? (
          <ConfirmContent tone="neutral" title={`Xác nhận đã khai ${p.schoolYearName.toLowerCase()}?`}
            description="Sở được báo trường đã khai xong dữ liệu đầu năm. Sau đó trường vẫn sửa lớp, phân công, phòng được khi có thay đổi."
            cancelLabel="Chưa xác nhận" confirmLabel="Xác nhận đã khai" busy={busy}
            onConfirm={() => void confirm()} />
        ) : null}
      </AlertDialog>
      {initOpen && p?.initYear ? (
        <InitYearDialog fromYear={p.initYear.fromName ?? undefined} target={p.initYear} onClose={() => setInitOpen(false)}
          onDone={(id) => { setInitOpen(false); setId(id); }} />
      ) : null}
    </div>
  );
}

/** Ô một phần dữ liệu: đủ thì dấu ✓ xanh; còn thiếu thì chữ vàng, bấm mở danh sách việc. */
/**
 * Một phần dữ liệu của điểm trường: số đã khai (có đơn vị), dấu ✓ khi đủ; còn thiếu thì dòng cam nói thiếu gì và một
 * liên kết tới đúng màn để sửa — trước đây chỉ có số trơ "173" và dòng cam, không biết là gì, sửa ở đâu.
 */
function PartCell({ todo, text, link }: { todo?: ProfileTodo; text: ReactNode; link: { to: string; label: string } }) {
  if (!todo) {
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {text}
        <Check className="text-success-text size-4" />
      </span>
    );
  }
  return (
    <div className="grid gap-0.5 tabular-nums">
      <span>{text}</span>
      <span className="text-warning-text inline-flex flex-wrap items-center gap-x-1.5 text-xs">
        <CircleAlert className="size-3.5 shrink-0" />
        {todo.text}
        <Link to={link.to} className="text-primary font-medium hover:underline">Sửa ở {link.label} →</Link>
      </span>
    </div>
  );
}
