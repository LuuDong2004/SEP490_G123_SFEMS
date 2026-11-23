import { useCan, useList, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CopyPlus, Ellipsis, Loader2, MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { MultiRefSelectField } from "@/shared/components/catalog/multi-ref-select";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { SearchSelect } from "@/shared/components/form/search-select";
import { TextareaField } from "@/shared/components/form/simple-fields";
import { useCampusOptions, usePinnedCampusId } from "@/shared/components/campus/use-campus";
import { errorMessage } from "@/shared/lib/api-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { AssignmentCandidate, CopyResult, Ref, StaffAssignment } from "@/domains/school-year/types";

import { useYearLock } from "./year-lock";
import { yearLabel, useSchoolYear } from "@/shared/hooks/use-school-year";

const RESOURCE = "staff_assignments";
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Phân công giáo viên theo năm học (màn B, docs/du-lieu-theo-nam-hoc.md §2.A): mỗi giáo viên một dòng mỗi năm — điểm trường, môn
 * chính, môn giảng dạy; chủ nhiệm đọc từ lớp của năm đó. Năm đã chốt chỉ xem. Đứng trong tab Nhân sự của trường
 * (mục "Phân công năm học") và ở `/staff-assignments`.
 */
export function StaffAssignmentsPanel({ schoolId }: { schoolId?: number | null }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { id: yearId, years, year } = useSchoolYear();
  const canWrite = useCan({ resource: RESOURCE, action: "create" }).data?.can ?? false;
  const canDelete = useCan({ resource: RESOURCE, action: "delete" }).data?.can ?? false;
  const lock = useYearLock(schoolId ?? null, yearId);
  const editable = canWrite && !lock.closed;
  const pinned = usePinnedCampusId();
  const campuses = useCampusOptions(schoolId, true);
  const [campus, setCampus] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<StaffAssignment | "new" | null>(null);
  const [removing, setRemoving] = useState<StaffAssignment | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: [RESOURCE, "list", schoolId ?? "own", yearId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get(RESOURCE, {
      signal,
      searchParams: { "schoolYear.id": String(yearId), ...(schoolId ? { "school.id": String(schoolId) } : {}) },
    }).json<StaffAssignment[]>(),
  });
  const all = useMemo(() => list.data ?? [], [list.data]);
  const subjects = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of all) for (const s of [a.mainSubject, ...a.subjects]) if (s) m.set(s.id, s.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [all]);
  const term = fold(q.trim());
  const shown = all
    .filter((a) => !campus || String(a.campusId) === campus)
    .filter((a) => !subject || a.mainSubject?.id === Number(subject) || a.subjects.some((s) => s.id === Number(subject)))
    .filter((a) => !term || fold(`${a.staffCode} ${a.staffName}`).includes(term));
  const previous = years.find((y) => year && y.startDate < year.startDate);
  const refresh = () => qc.invalidateQueries({ queryKey: [RESOURCE] });

  const copy = async () => {
    if (yearId == null) return;
    setBusy(true);
    try {
      const r = await kyInstance.post(`${RESOURCE}/copy`, { json: { schoolYear: { id: yearId } } }).json<CopyResult>();
      notify?.({ type: "success", message: `Đã chép ${r.copied} phân công từ năm học ${r.fromYearName.replace("Năm học ", "")}`,
        description: r.skipped ? `Bỏ qua ${r.skipped} người đã nghỉ hoặc đã có phân công` : undefined });
      await refresh();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e), description: "Không chép được phân công" });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await kyInstance.delete(`${RESOURCE}/${removing.id}`).json();
      setRemoving(null);
      await refresh();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e), description: "Không xoá được phân công" });
    } finally {
      setBusy(false);
    }
  };

  const showCampus = pinned == null && campuses.length > 1;
  const cols = 6 + (showCampus ? 1 : 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm cán bộ…" className="ps-9" />
        </div>
        {showCampus ? (
          <IconFilter icon={<MapPin />} label="điểm trường" allLabel="Mọi điểm trường" value={campus} onChange={setCampus}
            groups={[{ items: campuses.map((c) => ({ key: String(c.id), label: c.name ?? String(c.id) })) }]} />
        ) : null}
        <IconFilter icon={<BookOpen />} label="môn" allLabel="Mọi môn" value={subject} onChange={setSubject}
          groups={[{ items: subjects.map(([id, name]) => ({ key: String(id), label: name })) }]} />
        <span className="flex-1" />
        {editable && previous ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void copy()}>
            {busy ? <Loader2 className="animate-spin" /> : <CopyPlus />}
            Chép từ năm học {yearLabel(previous)}
          </Button>
        ) : null}
        {editable ? (
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus />
            Phân công
          </Button>
        ) : null}
      </div>
      {lock.closed ? (
        <div className="bg-success-subtle text-success-text rounded-lg px-4 py-2 text-sm">
          Năm học {yearLabel(year)} đã chốt — phân công chỉ xem.
        </div>
      ) : null}
      <div className="bg-card shadow-e1 min-h-0 flex-1 overflow-hidden rounded-lg border">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Mã</TableHead>
                <TableHead>Họ và tên</TableHead>
                {showCampus ? <TableHead>Điểm trường</TableHead> : null}
                <TableHead>Môn chính</TableHead>
                <TableHead>Môn giảng dạy</TableHead>
                <TableHead className="w-28">Chủ nhiệm</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? <TableSkeletonRows cols={cols} /> : shown.length === 0 ? (
                <TableEmpty colSpan={cols} icon={<Users />} filtered={all.length > 0}
                  title={all.length ? "Không có phân công khớp bộ lọc" : `Chưa phân công giáo viên năm học ${yearLabel(year)}`}
                  action={!all.length && editable && previous ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void copy()}>
                      <CopyPlus />
                      Chép từ năm học {yearLabel(previous)}
                    </Button>
                  ) : undefined} />
              ) : shown.map((a) => (
                <TableRow key={a.id} className={cn("group/row", LIFT_ROW, editable && "cursor-pointer")}
                  onClick={() => editable && setEditing(a)}>
                  <TableCell className="font-mono text-[0.8125rem]">{a.staffCode}</TableCell>
                  <TableCell>
                    <span className={cn("font-medium", !a.staffActive && "text-muted-foreground line-through")}>{a.staffName}</span>
                  </TableCell>
                  {showCampus ? <TableCell className="text-muted-foreground">{a.campusName ?? "Cơ sở chính"}</TableCell> : null}
                  <TableCell>{a.mainSubject?.name ?? <span className="text-warning-text">Chưa có</span>}</TableCell>
                  <TableCell className="max-w-[20rem] truncate" title={a.subjects.map((s) => s.name).join(", ")}>
                    {a.subjects.map((s) => s.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>{a.homeroomClasses.join(", ") || "—"}</TableCell>
                  <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                    {editable ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Thao tác">
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => setEditing(a)}>
                            <Pencil />
                            Sửa
                          </DropdownMenuItem>
                          {canDelete ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(a)}>
                              <Trash2 />
                              Xoá
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {editing ? (
        <AssignmentDialog yearId={yearId!} record={editing === "new" ? null : editing}
          showCampus={showCampus} campuses={campuses.map((c) => ({ id: c.id, name: c.name ?? String(c.id) }))}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing ? (
          <ConfirmContent tone="danger" title={`Xoá phân công của ${removing.staffName}?`}
            description={`Năm học ${yearLabel(year)}. Hồ sơ cán bộ giữ nguyên.`}
            cancelLabel="Không xoá" confirmLabel="Xoá" busy={busy} onConfirm={() => void remove()} />
        ) : null}
      </AlertDialog>
    </div>
  );
}

type FormValues = { staff: string | null; campus: string | null; mainSubject: string | null; subjects: Ref[]; note: string };

function AssignmentDialog({ yearId, record, showCampus, campuses, onClose, onSaved }: {
  yearId: number;
  record: StaffAssignment | null;
  showCampus: boolean;
  campuses: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const candidates = useQuery({
    queryKey: [RESOURCE, "candidates", yearId],
    enabled: !record,
    queryFn: ({ signal }) => kyInstance.get(`${RESOURCE}/candidates`, { signal, searchParams: { "schoolYear.id": String(yearId) } })
      .json<AssignmentCandidate[]>(),
  });
  const { result: subjectList } = useList<{ id: number; name: string }>({
    resource: "subjects",
    pagination: { pageSize: 300 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    filters: [{ field: "active", operator: "eq", value: true }],
  });
  const subjectOptions = (subjectList?.data ?? []).map((s) => ({ value: String(s.id), label: s.name }));
  if (record?.mainSubject && !subjectOptions.some((o) => o.value === String(record.mainSubject!.id))) {
    subjectOptions.push({ value: String(record.mainSubject.id), label: record.mainSubject.name });
  }
  const form = useForm<FieldValues>({
    mode: "onTouched",
    defaultValues: {
      staff: record ? String(record.staffId) : null,
      campus: record?.campusId != null ? String(record.campusId) : null,
      mainSubject: record?.mainSubject ? String(record.mainSubject.id) : null,
      subjects: record ? record.subjects.filter((s) => s.id !== record.mainSubject?.id) : [],
      note: record?.note ?? "",
    },
  });
  const pickStaff = (id: string | null) => {
    form.setValue("staff", id, { shouldValidate: true });
    const c = candidates.data?.find((x) => String(x.id) === id);
    if (c) {
      form.setValue("mainSubject", c.mainSubject ? String(c.mainSubject.id) : null);
      form.setValue("subjects", c.subjects.filter((s) => s.id !== c.mainSubject?.id));
      if (c.campusId != null) form.setValue("campus", String(c.campusId));
    }
  };
  const submit = form.handleSubmit(async (raw) => {
    const v = raw as FormValues;
    setError(null);
    const body = {
      schoolYear: { id: yearId },
      staff: v.staff ? { id: Number(v.staff) } : null,
      campus: v.campus ? { id: Number(v.campus) } : null,
      mainSubject: v.mainSubject ? { id: Number(v.mainSubject) } : null,
      subjects: v.subjects.map((s) => ({ id: s.id })),
      note: v.note,
    };
    try {
      if (record) await kyInstance.patch(`${RESOURCE}/${record.id}`, { json: body }).json();
      else await kyInstance.post(RESOURCE, { json: body }).json();
      onSaved();
    } catch (e) {
      setError(await errorMessage(e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{record ? `Phân công: ${record.staffName}` : "Phân công giáo viên"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid items-start gap-x-4 gap-y-5">
            {!record ? (
              <FormField control={form.control} name="staff" rules={{ required: "Vui lòng chọn giáo viên" }} render={({ field, fieldState }) => (
                <FormItem className="max-w-[28rem]">
                  <FormLabel>Giáo viên</FormLabel>
                  <SearchSelect options={(candidates.data ?? []).map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))}
                    value={field.value} onChange={pickStaff} invalid={!!fieldState.error}
                    placeholder={candidates.isLoading ? "Đang tải…" : candidates.data?.length ? "Vui lòng chọn giáo viên" : "Mọi giáo viên đã được phân công"} />
                  <FormMessage />
                </FormItem>
              )} />
            ) : null}
            {showCampus ? (
              <FormField control={form.control} name="campus" render={({ field }) => (
                <FormItem className="max-w-[20rem]">
                  <FormLabel>Điểm trường</FormLabel>
                  <SearchSelect options={campuses.map((c) => ({ value: String(c.id), label: c.name }))} value={field.value}
                    onChange={field.onChange} placeholder="Cơ sở chính" />
                </FormItem>
              )} />
            ) : null}
            <FormField control={form.control} name="mainSubject" rules={{ required: "Vui lòng chọn môn chính" }} render={({ field, fieldState }) => (
              <FormItem className="max-w-[20rem]">
                <FormLabel>Môn chính</FormLabel>
                <SearchSelect options={subjectOptions} value={field.value} onChange={field.onChange} invalid={!!fieldState.error}
                  placeholder="Vui lòng chọn môn chính" />
                <FormMessage />
              </FormItem>
            )} />
            <MultiRefSelectField control={form.control} name="subjects" resource="subjects" label="Môn giảng dạy khác" className="max-w-[28rem]" />
            <TextareaField control={form.control} name="note" label="Ghi chú" rule="NOTE" />
            {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
            <DialogFooter className="justify-self-end">
              <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
