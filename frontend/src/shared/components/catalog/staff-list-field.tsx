import { lowerLabel } from "@/shared/lib/label";
import { useList } from "@refinedev/core";
import { ChevronRight, Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import type { Control } from "react-hook-form";

import { POSITION_LABELS } from "@/domains/staff/types";
import { StaffPicker, type StaffPrefer, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormHint } from "@/shared/components/form/help-hint";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Một người trên một dòng: "Họ tên — Chức vụ". Chữ cũ gõ tay (ngăn bằng dấu chấm phẩy) cũng tách được. */
const parse = (text: unknown): string[] =>
  String(text ?? "").split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);

const lineOf = (r: StaffRow) => {
  const position = r.position ? (POSITION_LABELS[r.position] ?? r.position) : null;
  return position ? `${r.name} — ${position}` : r.name;
};

/**
 * Ô chọn NHIỀU cán bộ của trường (tổ kiểm kê, hội đồng…) từ danh sách nhân sự trong hệ thống — không gõ tay
 * họ tên. Hiện dạng DANH SÁCH thành viên (số thứ tự · họ tên · chức vụ · bỏ), nút "Chọn người" mở hộp chọn cán bộ
 * dùng chung ở chế độ chọn nhiều — tích một lượt cả tổ (trưởng nhóm 27/11/2026).
 *
 * <p>Giá trị của ô vẫn là CHỮ, mỗi người một dòng "Họ tên — Chức vụ": cột lưu là một ô chữ và bản in đọc
 * thẳng nó, nên thành phần ghi trên biên bản không đổi khi về sau cán bộ đổi chức vụ hay nghỉ việc.
 */
export function StaffListField({ control, name, label, schoolId, hint, prefer, className, required, mustFill }: {
  control: Control<any>;
  name: string;
  label: string;
  /** Trường của phiếu — chưa có thì ô khoá, nhắc chọn trường trước. */
  schoolId?: number | null;
  hint?: string;
  prefer?: StaffPrefer;
  /** Mặc định MỘT cột như mọi ô chọn; thêm người thì ô cao lên, mỗi người một dòng — không trải ngang hai cột. */
  className?: string;
  /** Hiện dấu * — ô phải có người khi TRÌNH phiếu (máy chủ kiểm), lưu nháp vẫn được để trống. */
  required?: boolean;
  /** Câu báo khi để trống — có thì ô bắt buộc ngay lúc LƯU, không chỉ lúc trình. */
  mustFill?: string;
}) {
  const { result, query } = useList<StaffRow>({
    resource: "staff",
    filters: schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }, { field: "active", operator: "eq", value: true }] : [],
    pagination: { pageSize: 500 },
    queryOptions: { enabled: !!schoolId },
  });
  const rows = result?.data ?? [];
  // Danh sách thu gọn mặc định: một dòng tóm tắt (số người · vài tên), bấm mũi tên mới mở; thêm người xong tự đóng lại.
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      rules={mustFill ? { validate: (v: string | null | undefined) => parse(v).length > 0 || mustFill } : undefined}
      render={({ field }) => {
        const people = parse(field.value);
        const write = (list: string[]) => field.onChange(list.join("\n"));
        // Người đã có trong danh sách không hiện lại trong hộp chọn.
        const left = rows.filter((r) => !people.includes(lineOf(r)));
        return (
          // `min-w-0`: trong lưới, ô chọn này mặc định rộng theo nội dung — chữ "Vui lòng chọn …" dài
          // đẩy nó tràn đè lên ô bên cạnh thay vì cắt bớt.
          <FormItem className={cn("min-w-0", className)}>
            <FormLabel required={required || undefined}>{label}</FormLabel>
            {hint ? <FormHint>{hint}</FormHint> : null}
            <div className="border-primary/25 bg-card min-w-0 overflow-hidden rounded-2xl border">
              <div className="bg-primary/5 flex items-center gap-2 py-1.5 ps-2 pe-2">
                <button type="button" disabled={people.length === 0} aria-expanded={open}
                  onClick={() => setOpen((o) => !o)}
                  className="hover:bg-primary/10 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-start text-sm disabled:cursor-default disabled:hover:bg-transparent">
                  <ChevronRight className={cn("text-primary size-4 shrink-0 transition-transform", open && "rotate-90", people.length === 0 && "opacity-0")} />
                  {!schoolId ? (
                    <span className="text-muted-foreground">Chọn trường trước</span>
                  ) : people.length ? (
                    <>
                      <span className="text-primary shrink-0 font-semibold tabular-nums">{people.length} người</span>
                      {/* Đóng: vài tên đầu cho biết tổ gồm ai mà không phải mở. */}
                      {!open ? (
                        <span className="text-muted-foreground min-w-0 truncate">
                          · {people.map((p) => p.split(" — ")[0]).join(", ")}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Chưa có ai trong {lowerLabel(label)}</span>
                  )}
                </button>
                <StaffPicker
                  rows={left}
                  loading={query?.isLoading && !!schoolId}
                  value={null}
                  label={`người vào ${label.toLowerCase()}`}
                  prefer={prefer}
                  onChange={(row) => { if (row) { write([...people, lineOf(row)]); setOpen(false); } }}
                  onPickMany={(picked) => { write([...people, ...picked.map(lineOf)]); setOpen(false); }}
                  trigger={(openPicker) => (
                    <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!schoolId} onClick={openPicker}>
                      {people.length ? <Plus /> : <UserPlus />}
                      {people.length ? "Thêm người" : "Chọn người"}
                    </Button>
                  )}
                />
              </div>
              {open && people.length ? (
                <ol className="divide-y border-t">
                  {people.map((p, i) => {
                    const [who, role] = p.split(" — ");
                    return (
                      <li key={`${p}-${i}`} className="flex min-w-0 items-center gap-3 px-3 py-1.5 text-sm">
                        <span className="text-muted-foreground w-5 shrink-0 text-end text-xs tabular-nums">{i + 1}</span>
                        <span className="min-w-0 truncate font-medium" title={who}>{who}</span>
                        {role ? <Badge variant="info" className="shrink-0">{role}</Badge> : null}
                        <button type="button" aria-label={`Bỏ ${who}`} title={`Bỏ ${who}`}
                          className="text-muted-foreground hover:text-destructive-text ms-auto shrink-0 rounded-sm p-1"
                          onClick={() => write(people.filter((_, at) => at !== i))}>
                          <X className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
