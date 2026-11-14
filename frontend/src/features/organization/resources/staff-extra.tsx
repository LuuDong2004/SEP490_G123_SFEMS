import { FormHint } from "@/shared/components/form/help-hint";
import { useCan, useList } from "@refinedev/core";
import { BookOpen, BriefcaseBusiness, Hash, History, Lock, Mail, Phone, UserRound } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState, type ReactNode } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { cn } from "@/shared/lib/utils";
import { CatalogCodeField } from "@/shared/components/catalog/fields";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { NavSectionBox, NeedBox, SectionFormNav } from "@/features/organization/resources/section-nav";
import { StaffHistory } from "@/features/organization/resources/staff-history";
import { StaffAvatar } from "@/features/organization/resources/staff-avatar";
import { RefField } from "@/shared/components/catalog/ref-field";
import { MultiRefPickerField } from "@/shared/components/catalog/multi-ref-picker";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";
import { inputModeOf, maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { STAFF_TYPE_LABELS, POSITION_LABELS, LEADERSHIP_POSITIONS, assignablePositions } from "@/domains/staff/types";

/* eslint-disable @typescript-eslint/no-explicit-any */



const NONE = "__none__";
function EnumSelect({
  control,
  name,
  label,
  hint,
  options,
  required,
  disabled,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  options: Record<string, string>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={required ? { required: `Chọn ${label.toLowerCase()}` } : undefined}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
          </FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <Select
            disabled={disabled}
            onValueChange={(v) => {
              // Radix bắn `""` lúc màn sửa nạp bản ghi — bỏ qua, nếu không giá trị bị xoá và lưu ra 400.
              if (v === "") return;
              field.onChange(v === NONE ? null : v);
            }}
            value={field.value ?? ""}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Vui lòng chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextField({
  control,
  name,
  label,
  hint,
  placeholder,
  rules,
  rule,
  max,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  placeholder?: string;
  rules?: any;
  /** Kiểu chữ chuẩn — cùng trần, cùng câu báo lỗi với máy chủ. */
  rule: TextRule;
  /** Trần riêng, nhỏ hơn trần của kiểu (email cán bộ: 100). */
  max?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(textRules(rule, label, { max }), rules)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder={placeholder}
              maxLength={maxLengthOf(rule, max)} inputMode={inputModeOf(rule)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function StaffFields({ control, record }: { control: Control<any>; record?: any }) {
  useSchoolNextCode("staff", control, record);
  // Phòng ban / bộ phận là của cán bộ; giáo viên thuộc tổ bộ môn (tab Tổ bộ môn), không gõ ở đây.
  const staffType = useWatch({ control, name: "staffType" });
  const position = useWatch({ control, name: "position" });
  const { setValue } = useFormContext();
  const isTeacher = staffType === "teacher";
  // Chức vụ lãnh đạo chỉ người có quyền bổ nhiệm mới được đổi theo cả hai chiều.
  // Giữ chức vụ hiện tại trong danh sách khi sửa hồ sơ, kể cả lúc đổi Loại.
  const mayAssignLeadership = useCan({ resource: "staff", action: "assign_leadership" }).data?.can ?? false;
  const currentIsLeadership = LEADERSHIP_POSITIONS.has(record?.position);
  const lockedLeadership = currentIsLeadership && !mayAssignLeadership;
  const keep = currentIsLeadership || staffType === record?.staffType ? record?.position : null;
  const positions = assignablePositions(mayAssignLeadership, staffType, keep);
  // Đổi Loại làm chức vụ đang chọn không còn hợp lệ thì xoá về trống.
  useEffect(() => {
    if (position && !(position in positions)) setValue("position", null, { shouldDirty: true });
  }, [position, positions, setValue]);
  // Môn dạy là của giáo viên. Người dùng đổi sang Cán bộ thì bỏ môn đã chọn — hai ô đã ẩn, để lại
  // thì vẫn gửi đi. Hồ sơ cũ mang sẵn môn mà Loại chưa đổi thì để yên.
  const changedToStaff = !isTeacher && staffType !== record?.staffType;
  useEffect(() => {
    if (!changedToStaff) return;
    setValue("mainSubject", { id: null }, { shouldDirty: true });
    setValue("subjects", [], { shouldDirty: true });
  }, [changedToStaff, setValue]);
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      {/* Lưới chuẩn 4 cột: mỗi ô một cột, không ô nào tự kéo giãn hết bề ngang thẻ. */}
      <div className="form-flow">
        <EnumSelect control={control} name="staffType" label="Loại" hint="Giáo viên thì có môn dạy, cán bộ thì không." options={STAFF_TYPE_LABELS} required />
        <EnumSelect
          control={control}
          name="position"
          label="Chức vụ"
          hint={lockedLeadership
            ? "Chỉ người có quyền quản lý chức vụ lãnh đạo mới thay đổi được chức vụ này. Các thông tin khác vẫn sửa được."
            : "Chỉ người có quyền quản lý chức vụ lãnh đạo mới chọn được Hiệu trưởng, Phó hiệu trưởng."}
          options={positions}
          disabled={lockedLeadership}
        />
        {isTeacher || !staffType ? null : (
          <TextField control={control} name="department" label="Phòng ban / bộ phận" placeholder="Tổ Văn phòng" rule="SHORT_TEXT" />
        )}
        <TextField
          control={control}
          name="phone"
          label="Số điện thoại"
          rule="PHONE"
        />
        <TextField
          control={control}
          name="email"
          label="Email"
          rule="EMAIL"
        />
        {isTeacher ? (
          <RefField
            control={control}
            name="mainSubject"
            resource="subjects"
            label="Môn chính" hint="Môn dạy chính. Dùng để tính định mức theo giáo viên."
            current={record?.mainSubject}
          />
        ) : null}
      </div>
      {isTeacher ? (
        <>
          <MultiRefPickerField
            control={control}
            name="subjects"
            resource="subjects"
            label="Môn giảng dạy" hint="Các môn khác người này cũng dạy."
            unitLabel="môn"
          />
        </>
      ) : null}
    </>
  );
}

/** Ô bắt buộc còn trống của form cán bộ — theo phần, cho cột mục và chân hộp. */
function useStaffMissing(control: Control<any>) {
  const [name, staffType, position, mainSubject] = useWatch({ control, name: ["name", "staffType", "position", "mainSubject"] });
  const blank = (v: unknown) => v == null || v === "" || (typeof v === "object" && (v as { id?: unknown }).id == null);
  return {
    info: [blank(name) && "Họ tên"].filter(Boolean) as string[],
    work: [blank(staffType) && "Loại", blank(position) && "Chức vụ"].filter(Boolean) as string[],
    teach: [staffType === "teacher" && blank(mainSubject) && "Môn chính"].filter(Boolean) as string[],
    contact: [] as string[],
  };
}

/**
 * Họ tên 2–50 ký tự (trưởng nhóm chốt 12/11/2026). Trùng họ tên với người khác cùng trường thì nhắc ngay dưới ô —
 * vẫn cho lưu (có thể trùng tên thật), nhưng hay là một người bị tách thành nhiều hồ sơ theo môn.
 */
function StaffNameField({ control, record }: { control: Control<any>; record?: any }) {
  const [name, formSchool] = useWatch({ control, name: ["name", "school.id"] });
  const schoolId = record?.school?.id ?? formSchool;
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTyped(String(name ?? "").trim().replace(/\s+/g, " ")), 400);
    return () => clearTimeout(t);
  }, [name]);
  const { result } = useList<any>({
    resource: "staff",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }, { field: "q", operator: "contains", value: typed }],
    pagination: { pageSize: 20 },
    queryOptions: { enabled: !!schoolId && typed.length >= 2 },
  });
  const same = (result?.data ?? []).filter((s: any) => s.id !== record?.id
    && String(s.name ?? "").trim().toLowerCase() === typed.toLowerCase());
  return (
    <FormField control={control} name="name"
      rules={mergeRules(textRules("PERSON_NAME", "Họ tên", { required: true, max: 50 }), {
        validate: { min: (v: unknown) => String(v ?? "").trim().length === 0 || String(v).trim().length >= 2 || "Họ tên tối thiểu 2 ký tự" },
      })}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Họ tên</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder="Nguyễn Văn A" maxLength={50} />
          </FormControl>
          <FormMessage />
          {same.length ? (
            <p className="text-warning-text text-xs">
              Trường đã có {same.length} người cùng tên ({same.map((s: any) => s.code).join(", ")}) — kiểm tra có phải cùng một người không.
            </p>
          ) : null}
        </FormItem>
      )} />
  );
}

