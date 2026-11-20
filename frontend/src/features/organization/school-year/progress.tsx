import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CircleDot, Ellipsis, Gauge, GraduationCap, LockOpen, MapPin, Search, School } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { PROFILE_STATUS_LABELS, type ProfileStatus, type ProgressRow } from "@/domains/school-year/types";

import { InitYearDialog } from "./init-year";
import { YearFilter, yearLabel, useYearParam } from "./year-filter";

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/**
 * `/school-year-progress` — tiến độ hồ sơ năm học các trường (màn E, Sở): mỗi trường số điểm đã xác nhận, trạng
 * thái, ngày chốt; lọc phường / xã, cấp học, trạng thái. Cơ quan quản lý của trường mở lại năm đã chốt (có lý do).
 */
export function SchoolYearProgressPage() {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: yearId, setId, years, current, year } = useYearParam();
  const [q, setQ] = useState("");
  const [ward, setWard] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reopening, setReopening] = useState<ProgressRow | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  // Sở khởi tạo năm học cho nhiều trường một lần (các trường đang lọc).
  const canInit = useCan({ resource: "school_year_profiles", action: "create" }).data?.can ?? false;
  const { data, isLoading } = useQuery({
    queryKey: ["school_year_profiles", "progress", yearId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get("school_year_profiles/progress", { signal, searchParams: { yearId: String(yearId) } })
      .json<ProgressRow[]>(),
  });
  const rows = useMemo(() => data ?? [], [data]);
  const wards = useMemo(() => [...new Set(rows.map((r) => r.wardName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "vi")), [rows]);
  const levels = useMemo(() => [...new Set(rows.map((r) => r.levelName).filter(Boolean) as string[])], [rows]);
  const term = fold(q.trim());
  const shown = rows
    .filter((r) => !ward || r.wardName === ward)
    .filter((r) => !level || r.levelName === level)
    .filter((r) => !status || (status === "OPEN" ? r.status !== "CLOSED" : r.status === status))
    .filter((r) => !term || fold(`${r.schoolCode} ${r.schoolName}`).includes(term));
  const counts = (s: ProfileStatus) => rows.filter((r) => r.status === s).length;

  const reopen = async () => {
    if (!reopening) return;
    if (!reason.trim()) {
      setReasonError("Vui lòng nhập lý do mở lại");
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post("school_year_profiles/reopen", {
        json: { schoolId: reopening.schoolId, schoolYearId: yearId, reason: reason.trim() },
      }).json();
      notify?.({ type: "success", message: `Đã mở lại năm học ${yearLabel(year)} của ${reopening.schoolName}` });
      setReopening(null);
      await qc.invalidateQueries({ queryKey: ["school_year_profiles"] });
    } catch (e) {
      setReasonError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Tiến độ hồ sơ năm học" />
      <FillBox>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <YearFilter value={yearId} onChange={setId} years={years} current={current} />
            <div className="relative w-full min-w-0 sm:w-72">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trường…" className="ps-9" />
            </div>
            {wards.length > 1 ? (
              <IconFilter icon={<MapPin />} label="phường / xã" allLabel="Mọi phường / xã" value={ward} onChange={setWard}
                groups={[{ items: wards.map((w) => ({ key: w, label: w })) }]} />
            ) : null}
            {levels.length > 1 ? (
              <IconFilter icon={<GraduationCap />} label="cấp học" allLabel="Mọi cấp học" value={level} onChange={setLevel}
                groups={[{ items: levels.map((l) => ({ key: l, label: l })) }]} />
            ) : null}
            <IconFilter icon={<CircleDot />} label="trạng thái" allLabel="Tất cả" total={rows.length} value={status} onChange={setStatus}
              groups={[{ items: [
                { key: "OPEN", label: "Chưa chốt", count: rows.length - counts("CLOSED") },
                ...(["DRAFT", "CONFIRMED", "CLOSED", "REOPENED"] as ProfileStatus[]).map((s) => ({ key: s, label: PROFILE_STATUS_LABELS[s], count: counts(s) })),
              ] }]} />
            <span className="flex-1" />
            {canInit && year && shown.length ? (
              <Button type="button" variant="outline" onClick={() => setInitOpen(true)}>
                <CalendarCheck />
                Khởi tạo năm học {yearLabel(year)}
              </Button>
            ) : null}
          </div>
          <div className="bg-card shadow-e1 min-h-0 flex-1 overflow-hidden rounded-lg border">
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[12rem]">Trường</TableHead>
                    <TableHead className="w-32 text-right">Điểm trường</TableHead>
                    <TableHead className="w-32 text-right">Đã xác nhận</TableHead>
                    <TableHead className="w-36">Trạng thái</TableHead>
                    <TableHead className="w-32">Ngày chốt</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableSkeletonRows cols={6} /> : shown.length === 0 ? (
                    <TableEmpty colSpan={6} icon={<School />} filtered={rows.length > 0}
                      title={rows.length ? "Không có trường khớp bộ lọc" : "Chưa có trường nào"} />
                  ) : shown.map((r) => (
                    <TableRow key={r.schoolId} className={cn("group/row cursor-pointer", LIFT_ROW)}
                      onClick={() => navigate(`/equipment-minimum?school=${r.schoolId}&year=${yearId}`)}>
                      <TableCell className="max-w-[24rem]">
                        <div className="truncate font-medium" title={r.schoolName}>{r.schoolName}</div>
                        <div className="text-muted-foreground truncate text-xs">{[r.levelName, r.wardName].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.campuses}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.confirmed < r.campuses && "text-warning-text")}>
                        {r.confirmed}/{r.campuses}
                      </TableCell>
                      <TableCell><Badge variant={PROFILE_STATUS_VARIANTS[r.status]}>{PROFILE_STATUS_LABELS[r.status]}</Badge></TableCell>
                      <TableCell className="tabular-nums">{r.closedAt ?? "—"}</TableCell>
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Thao tác">
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => navigate(`/equipment-minimum?school=${r.schoolId}&year=${yearId}`)}>
                              <Gauge />
                              Xem chuẩn tối thiểu
                            </DropdownMenuItem>
                            {r.canReopen ? (
                              <DropdownMenuItem onSelect={() => { setReason(""); setReasonError(null); setReopening(r); }}>
                                <LockOpen />
                                Mở lại năm học
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </FillBox>
      {initOpen && year ? (
        <InitYearDialog target={{ id: year.id, name: year.name }} schoolIds={shown.map((r) => r.schoolId)}
          onClose={() => setInitOpen(false)} onDone={() => setInitOpen(false)} />
      ) : null}
      <AlertDialog open={!!reopening} onOpenChange={(o) => !o && setReopening(null)}>
        {reopening ? (
          <ConfirmContent tone="warning" title={`Mở lại năm học ${yearLabel(year)} của ${reopening.schoolName}?`}
            description="Trường sửa được dữ liệu năm này và phải chốt lại; bản chốt cũ giữ làm lịch sử."
            cancelLabel="Không mở" confirmLabel="Mở lại" busy={busy} keepOpen onConfirm={() => void reopen()}>
            <div className="space-y-1.5">
              <Label htmlFor="reopen-reason">Lý do<span className="text-destructive"> *</span></Label>
              <Textarea id="reopen-reason" rows={2} value={reason} maxLength={1000} aria-invalid={!!reasonError || undefined}
                onChange={(e) => { setReason(e.target.value); setReasonError(null); }} placeholder="Vd. trường khai thiếu sĩ số lớp 9" />
              {reasonError ? <p className="text-destructive-text text-xs">{reasonError}</p> : null}
            </div>
          </ConfirmContent>
        ) : null}
      </AlertDialog>
    </ListView>
  );
}
