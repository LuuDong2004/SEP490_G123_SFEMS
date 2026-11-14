import { useCan, useInvalidate, useList, useNotification } from "@refinedev/core";
import { ListPlus, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { textError } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { STAFF_TYPE_LABELS, assignablePositions } from "@/domains/staff/types";
import { useSchoolCodeRules } from "@/features/organization/explorer/code-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * "Thêm nhanh" cho khối nhà, cán bộ ở màn của một trường — cùng khuôn với Thêm nhanh lớp
 * học: chọn vài thông số bằng dropdown, xem trước từng mục sẽ tạo (mục đã có trong hệ thống gạch
 * mờ), một nút tạo tất cả. Tạo lần lượt qua đúng endpoint thêm mới của từng loại, nên quyền và
 * kiểm tra y như thêm tay; mã trùng (409) được tính là "đã có" và bỏ qua.
 */

type Item = { code: string; name: string; label?: string; body: Record<string, unknown> };

const letter = (n: number) => String.fromCharCode(64 + n);
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Dropdown chọn số — gọn hơn ô gõ số cho những con số nhỏ (số tầng, số phòng). */
function NumberSelect({ value, onChange, from, to, unit }: {
  value: number;
  onChange: (v: number) => void;
  from: number;
  to: number;
  unit?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-64">
        {range(from, to).map((n) => (
          <SelectItem key={n} value={String(n)}>{unit ? `${n} ${unit}` : n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Danh sách lựa chọn của một resource thuộc trường (cơ sở, khối nhà, loại phòng). */
function useOptions(resource: string, schoolId: number | null, enabled: boolean) {
  const { result } = useList<any>({
    resource,
    filters: schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }] : [],
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled },
  });
  return useMemo(() => result?.data ?? [], [result]);
}

function QuickAddShell({ resource, schoolId, title, description, items, open, onOpenChange, ready, children }: {
  resource: string;
  schoolId: number;
  title: string;
  description: string;
  items: Item[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ready: boolean;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();

  // Mã đã có trong trường — để xem trước nói ngay mục nào sẽ bị bỏ qua.
  const { result: existingResult } = useList<any>({
    resource,
    filters: [{ field: "school.id", operator: "eq", value: schoolId }],
    pagination: { pageSize: 1000 },
    queryOptions: { enabled: open },
  });
  const existing = useMemo(
    () => new Set((existingResult?.data ?? []).map((r: any) => String(r.code).toUpperCase())),
    [existingResult],
  );
  const fresh = items.filter((i) => !existing.has(i.code.toUpperCase()));

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    let created = 0;
    let skipped = items.length - fresh.length;
    try {
      for (const item of fresh) {
        try {
          await kyInstance.post(resource, { json: { ...item.body, school: { id: schoolId } } });
          created += 1;
        } catch (e) {
          if ((e as any)?.response?.status === 409) skipped += 1;
          else throw e;
        }
      }
      notify?.({
        type: "success",
        message: `Đã thêm ${created} mục${skipped ? ` · ${skipped} mục đã có` : ""}`,
      });
      onOpenChange(false);
    } catch (e) {
      setError(`${created ? `Đã thêm ${created} mục, rồi dừng: ` : ""}${await errorMessage(e)}`);
    } finally {
      invalidate({ resource, invalidates: ["list"] });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid items-start gap-4 sm:grid-cols-2">{children}</div>
        <div className="bg-surface-subtle space-y-2 rounded-lg border px-3 py-2.5">
          <p className="text-muted-foreground text-xs">
            {!ready || items.length === 0
              ? "Điền các ô trên để xem trước."
              : fresh.length === items.length
                ? `Sẽ tạo ${fresh.length} mục`
                : fresh.length === 0
                  ? items.length === 1 ? "Mục này đã có" : `Cả ${items.length} mục đã có`
                  : `Sẽ tạo ${fresh.length} mục · ${items.length - fresh.length} mục đã có`}
          </p>
          {ready && items.length ? (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {items.map((i) => {
                const had = existing.has(i.code.toUpperCase());
                return (
                  <span
                    key={i.code}
                    title={had ? "Đã có" : i.code}
                    className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", had ? "text-muted-foreground line-through" : "bg-card")}
                  >
                    {i.label ?? i.name}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" disabled={busy || !ready || fresh.length === 0} onClick={() => void submit()}>
            {busy ? "Đang thêm…" : ready ? `Thêm ${fresh.length} mục` : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ADD_NEW = "__add_new__";

/**
 * Ô chọn cấp cha (cơ sở, khối nhà) có thêm dòng cuối "+ Thêm …": trường chưa có khối nhà thì
 * vẫn đi tiếp được — mở form thêm khối nhà ngay trên hộp thoại này, lưu xong là có trong danh sách.
 */
function ParentSelect({ value, onChange, options, placeholder, emptyText, addLabel, onAdd }: {
  value: string;
  onChange: (v: string) => void;
  options: any[];
  placeholder: string;
  emptyText: string;
  addLabel: string;
  onAdd?: () => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => (v === ADD_NEW ? onAdd?.() : onChange(v))}>
      <SelectTrigger className="w-full"><SelectValue placeholder={options.length ? placeholder : emptyText} /></SelectTrigger>
      <SelectContent>
        {options.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
        {onAdd ? (
          <SelectItem value={ADD_NEW} className="text-primary border-t font-medium">
            <Plus className="text-primary" />
            {addLabel}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}

/** Hộp "Thêm nhanh" mở bằng nút riêng, hoặc do bên gọi điều khiển (mục "Thêm nhanh…" trong nút Thêm mới) — khi đó không vẽ nút. */
type OpenProps = { open?: boolean; onOpenChange?: (open: boolean) => void };
function useOpen({ open, onOpenChange }: OpenProps) {
  const [inner, setInner] = useState(false);
  return [open ?? inner, (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o)), open !== undefined] as const;
}

function OpenButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <ListPlus />
      Thêm nhanh
    </Button>
  );
}

// ---------------------------------------------------------------- khối nhà

/** Khối nhà: Nhà A, Nhà B… (hoặc Nhà 1, Nhà 2…) trong một cơ sở. */
export function QuickAddBuildings({ schoolId, onAddCampus, ...openProps }: { schoolId: number; onAddCampus?: () => void } & OpenProps) {
  const [open, setOpen, controlled] = useOpen(openProps);
  const [style, setStyle] = useState<"letter" | "number">("letter");
  const [count, setCount] = useState(2);
  const [floors, setFloors] = useState(3);
  const [campusId, setCampusId] = useState("");
  const campuses = useOptions("campuses", schoolId, open);
  useEffect(() => {
    if (!campusId && campuses.length === 1) setCampusId(String(campuses[0].id));
  }, [campuses, campusId]);

  // Mã theo quy tắc mã của trường (mặc định "NHA-"): Nhà A → NHA-A, Nhà 1 → NHA-01.
  const { byTarget } = useSchoolCodeRules(schoolId, open);
  const bRule = byTarget.buildings;
  const bPrefix = bRule?.prefix ?? "NHA-";
  const items: Item[] = range(1, count).map((n) => {
    const suffix = style === "letter" ? letter(n) : String(n);
    const code = style === "letter" ? `${bPrefix}${suffix}` : `${bPrefix}${String(n).padStart(bRule?.numberLength ?? 2, "0")}`;
    return {
      code,
      name: `Nhà ${suffix}`,
      body: {
        code,
        name: `Nhà ${suffix}`,
        active: true,
        campus: campusId ? { id: Number(campusId) } : null,
        floorCount: floors,
      },
    };
  });

  return (
    <>
      {controlled ? null : <OpenButton onClick={() => setOpen(true)} />}
      <QuickAddShell
        resource="buildings"
        schoolId={schoolId}
        title="Thêm nhanh khối nhà"
        description="Chọn cơ sở, kiểu tên và số khối nhà. Tên tự đặt là Nhà A, Nhà B…"
        items={items}
        open={open}
        onOpenChange={setOpen}
        ready={!!campusId}
      >
        <Field label="Cơ sở" className="sm:col-span-2">
          <ParentSelect value={campusId} onChange={setCampusId} options={campuses} placeholder="Vui lòng chọn cơ sở"
            emptyText="Trường chưa có cơ sở nào" addLabel="Thêm cơ sở mới" onAdd={onAddCampus} />
        </Field>
        <Field label="Kiểu tên">
          <Select value={style} onValueChange={(v) => setStyle(v as "letter" | "number")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="letter">Theo chữ: Nhà A, Nhà B…</SelectItem>
              <SelectItem value="number">Theo số: Nhà 1, Nhà 2…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Số khối nhà">
          <NumberSelect value={count} onChange={setCount} from={1} to={style === "letter" ? 26 : 30} unit="khối nhà" />
        </Field>
        <Field label="Số tầng mỗi khối">
          <NumberSelect value={floors} onChange={setFloors} from={1} to={30} unit="tầng" />
        </Field>
      </QuickAddShell>
    </>
  );
}

// ---------------------------------------------------------------- cán bộ

/** Cán bộ, giáo viên: dán danh sách họ tên, mỗi dòng một người; mã cấp nối tiếp theo quy tắc mã của trường. */
export function QuickAddStaff({ schoolId, ...openProps }: { schoolId: number } & OpenProps) {
  const [open, setOpen, controlled] = useOpen(openProps);
  const [names, setNames] = useState("");
  const [staffType, setStaffType] = useState("teacher");
  const [position, setPosition] = useState("GIAO_VIEN");
  // Hiệu trưởng / Phó hiệu trưởng chỉ người có quyền quản lý chức vụ lãnh đạo mới đặt được.
  const mayAssignLeadership = useCan({ resource: "staff", action: "assign_leadership" }).data?.can ?? false;
  const positions = assignablePositions(mayAssignLeadership, staffType);
  const { result: existingResult } = useList<any>({
    resource: "staff",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }],
    pagination: { pageSize: 1000 },
    queryOptions: { enabled: open },
  });
  const { byTarget } = useSchoolCodeRules(schoolId, open);
  const sRule = byTarget.staff;
  const prefix = sRule?.prefix ?? "CB";
  const width = sRule?.numberLength ?? 4;
  // Số kế tiếp sau mã lớn nhất cùng tiền tố đang có: đã có GV01–GV06 thì bắt đầu GV07.
  const next = useMemo(() => {
    const re = new RegExp(`^${prefix}(\\d+)$`, "i");
    const taken = (existingResult?.data ?? []).map((s: any) => Number(re.exec(String(s.code))?.[1])).filter(Number.isFinite);
    return Math.max(sRule?.startNumber ?? 1, taken.length ? Math.max(...taken) + 1 : 1);
  }, [existingResult, prefix, sRule?.startNumber]);

  const people = names.split("\n").map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 100);
  // Cùng luật họ tên với hồ sơ cán bộ; số dòng theo đúng dòng trong ô.
  const namesError = names.split("\n").map((n, i) => {
    const e = textError("PERSON_NAME", "Họ tên", n.trim().replace(/\s+/g, " "));
    return e ? `Dòng ${i + 1}: ${e}` : undefined;
  }).find(Boolean);
  const items: Item[] = people.map((name, i) => {
    const code = `${prefix}${String(next + i).padStart(width, "0")}`;
    return { code, name, body: { code, name, active: true, staffType, position: position || null } };
  });

  return (
    <>
      {controlled ? null : <OpenButton onClick={() => setOpen(true)} />}
      <QuickAddShell
        resource="staff"
        schoolId={schoolId}
        title="Thêm nhanh cán bộ, giáo viên"
        description="Dán danh sách họ tên, mỗi dòng một người. Mã cán bộ được cấp tự động."
        items={items}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Đóng hộp (đã thêm xong hoặc huỷ) là xong lượt này: mở lại thì danh sách trống (QLTB-398).
          if (!o) setNames("");
        }}
        ready={people.length > 0 && !namesError}
      >
        <Field label="Loại">
          <Select value={staffType} onValueChange={(v) => { setStaffType(v); setPosition(v === "teacher" ? "GIAO_VIEN" : "NHAN_VIEN"); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STAFF_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Chức vụ">
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {Object.entries(positions).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Họ tên (mỗi dòng một người)" className="sm:col-span-2">
          <Textarea rows={6} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Nguyễn Văn An\nTrần Thị Bình\nLê Minh Châu"} />
          {namesError ? <p className="text-destructive text-sm">{namesError}</p> : null}
        </Field>
      </QuickAddShell>
    </>
  );
}