/** Mã khoá sau khi tạo (trưởng nhóm 12/11/2026, như mã phòng): ô chỉ xem có ổ khoá; giá trị cũ vẫn gửi đi khi Lưu. */
function StaffCodeField({ control, record, config }: { control: Control<any>; record?: any; config: CatalogConfig }) {
  if (!record?.id) return <CatalogCodeField control={control} config={config} fill />;
  return (
    <FormField control={control} name="code" render={({ field }) => (
      <FormItem className="min-w-0" title="Không sửa sau khi tạo">
        <FormLabel required={false} className="text-muted-foreground">
          {config.codeLabel ?? "Mã"}
          <Lock className="size-3 opacity-70" />
        </FormLabel>
        <FormControl>
          <Input value={field.value ?? ""} readOnly tabIndex={-1} className="bg-muted/50 cursor-default font-mono" />
        </FormControl>
      </FormItem>
    )} />
  );
}

/**
 * Hộp Thêm / Sửa cán bộ, giáo viên — mockup D1 (trưởng nhóm 12/11/2026): đầu hộp có ảnh đại diện (`StaffFormHeading`),
 * cột mục bên trái Thông tin chung · Công tác · Giảng dạy (chỉ giáo viên) · Liên hệ. Ngoài hộp thoại (trang sửa) các
 * phần xếp dọc, không có cột mục.
 */
