import { useInvalidate, useList, useNotification, useOne, type CrudFilter } from "@refinedev/core";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import type { ColumnDef } from "@tanstack/react-table";
import { GraduationCap, ListPlus, Minus, PenLine, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { CatalogActiveField, CatalogCodeField, CatalogNoteField } from "@/shared/components/catalog/fields";
import { RefField } from "@/shared/components/catalog/ref-field";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { numberError } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { SameSchoolRef, TextField, refCell } from "@/features/organization/resources/facility-extra";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";
import { SIDE_GROUPS, SideGroup } from "@/features/organization/resources/form-groups";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Năm học đang làm việc (ô năm học trên header) — mặc định cho lớp mới: lớp lập ra là lớp của năm đang khai. */
function useCurrentSchoolYear() {
  const { years, year } = useSchoolYear();
  return { years, current: year };
}

/**
 * Bộ lọc khối lớp theo CẤP HỌC của trường — THCS chỉ có lớp 6–9. Trường chưa khai cấp học thì
 * không lọc. Máy chủ cũng từ chối khối sai cấp; lọc ở đây để không ai phải chọn sai rồi mới biết.
 */
export function useGradeFilters(schoolId: number | string | null | undefined): CrudFilter[] {
  const { result } = useOne<any>({
    resource: "schools",
    id: schoolId ?? "",
    queryOptions: { enabled: !!schoolId },
  });
  const levelId = result?.educationLevel?.id;
  return levelId ? [{ field: "educationLevel.id", operator: "eq", value: levelId }] : [];
}

type NameStyle = "number" | "letter";

/**
 * "LOP_6" → "6A" (đặt theo số: 6A1, 6A2) hoặc "6" (đặt theo chữ: 6A, 6B): tiền tố gợi ý cho "Thêm nhanh".
 * Khối không mang số: lấy tên khối.
 */
function prefixOf(grade: any, style: NameStyle) {
  const n = /(\d+)/.exec(String(grade?.code ?? ""))?.[1];
  if (n) return style === "letter" ? n : `${n}A`;
  const name = String(grade?.name ?? "").split(" (")[0].trim();
  return name ? `${name} ` : "";
}

/** Hậu tố thứ n: số (1, 2, 3) hoặc chữ (1 = A, 2 = B). */
const suffixOf = (n: number, style: NameStyle) => (style === "letter" ? String.fromCharCode(64 + n) : String(n));

/** Việc tự động của form lớp: năm học mặc định, tên hiển thị "Lớp " + tên lớp, lọc khối theo cấp học. */
function useClassForm(control: Control<any>, record?: any) {
  const { setValue, getValues } = useFormContext();
  const { current } = useCurrentSchoolYear();
  // Lớp mới mặc định năm học hiện hành. Theo dõi chính ô năm học chứ không chỉ chạy một lần: hộp
  // thoại nạp lại form (giá trị đặt sẵn) SAU khi ô này đã mount, và lần nạp ấy xoá mất mặc định.
  const yearId = useWatch({ control, name: "schoolYear.id" });
  useEffect(() => {
    if (!record && current && !yearId) setValue("schoolYear", { id: current.id });
  }, [record, current, yearId, setValue]);
  // Tên hiển thị không có ô riêng: luôn là "Lớp " + tên lớp.
  const code = useWatch({ control, name: "code" });
  const chosenSchool = useWatch({ control, name: "school.id" });
  const gradeFilters = useGradeFilters(record?.school?.id ?? chosenSchool);
  useEffect(() => {
    const name = getValues("name");
    if (code && (!name || /^Lớp \S*$/.test(name))) setValue("name", `Lớp ${code}`, { shouldDirty: true });
  }, [code, getValues, setValue]);
  return { current, gradeFilters };
}

/* Từng ô của form lớp — khuôn chung (`ClassFields`) và bố cục riêng (`ClassFormBody`) dùng cùng một bộ. */
type ClassFieldProps = { control: Control<any>; record?: any };

function GradeField({ control, record, filters }: ClassFieldProps & { filters: CrudFilter[] }) {
  return (
    <RefField control={control} name="grade" resource="grades" label="Khối lớp" hint="Chọn khối thuộc cấp học của trường. Định mức theo lớp tính theo khối này." required current={record?.grade}
      filters={filters} />
  );
}

function SchoolYearField({ control, record, current }: ClassFieldProps & { current: any }) {
  return (
    <RefField control={control} name="schoolYear" resource="school_years" label="Năm học" required
      current={record?.schoolYear ?? (current ? { id: current.id, code: current.code, name: current.name } : undefined)} />
  );
}

function StudentCountField({ control }: ClassFieldProps) {
  return (
    <TextField control={control} name="studentCount" label="Sĩ số" hint="Dùng để tính định mức theo học sinh." placeholder="VD: 42" number numberRule="COUNT"
      rules={{ validate: { max: (v: unknown) => v == null || v === "" || Number(v) <= 200 || "Sĩ số tối đa 200" } }} />
  );
}

function HomeroomTeacherField({ control, record }: ClassFieldProps) {
  return (
    <SameSchoolRef control={control} record={record} name="homeroomTeacher" resource="staff"
      label="Giáo viên chủ nhiệm" current={record?.homeroomTeacher}
      extraFilters={[{ field: "staffType", operator: "eq", value: "teacher" }]} />
  );
}

/** Loại phòng của lớp: chỉ "Phòng học" (PHONG_HOC) — kho, thư viện, phòng bộ môn không phải phòng của một lớp. */
const CLASSROOM_TYPE = "PHONG_HOC";

function RoomField({ control, record }: ClassFieldProps) {
  const { result: types } = useList<any>({
    resource: "room_types",
    filters: [{ field: "code", operator: "eq", value: CLASSROOM_TYPE }],
    pagination: { pageSize: 1 },
  });
  const typeId = types?.data?.[0]?.id;
  // Phòng đã là phòng của lớp khác cùng năm học: nhắc ngay dưới ô (trường học hai ca vẫn được dùng chung).
  const roomId = useWatch({ control, name: "room.id" });
  const yearId = useWatch({ control, name: "schoolYear.id" });
  const { result: sharing } = useList<any>({
    resource: "school_classes",
    filters: [
      { field: "room.id", operator: "eq", value: roomId },
      ...(yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
    ],
    pagination: { pageSize: 10 },
    queryOptions: { enabled: !!roomId },
  });
  const others = roomId ? (sharing?.data ?? []).filter((c: any) => c.id !== record?.id) : [];
  return (
    <div className="grid gap-1.5">
      <SameSchoolRef control={control} record={record} name="room" resource="rooms" label="Phòng học" current={record?.room}
        extraFilters={typeId ? [{ field: "roomType.id", operator: "eq", value: typeId }] : undefined} />
      {others.length ? (
        <p className="text-warning-text text-xs">
          Phòng này đang là phòng của lớp {others.map((c: any) => String(c.name ?? c.code).replace(/^Lớp\s+/i, "")).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function ClassFields({ control, record }: ClassFieldProps) {
  const { current, gradeFilters } = useClassForm(control, record);
  return (
    <>
      {/* Lớp luôn thêm từ màn của MỘT trường: ô Trường chỉ còn hiện khi thật sự phải chọn. */}
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="contents">
        <GradeField control={control} record={record} filters={gradeFilters} />
        <SchoolYearField control={control} record={record} current={current} />
        <StudentCountField control={control} />
        <HomeroomTeacherField control={control} record={record} />
        <RoomField control={control} record={record} />
      </div>
    </>
  );
}

/**
 * Form thêm / sửa lớp chia ba nhóm, tên nhóm bên trái: Lớp học (tên, năm học, khối, sĩ số) · Phòng và chủ nhiệm · Ghi chú.
 * Cùng các ô, cùng luật với khuôn chung — chỉ khác cách xếp.
 */
function ClassFormBody({ control, record, config }: { control: any; record?: any; config: CatalogConfig }) {
  const { current, gradeFilters } = useClassForm(control, record);
  return (
    <div className={SIDE_GROUPS}>
      <SideGroup icon={GraduationCap} title="Lớp học" description="Tên, khối và năm học của lớp.">
        {/* Lớp luôn thêm từ màn của MỘT trường: ô Trường chỉ còn hiện khi thật sự phải chọn. */}
        <div className="empty:hidden sm:col-span-2">
          <SchoolField control={control} record={record} hideWhenFixed wide />
        </div>
        <CatalogCodeField control={control} config={config} fill />
        <SchoolYearField control={control} record={record} current={current} />
        <GradeField control={control} record={record} filters={gradeFilters} />
        <StudentCountField control={control} />
        {/* Công tắc hoạt động chỉ ở màn sửa, như khuôn chung. */}
        {record ? <CatalogActiveField control={control} className="sm:col-span-2" /> : null}
      </SideGroup>
      <SideGroup icon={Users} title="Phòng và chủ nhiệm" description="Không bắt buộc, điền sau cũng được.">
        <RoomField control={control} record={record} />
        <HomeroomTeacherField control={control} record={record} />
      </SideGroup>
      <SideGroup icon={PenLine} title="Ghi chú">
        <div className="sm:col-span-2">
          <CatalogNoteField control={control} />
        </div>
      </SideGroup>
    </div>
  );
}

/**
 * "Thêm nhanh" như MISA: một khối, N lớp, tên lớp = tiền tố + số thứ tự (6A1…6A4). Lớp đã có trong
 * năm học thì máy chủ bỏ qua, nên bấm lại lần hai không sinh lớp trùng.
 */
/** Ô số có nút − / + hai bên: chỉnh từng đơn vị không phải gõ. */
function Stepper({ value, min, max, onChange, format }: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Hiện giá trị theo cách khác (A, B, C…) — khi đó ô chỉ đổi bằng nút − / +. */
  format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="bg-field shadow-e1 flex h-9 items-center rounded-full border">
      <button type="button" aria-label="Giảm" onClick={() => set(value - 1)} disabled={value <= min}
        className="text-muted-foreground hover:text-foreground flex h-full w-9 items-center justify-center disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        readOnly={!!format}
        value={format ? format(value) : value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="h-full min-w-0 flex-1 bg-transparent text-center text-sm tabular-nums outline-none"
      />
      <button type="button" aria-label="Tăng" onClick={() => set(value + 1)} disabled={value >= max}
        className="text-muted-foreground hover:text-foreground flex h-full w-9 items-center justify-center disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function QuickAddClasses({ schoolId: fixedSchool, label = "Thêm nhanh", linkStyle, open: openProp, onOpenChange }: {
  schoolId?: number;
  label?: string;
  /** Hiện như một nhãn "…→" trong hàng chữ thay vì nút viền. */
  linkStyle?: boolean;
  /** Màn ngoài tự mở hộp (mục trong menu của nút thêm): không vẽ nút của riêng nó. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [inner, setInner] = useState(false);
  const controlled = openProp !== undefined;
  const open = openProp ?? inner;
  const setOpen = onOpenChange ?? setInner;
  const [schoolId, setSchoolId] = useState(fixedSchool ? String(fixedSchool) : "");
  const [gradeId, setGradeId] = useState("");
  const [yearId, setYearId] = useState("");
  const [style, setStyle] = useState<NameStyle>("number");
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [count, setCount] = useState(4);
  const [students, setStudents] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studentsError = numberError("COUNT", "Sĩ số", students)
    ?? (students !== "" && Number(students) > 200 ? "Sĩ số tối đa 200" : undefined);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();

  const { years, current } = useCurrentSchoolYear();
  const gradeFilters = useGradeFilters(schoolId || null);
  const { result: grades } = useList<any>({
    resource: "grades",
    filters: gradeFilters,
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const { result: schools } = useList<any>({
    resource: "schools",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const schoolRows = schools?.data ?? [];
  const onlySchool = fixedSchool ? { id: fixedSchool } : schoolRows.length === 1 ? schoolRows[0] : null;

  useEffect(() => {
    if (open && !yearId && current) setYearId(String(current.id));
  }, [open, yearId, current]);
  useEffect(() => {
    if (onlySchool && !schoolId) setSchoolId(String(onlySchool.id));
  }, [onlySchool, schoolId]);

  // Lớp đã có của khối này trong năm học — để "Bắt đầu từ" tự nhảy tới số kế tiếp (đã có 6A1–6A4
  // thì bắt đầu từ 5) và để phần xem trước nói trước lớp nào sẽ bị bỏ qua.
  const { result: existingResult } = useList<any>({
    resource: "school_classes",
    filters: [
      { field: "school.id", operator: "eq", value: schoolId },
      { field: "schoolYear.id", operator: "eq", value: yearId },
      { field: "grade.id", operator: "eq", value: gradeId },
    ],
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open && !!schoolId && !!yearId && !!gradeId },
  });
  const existing = new Set((existingResult?.data ?? []).map((c: any) => String(c.code).toUpperCase()));
  const [startTouched, setStartTouched] = useState(false);
  useEffect(() => {
    if (startTouched || !prefix) return;
    // Tiền tố chỉ gồm chữ, số, . _ - (ô nhập lọc sẵn) — chỉ dấu chấm cần thoát trong biểu thức.
    const head = prefix.toUpperCase().replace(/\./g, "\\.");
    const re = new RegExp(style === "letter" ? `^${head}([A-Z])$` : `^${head}(\\d+)$`);
    const taken = [...existing]
      .map((c) => re.exec(c)?.[1])
      .filter((v): v is string => !!v)
      .map((v) => (style === "letter" ? v.charCodeAt(0) - 64 : Number(v)));
    setStart(taken.length ? Math.max(...taken) + 1 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `existing` dựng lại mỗi lần vẽ; theo dữ liệu nguồn
  }, [prefix, style, existingResult, startTouched]);

  // Theo chữ thì dừng ở Z: bắt đầu từ E thì nhiều nhất 22 lớp.
  const maxCount = style === "letter" ? Math.max(0, 27 - start) : 30;
  const shownCount = Math.min(count, maxCount);
  const names = prefix ? Array.from({ length: shownCount }, (_, i) => `${prefix}${suffixOf(start + i, style)}`) : [];
  const fresh = names.filter((n) => !existing.has(n.toUpperCase()));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const created: any[] = await kyInstance
        .post("school_classes/bulk", {
          json: {
            school: schoolId ? { id: Number(schoolId) } : null,
            grade: { id: Number(gradeId) },
            schoolYear: { id: Number(yearId) },
            prefix: prefix.trimStart(),
            start,
            count: shownCount,
            studentCount: students === "" ? null : Number(students),
            letters: style === "letter",
          },
        })
        .json();
      const skipped = shownCount - created.length;
      notify?.({
        type: "success",
        message: `Đã thêm ${created.length} lớp${skipped ? `, bỏ qua ${skipped} lớp đã có` : ""}`,
      });
      invalidate({ resource: "school_classes", invalidates: ["list"] });
      setOpen(false);
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {controlled ? null : linkStyle ? (
        <button type="button" onClick={() => setOpen(true)} className="text-primary text-xs font-medium hover:underline">
          {label} →
        </button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <ListPlus />
          {label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Thêm nhanh lớp học</DialogTitle>
            <DialogDescription>
              Chọn khối, kiểu tên và số lớp. Tên lớp tự đặt theo khối, tiếp theo các lớp đã có.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {onlySchool ? null : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Trường <span className="text-destructive">*</span></Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn trường" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {schoolRows.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Khối lớp <span className="text-destructive">*</span></Label>
              <Select
                value={gradeId}
                onValueChange={(v) => {
                  setGradeId(v);
                  setStartTouched(false);
                  setPrefix(prefixOf((grades?.data ?? []).find((g: any) => String(g.id) === v), style));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn khối" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {(grades?.data ?? []).map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Năm học <span className="text-destructive">*</span></Label>
              <Select value={yearId} onValueChange={setYearId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn năm học" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {years.map((y: any) => <SelectItem key={y.id} value={String(y.id)}>{y.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kiểu tên lớp</Label>
              <Select
                value={style}
                onValueChange={(v) => {
                  const next = v as NameStyle;
                  setStyle(next);
                  setStartTouched(false);
                  setPrefix(prefixOf((grades?.data ?? []).find((g: any) => String(g.id) === gradeId), next));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Theo số: 6A1, 6A2, 6A3…</SelectItem>
                  <SelectItem value="letter">Theo chữ: 6A, 6B, 6C…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số lớp</Label>
              <Select value={String(shownCount)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {/* Theo chữ thì dừng ở Z — số lớp không vượt quá phần chữ còn lại. */}
                  {Array.from({ length: Math.min(maxCount, 30) }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} lớp</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Không hỏi tiền tố: tên lớp luôn ghép từ số khối (6A1… / 6A, 6B…) — trường phổ thông
                không có khối nào cần đặt tên khác. */}
            <div className="space-y-1.5">
              <Label>{style === "letter" ? "Bắt đầu từ chữ" : "Bắt đầu từ số"}</Label>
              <Stepper
                value={start}
                min={style === "letter" ? 1 : 0}
                max={style === "letter" ? 26 : 999}
                format={style === "letter" ? (v) => suffixOf(v, "letter") : undefined}
                onChange={(v) => { setStartTouched(true); setStart(v); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sĩ số mỗi lớp</Label>
              <Input type="number" min={0} max={200} value={students} onChange={(e) => setStudents(e.target.value)} placeholder="Không bắt buộc"
                aria-invalid={studentsError ? true : undefined} />
              {studentsError ? <p className="text-destructive text-sm">{studentsError}</p> : null}
            </div>
          </div>
          <div className="bg-surface-subtle space-y-2 rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">
              {names.length
                ? fresh.length === names.length
                  ? `Sẽ tạo ${fresh.length} lớp`
                  : fresh.length === 0
                    ? names.length === 1
                      ? "Lớp này đã có"
                      : `Cả ${names.length} lớp đã có`
                    : `Sẽ tạo ${fresh.length} lớp · ${names.length - fresh.length} lớp đã có`
                : "Chọn khối để xem trước tên lớp."}
            </p>
            {names.length ? (
              <div className="flex flex-wrap gap-1.5">
                {names.map((n) => {
                  const had = existing.has(n.toUpperCase());
                  return (
                    <span
                      key={n}
                      title={had ? "Đã có" : undefined}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-medium",
                        had ? "text-muted-foreground line-through" : "bg-card",
                      )}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="button" disabled={busy || !!studentsError || !gradeId || !yearId || !prefix || !schoolId || fresh.length === 0} onClick={() => void submit()}>
              {busy ? "Đang thêm…" : prefix ? `Thêm ${fresh.length} lớp` : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const SCHOOL_CLASS_EXTRA = {
  // Lớp chỉ có một ô "cơ bản" (tên lớp): các ô còn lại đứng liền trong khối đó, không tách thêm một nhóm.
  section: { title: "Thông tin lớp học", inline: true },
  defaults: {
    school: { id: null },
    grade: { id: null },
    schoolYear: { id: null },
    homeroomTeacher: { id: null },
    room: { id: null },
    studentCount: null,
  },
  Fields: ClassFields,
  FormBody: ClassFormBody,
  dialogSize: "form" as const,
  dialogHeader: true,
  filters: [
    { field: "grade.id", label: "Khối lớp", type: "reference" as const, referenceResource: "grades" },
  ],
  // Danh sách lớp là lớp của năm học đang làm việc (header) — không có ô lọc năm riêng.
  yearField: "schoolYear.id",
  ListActions: () => <QuickAddClasses />,
  columns: [
    refCell("grade", "Khối"),
    {
      id: "schoolYear",
      header: "Năm học",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.schoolYear?.code ?? "—"}</span>,
    },
    refCell("homeroomTeacher", "GV chủ nhiệm"),
    {
      id: "studentCount",
      header: "Sĩ số",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount ?? "—"}</span>,
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  // Cùng thứ tự với form (ClassFields): xem rồi bấm Sửa thì ô nằm nguyên chỗ. Không có Trường —
  // form cũng không có, lớp luôn mở từ màn của một trường (danh sách lớp có cột Trường).
  show: (r: any) => [
    { label: "Khối lớp", value: r?.grade?.name ?? "—" },
    { label: "Năm học", value: r?.schoolYear?.name ?? "—" },
    { label: "Sĩ số", value: r?.studentCount ?? "—" },
    { label: "Giáo viên chủ nhiệm", value: r?.homeroomTeacher?.name ?? "—" },
    { label: "Phòng học", value: r?.room?.name ?? "—" },
  ],
};
