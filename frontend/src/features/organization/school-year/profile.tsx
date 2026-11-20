import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, CircleAlert, FileCheck2, History, Loader2, Lock, MapPinned } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { currentPortal } from "@/shared/api/portal";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { EmptyState, TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { QueryError } from "@/shared/components/query-error";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PROFILE_STATUS_LABELS, type CampusProfile, type ProfileTodo, type YearProfile } from "@/domains/school-year/types";

import { InitYearDialog } from "./init-year";
import { YearFilter, yearLabel, useYearParam } from "./year-filter";

const num = new Intl.NumberFormat("vi-VN");
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

/**
 * `/school-year-profile` — hồ sơ năm học của trường (màn A): mỗi điểm trường một dòng với bốn phần dữ liệu và trạng thái
 * Đang khai → Đã xác nhận; lãnh đạo trường xác nhận từng điểm rồi chốt năm học (hộp F). Năm đã chốt chỉ xem, có liên kết
 * tới bản chốt.
 */
export function SchoolYearProfilePage() {
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Hồ sơ năm học" />
      <FillBox>
        {currentPortal() === "school" ? <ProfileBody /> : (
          <EmptyState icon={<CalendarCheck />} title="Hồ sơ năm học là của từng trường"
            description={<>Xem tiến độ các trường ở <Link className="text-primary underline" to="/school-year-progress">Tiến độ hồ sơ năm học</Link>.</>} />
        )}
      </FillBox>
    </ListView>
  );
}