function StaffFormBody({ control, record, config, inDialog }: { control: any; record?: any; config: CatalogConfig; inDialog?: boolean }) {
  useSchoolNextCode("staff", control, record);
  const staffType = useWatch({ control, name: "staffType" });
  const position = useWatch({ control, name: "position" });
  const { setValue } = useFormContext();
  const isTeacher = staffType === "teacher";
  const mayAssignLeadership = useCan({ resource: "staff", action: "assign_leadership" }).data?.can ?? false;
  const currentIsLeadership = LEADERSHIP_POSITIONS.has(record?.position);
  const lockedLeadership = currentIsLeadership && !mayAssignLeadership;
  const keep = currentIsLeadership || staffType === record?.staffType ? record?.position : null;
  const positions = assignablePositions(mayAssignLeadership, staffType, keep);
  useEffect(() => {
    if (position && !(position in positions)) setValue("position", null, { shouldDirty: true });
  }, [position, positions, setValue]);
  const changedToStaff = !isTeacher && staffType !== record?.staffType;
  useEffect(() => {
    if (!changedToStaff) return;
    setValue("mainSubject", { id: null }, { shouldDirty: true });
    setValue("subjects", [], { shouldDirty: true });
  }, [changedToStaff, setValue]);

  const missing = useStaffMissing(control);
  const need = (part: keyof typeof missing, label: string) => !!inDialog && missing[part].includes(label);
  const sections = [
    { key: "info", title: "Thông tin chung", icon: UserRound, missing: missing.info },
    { key: "work", title: "Công tác", icon: BriefcaseBusiness, missing: missing.work },
    ...(isTeacher ? [{ key: "teach", title: "Giảng dạy", icon: BookOpen, missing: missing.teach }] : []),
    { key: "contact", title: "Liên hệ", icon: Mail, missing: missing.contact },
  ];
  const body = (
    <>
      <NavSectionBox k="info" title="Thông tin chung">
        <div className="empty:hidden sm:col-span-2">
          <SchoolField control={control} record={record} hideWhenFixed />
        </div>
        <StaffCodeField control={control} record={record} config={config} />
        <NeedBox on={need("info", "Họ tên")}><StaffNameField control={control} record={record} /></NeedBox>
      </NavSectionBox>
      <NavSectionBox k="work" title="Công tác">
        <NeedBox on={need("work", "Loại")}>
          <EnumSelect control={control} name="staffType" label="Loại" hint="Giáo viên thì có môn dạy, cán bộ thì không." options={STAFF_TYPE_LABELS} required />
        </NeedBox>
        <NeedBox on={need("work", "Chức vụ")}>
          <EnumSelect control={control} name="position" label="Chức vụ" required
            hint={lockedLeadership
              ? "Chỉ người có quyền quản lý chức vụ lãnh đạo mới thay đổi được chức vụ này. Các thông tin khác vẫn sửa được."
              : "Mỗi trường một Hiệu trưởng. Chỉ người có quyền quản lý chức vụ lãnh đạo mới chọn được Hiệu trưởng, Phó hiệu trưởng."}
            options={positions} disabled={lockedLeadership} />
        </NeedBox>
        {isTeacher || !staffType ? null : (
          <TextField control={control} name="department" label="Phòng ban / bộ phận" placeholder="Tổ Văn phòng" rule="SHORT_TEXT" />
        )}
      </NavSectionBox>
      {isTeacher ? (
        <NavSectionBox k="teach" title="Giảng dạy">
          <NeedBox on={need("teach", "Môn chính")}>
            <RefField control={control} name="mainSubject" resource="subjects" required
              label="Môn chính" hint="Môn dạy chính. Dùng để tính định mức theo giáo viên."
              current={record?.mainSubject} />
          </NeedBox>
          <div className="min-w-0 sm:col-span-2">
            <MultiRefPickerField control={control} name="subjects" resource="subjects"
              label="Môn giảng dạy khác" hint="Các môn khác người này cũng dạy." unitLabel="môn" />
          </div>
        </NavSectionBox>
      ) : null}
      <NavSectionBox k="contact" title="Liên hệ">
        <TextField control={control} name="phone" label="Số điện thoại" rule="PHONE"
          placeholder="0912 345 678"
          hint="Bắt đầu bằng 0 hoặc +84, 10–11 số (dấu cách, chấm, gạch được bỏ qua). Không trùng với cán bộ khác của trường." />
        <TextField control={control} name="email" label="Email" rule="EMAIL"
          placeholder="ten@truong.edu.vn"
          hint="Dạng ten@tenmien.vn, tối đa 254 ký tự, phần trước @ tối đa 64. Không trùng với cán bộ khác của trường." />
      </NavSectionBox>
    </>
  );
  return inDialog ? <SectionFormNav control={control} sections={sections}>{body}</SectionFormNav> : <div className="space-y-3">{body}</div>;
}

