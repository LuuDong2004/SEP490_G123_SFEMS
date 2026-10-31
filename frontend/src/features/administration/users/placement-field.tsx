import { Landmark, School, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import type { ManagingBodySummary, SchoolSummary } from "@/domains/user/types";

import { ManagingBodyPicker, type ManagingBodyRef } from "./managing-body-picker";
import { SchoolPicker, type SchoolRef } from "./school-picker";

export type PlacementMode = "school" | "body" | "none";
type Mode = PlacementMode;

/** Chỗ làm việc đã chọn mà thiếu trường / cơ quan thì trả câu báo lỗi; đủ thì `null`. */
export function placementProblem(mode: PlacementMode, school?: { id: number | null } | null, body?: { id: number | null } | null) {
  if (mode === "school" && !school?.id) return "Chọn trường công tác";
  if (mode === "body" && !body?.id) return "Chọn cơ quan quản lý";
  return null;
}

const MODES: { value: Mode; title: string; hint: string; icon: ReactNode }[] = [
  { value: "school", title: "Trường", hint: "Hiệu trưởng, cán bộ, giáo viên", icon: <School /> },
  { value: "body", title: "Sở / UBND", hint: "Lãnh đạo, chuyên viên cơ quan quản lý", icon: <Landmark /> },
  { value: "none", title: "Không thuộc đơn vị", hint: "Quản trị viên hệ thống", icon: <ShieldCheck /> },
];

/**
 * Nơi công tác của tài khoản: chọn LÀM VIỆC TẠI đâu trước (trường · Sở / UBND · không thuộc đơn vị), rồi chỉ hiện
 * MỘT ô chọn tương ứng — hai ô đứng cạnh nhau mà chỉ được điền một thì người cấp tài khoản phải tự đoán. Đổi chỗ
 * làm việc là xoá giá trị của ô kia.
 */
export function PlacementField({ school, managingBody, onSchoolChange, onManagingBodyChange, currentSchool, currentManagingBody, onModeChange, error, emptyRecord }: {
  school: SchoolRef | null | undefined;
  managingBody: ManagingBodyRef | null | undefined;
  onSchoolChange: (value: SchoolRef) => void;
  onManagingBodyChange: (value: ManagingBodyRef) => void;
  currentSchool?: SchoolSummary | null;
  currentManagingBody?: ManagingBodySummary | null;
  /** Báo chỗ làm việc đang chọn để form kiểm lúc lưu (`placementProblem`). */
  onModeChange?: (mode: PlacementMode) => void;
  error?: string | null;
  /** Màn sửa: bản ghi đã nạp và không có trường lẫn cơ quan — mở ở "Không thuộc đơn vị". */
  emptyRecord?: boolean;
}) {
  const derived: Mode = school?.id ? "school" : managingBody?.id ? "body" : "school";
  const [mode, setMode] = useState<Mode>(derived);
  // Form sửa nạp bản ghi SAU lần vẽ đầu: theo giá trị vừa về.
  const hasSchool = !!school?.id;
  const hasBody = !!managingBody?.id;
  useEffect(() => {
    if (hasSchool) setMode("school");
    else if (hasBody) setMode("body");
    else if (emptyRecord) setMode("none");
  }, [hasSchool, hasBody, emptyRecord]);
  useEffect(() => onModeChange?.(mode), [mode, onModeChange]);

  const pick = (m: Mode) => {
    setMode(m);
    if (m !== "school" && school?.id) onSchoolChange({ id: null });
    if (m !== "body" && managingBody?.id) onManagingBodyChange({ id: null });
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Làm việc tại" className="grid gap-2 @xl:grid-cols-3">
        {MODES.map((m) => {
          const on = mode === m.value;
          return (
            <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => pick(m.value)}
              className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                on ? "border-primary/50 bg-primary/[0.05] shadow-e1" : "bg-card hover:bg-accent/40")}>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]",
                on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {m.icon}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", on && "text-primary")}>{m.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === "school" ? (
        <div className="@3xl:max-w-xl">
          <SchoolPicker school={school} onSchoolChange={onSchoolChange} currentSchool={currentSchool} required error={error} />
        </div>
      ) : mode === "body" ? (
        <div className="@3xl:max-w-xl">
          <ManagingBodyPicker managingBody={managingBody} onManagingBodyChange={onManagingBodyChange} currentManagingBody={currentManagingBody} required error={error} />
        </div>
      ) : (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3.5 py-2.5 text-sm">
          Tài khoản không gắn với trường hay cơ quan nào — dùng cho quản trị viên hệ thống.
        </p>
      )}
    </div>
  );
}