function ProfileBody() {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { id: yearId, setId, years, current, year } = useYearParam();
  const { data: p, isLoading, isError, error, refetch, isFetching } = useYearProfile(null, yearId);
  const [todos, setTodos] = useState<CampusProfile | null>(null);
  const [closing, setClosing] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const post = async (path: string, body: object, key: string, ok?: string) => {
    setBusy(key);
    try {
      await kyInstance.post(`${RESOURCE}/${path}`, { json: body }).json<YearProfile>();
      if (ok) notify?.({ type: "success", message: ok });
      await qc.invalidateQueries({ queryKey: [RESOURCE] });
      await qc.invalidateQueries({ queryKey: ["year_standards"] });
      return true;
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (isError && !p) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  const closed = p?.status === "CLOSED";
  const confirmed = p?.campuses.filter((c) => c.status === "CONFIRMED").length ?? 0;
  const reopened = p?.history.find((h) => h.status === "REOPENED");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <YearFilter value={yearId} onChange={setId} years={years} current={current} />
        {p ? <Badge variant={PROFILE_STATUS_VARIANTS[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Badge> : null}
        <span className="flex-1" />
        {p?.canWrite && p.nextYear ? (
          <Button type="button" variant="outline" onClick={() => setInitOpen(true)}>
            <CalendarCheck />
            Khởi tạo {p.nextYear.name.replace("Năm học ", "năm học ")}
          </Button>
        ) : null}
      </div>
      {closed && p?.closing ? (
        <div className="bg-success-subtle text-success-text flex flex-wrap items-center gap-2 rounded-lg px-4 py-2 text-sm">
          <Lock className="size-4" />
          <span>Đã chốt {p.closing.closedAt}{p.closing.closedBy ? ` · ${p.closing.closedBy}` : ""}</span>
          <Link to={`/equipment-minimum?year=${p.schoolYearId}`} className="ms-auto font-medium hover:underline">Xem bản chốt →</Link>
        </div>
      ) : reopened ? (
        <div className="bg-warning-subtle text-warning-text flex min-w-0 items-center gap-2 rounded-lg px-4 py-2 text-sm">
          <History className="size-4 shrink-0" />
          <span className="min-w-0 truncate" title={reopened.reopenReason ?? ""}>
            Mở lại {reopened.reopenedAt}{reopened.reopenedBy ? ` · ${reopened.reopenedBy}` : ""}: {reopened.reopenReason}
          </span>
        </div>
      ) : null}
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Điểm trường</TableHead>
                <TableHead>Lớp, sĩ số</TableHead>
                <TableHead>Phân công giáo viên</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead className="w-36">Trạng thái</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !p ? <TableSkeletonRows cols={7} rows={2} /> : p.campuses.length === 0 ? (
                <TableEmpty colSpan={7} icon={<MapPinned />} title="Trường chưa có điểm trường" />
              ) : p.campuses.map((c) => {
                const part = (k: ProfileTodo["part"]) => c.todos.find((t) => t.part === k);
                const cell = (k: ProfileTodo["part"], text: string) => (
                  <PartCell todo={part(k)} text={text} onOpen={() => setTodos(c)} />
                );
                return (
                  <TableRow key={c.campusId ?? "main"}>
                    <TableCell className="font-medium">{c.campusName}</TableCell>
                    <TableCell>{cell("classes", `${num.format(c.classes)} lớp · ${num.format(c.students)} HS`)}</TableCell>
                    <TableCell>{cell("teachers", `${num.format(c.assignedTeachers)} / ${num.format(c.teachers)}`)}</TableCell>
                    <TableCell>{cell("rooms", `${num.format(c.rooms)} phòng`)}</TableCell>
                    <TableCell>{cell("equipment", num.format(c.equipment))}</TableCell>
                    <TableCell>
                      <Badge variant={PROFILE_STATUS_VARIANTS[closed ? "CLOSED" : c.status]}>
                        {PROFILE_STATUS_LABELS[closed ? "CLOSED" : c.status]}
                      </Badge>
                      {c.pendingAdjustments ? (
                        <button type="button" onClick={() => setTodos(c)} className="text-warning-text mt-1 block text-xs hover:underline">
                          {c.pendingAdjustments} điều chỉnh chờ xác nhận lại
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.canConfirm && c.status === "CONFIRMED" ? (
                        <Button type="button" variant="outline" size="sm" disabled={!!busy}
                          onClick={() => void post("unconfirm", { schoolYearId: p.schoolYearId, campusId: c.campusId }, `u${c.campusId}`)}>
                          {busy === `u${c.campusId}` ? <Loader2 className="animate-spin" /> : null}
                          Bỏ xác nhận
                        </Button>
                      ) : p.canConfirm ? (
                        <Button type="button" size="sm" disabled={!!busy || c.todos.length > 0}
                          title={c.todos.length ? c.todos.map((t) => t.text).join("\n") : undefined}
                          onClick={() => void post("confirm", { schoolYearId: p.schoolYearId, campusId: c.campusId }, `c${c.campusId}`, `Đã xác nhận ${c.campusName}`)}>
                          {busy === `c${c.campusId}` ? <Loader2 className="animate-spin" /> : <Check />}
                          Xác nhận
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {p && !closed ? (
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">Đã xác nhận {confirmed}/{p.campuses.length} điểm trường</span>
            <span className="flex-1" />
            {p.canConfirm ? (
              <Button type="button" disabled={!p.canClose || !!busy} onClick={() => setClosing(true)}
                title={p.canClose ? undefined : "Chốt khi mọi điểm trường đã xác nhận"}>
                <FileCheck2 />
                Chốt năm học
              </Button>
            ) : null}
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
      <AlertDialog open={closing} onOpenChange={setClosing}>
        {p ? (
          <ConfirmContent tone="neutral" title={`Chốt ${p.schoolYearName.toLowerCase()} của ${p.schoolName}?`}
            description="Số liệu chuẩn tối thiểu lưu thành bản chốt; lớp, phân công giáo viên, điều chỉnh của năm này bị khoá."
            cancelLabel="Chưa chốt" confirmLabel="Chốt năm học" busy={busy === "close"}
            onConfirm={() => void post("close", { schoolYearId: p.schoolYearId }, "close", `Đã chốt năm học ${yearLabel(year)}`)
              .then((ok) => ok && setClosing(false))} />
        ) : null}
      </AlertDialog>
      {initOpen && p?.nextYear ? (
        <InitYearDialog fromYear={p.schoolYearName} target={p.nextYear} onClose={() => setInitOpen(false)}
          onDone={(id) => { setInitOpen(false); setId(id); }} />
      ) : null}
    </div>
  );
}

/** Ô một phần dữ liệu: đủ thì dấu ✓ xanh; còn thiếu thì chữ vàng, bấm mở danh sách việc. */
function PartCell({ todo, text, onOpen }: { todo?: ProfileTodo; text: ReactNode; onOpen: () => void }) {
  if (!todo) {
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {text}
        <Check className="text-success-text size-4" />
      </span>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={cn("text-warning-text inline-flex flex-col items-start text-left tabular-nums hover:underline")}>
      <span>{text}</span>
      <span className="text-xs">{todo.text}</span>
    </button>
  );
}