/** Đầu hộp Thêm / Sửa cán bộ (D1, không ảnh bìa): ảnh đại diện (chữ viết tắt tên) + họ tên + loại + mã · chức vụ. */
function StaffFormHeading({ record, creating, viewing }: { record?: any; creating: boolean; viewing?: boolean }) {
  const teacher = record?.staffType === "teacher";
  // Hàng thông tin nhanh dưới tên, trải hết bề ngang đầu hộp (trưởng nhóm 12/11/2026: đầu hộp chiếm nhiều chỗ hơn).
  const facts = creating || !record ? [] : [
    { icon: Hash, text: record.code },
    { icon: BriefcaseBusiness, text: POSITION_LABELS[record.position] },
    { icon: BookOpen, text: teacher ? record.mainSubject?.name : record.department },
    { icon: Phone, text: record.phone },
    { icon: Mail, text: record.email },
  ].filter((f) => f.text);
  return (
    <div className="flex min-w-0 items-center gap-5 py-1 text-start">
      {/* Ảnh đại diện to, tải / đổi / gỡ ngay tại đây (trưởng nhóm 13/11/2026). Thêm mới: lưu xong mới gắn ảnh được. */}
      <StaffAvatar recordId={creating ? undefined : record?.id} name={creating ? null : record?.name} />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-2xl leading-tight font-semibold tracking-tight">
            {creating ? "Thêm cán bộ, giáo viên" : record?.name ?? "…"}
          </span>
          {!creating && record?.staffType ? (
            <Badge variant={teacher ? "info" : "neutral"}>{STAFF_TYPE_LABELS[record.staffType] ?? record.staffType}</Badge>
          ) : null}
          {!creating && !viewing ? <Badge variant="warning">Đang sửa</Badge> : null}
        </div>
        {creating ? (
          <div className="text-muted-foreground text-sm font-normal">Mã cấp tự động theo quy tắc mã của trường</div>
        ) : (
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm font-normal">
            {facts.map((f, i) => (
              <span key={i} className="inline-flex min-w-0 items-center gap-1.5">
                <f.icon className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{f.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Một ô chỉ đọc của hộp xem: nhãn + giá trị; trống thì chữ mờ nghiêng (ô bắt buộc trống: "Chưa khai" màu cam). */
function ViewCell({ label, value, required, blank = "Chưa có", wide }: {
  label: string;
  value?: ReactNode;
  required?: boolean;
  blank?: string;
  wide?: boolean;
}) {
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div className={cn("min-w-0 space-y-1", wide && "sm:col-span-2")}>
      <div className="text-muted-foreground text-xs font-medium">{label}:</div>
      <div className={cn("min-h-6 text-sm break-words",
        empty && (required ? "text-warning-text" : "text-muted-foreground/80 italic"))}>
        {empty ? (required ? "Chưa khai" : blank) : value}
      </div>
    </div>
  );
}

/**
 * Hộp XEM cán bộ, giáo viên — cùng kiểu hộp Sửa (D1, trưởng nhóm 12/11/2026): đầu hộp ảnh đại diện (`ShowHeading`),
 * cột mục bên trái, các phần chỉ đọc. Bấm Sửa thì hộp không đổi cỡ, không đổi bố cục.
 */
function StaffView({ record }: { record: any }) {
  const teacher = record?.staffType === "teacher";
  const sections = [
    { key: "info", title: "Thông tin chung", icon: UserRound },
    { key: "work", title: "Công tác", icon: BriefcaseBusiness },
    ...(teacher ? [{ key: "teach", title: "Giảng dạy", icon: BookOpen }] : []),
    { key: "contact", title: "Liên hệ", icon: Mail },
  ];
  const others = (record?.subjects ?? []).filter((s: any) => s.id !== record?.mainSubject?.id).map((s: any) => s.name);
  return (
    // Lịch sử là trang RIÊNG dưới đường kẻ (trưởng nhóm 13/11/2026), không cuộn chung với các phần hồ sơ.
    <SectionFormNav sections={sections} pages={record?.id ? [{
      key: "history", title: "Lịch sử", icon: History,
      content: <StaffHistory recordId={record.id} createdAt={record.createdAt} />,
    }] : undefined}>
      <NavSectionBox k="info" title="Thông tin chung">
        <ViewCell label="Mã" value={<span className="font-mono">{record?.code}</span>} />
        <ViewCell label="Họ tên" value={record?.name} required />
      </NavSectionBox>
      <NavSectionBox k="work" title="Công tác">
        <ViewCell label="Loại" value={STAFF_TYPE_LABELS[record?.staffType]} required />
        <ViewCell label="Chức vụ" value={POSITION_LABELS[record?.position]} required />
        {teacher ? null : <ViewCell label="Phòng ban / bộ phận" value={record?.department} blank="Chưa ghi phòng ban" />}
      </NavSectionBox>
      {teacher ? (
        <NavSectionBox k="teach" title="Giảng dạy">
          <ViewCell label="Môn chính" value={record?.mainSubject?.name} required />
          <ViewCell label="Môn giảng dạy khác" value={others.length ? others.join(", ") : null} blank="Không dạy môn khác" />
        </NavSectionBox>
      ) : null}
      <NavSectionBox k="contact" title="Liên hệ">
        <ViewCell label="Số điện thoại" value={record?.phone} blank="Chưa ghi số điện thoại" />
        <ViewCell label="Email" value={record?.email} blank="Chưa ghi email" />
      </NavSectionBox>
    </SectionFormNav>
  );
}

/** Đầu hộp XEM: cùng đầu hộp Sửa, bỏ chữ "Đang sửa". */
function StaffShowHeading({ record }: { record?: any }) {
  return <StaffFormHeading record={record} creating={false} viewing />;
}

/** Chân hộp: còn bao nhiêu ô bắt buộc chưa điền (cùng đếm với cột mục). */
function StaffFormFooterNote({ control }: { control: any }) {
  const m = useStaffMissing(control);
  const n = m.info.length + m.work.length + m.teach.length;
  return n ? <span className="text-warning-text text-sm">Còn {n} ô bắt buộc chưa điền</span> : null;
}

export const STAFF_EXTRA = {
  FormBody: StaffFormBody,
  FormHeading: StaffFormHeading,
  ShowHeading: StaffShowHeading,
  ShowBody: StaffView,
  FormFooterNote: StaffFormFooterNote,
  dialogSize: "formFit" as const,
  section: { title: "Thông tin công tác" },
  defaults: {
    school: { id: null },
    // Không chọn sẵn Loại: thêm từ danh sách "Tất cả" thì người nhập chọn Giáo viên hay Cán bộ trước,
    // thay vì form mở sẵn dạng giáo viên (QLTB-399). Thêm từ chế độ xem Cán bộ / Giáo viên thì điền theo nó.
    staffType: null,
    position: null,
    department: "",
    phone: "",
    email: "",
    mainSubject: { id: null },
    subjects: [],
  },
  Fields: StaffFields,
  columns: [
    {
      id: "staffType",
      header: "Loại",
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={row.original.staffType === "teacher" ? "info" : "neutral"}>
          {STAFF_TYPE_LABELS[row.original.staffType] ?? row.original.staffType}
        </Badge>
      ),
    },
    {
      id: "position",
      header: "Chức vụ",
      enableSorting: false,
      cell: ({ row }) => POSITION_LABELS[row.original.position] ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "mainSubject",
      header: "Môn chính",
      enableSorting: false,
      cell: ({ row }) => row.original.mainSubject?.name ?? <span className="text-muted-foreground">—</span>,
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Loại", value: STAFF_TYPE_LABELS[r?.staffType] ?? "—" },
    { label: "Chức vụ", value: POSITION_LABELS[r?.position] ?? "—" },
    { label: "Phòng ban / bộ phận", value: r?.department ?? "—" },
    { label: "Số điện thoại", value: r?.phone ?? "—" },
    { label: "Email", value: r?.email ?? "—" },
    // Môn dạy chỉ có nghĩa với giáo viên — hồ sơ cán bộ không hiện hai dòng "—" này (QLTB-416).
    ...(r?.staffType === "teacher"
      ? [
          { label: "Môn chính", value: r?.mainSubject?.name ?? "—" },
          {
            label: "Môn giảng dạy",
            value: (r?.subjects ?? []).length === 0 ? "—" : r.subjects.map((s: any) => s.name).join(", "),
          },
        ]
      : []),
  ],
};
