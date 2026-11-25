import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { FACILITY_TODO_ACTION_LABELS, type FacilityTodoActionKind, type FacilityTodoItem, type FacilityTodoFilter } from "@/domains/facility/todo";

/** Số dòng hiện sẵn; còn lại mở bằng "Xem thêm". */
const VISIBLE = 6;

const facilityTodoKey = (schoolId: number) => ["facility_todo", schoolId];

/**
 * Giá trị `tab` của màn trường cho từng loại việc. Màn trường đọc nó như liên kết cũ: `classes` / `rooms` / `buildings`
 * mở đúng mục ở cột trái tab Cơ sở vật chất, `info` mở tab Hồ sơ trường (nơi sửa diện tích đất).
 */
const FACILITY_TODO_TAB: Record<FacilityTodoActionKind, string> = {
  classes: "classes",
  rooms: "rooms",
  buildings: "buildings",
  landArea: "info",
};

/** Lớp đã có mà sĩ số lệch: mở danh sách để xem, không phải nhập mới. */
const label = (item: FacilityTodoItem) =>
  item.key === "class_size_outlier" ? "Xem" : FACILITY_TODO_ACTION_LABELS[item.action.kind];

/**
 * Khối "Cần hoàn thiện" đầu tab Đánh giá CSVC: dữ liệu còn thiếu (đỏ) và số đáng ngờ (vàng), mỗi dòng một nút mở đúng
 * chỗ sửa. Không có việc gì thì không vẽ gì.
 */
export function FacilityTodo({ schoolId, onNavigate, strip }: {
  schoolId: number;
  /** `todo`: việc có danh sách hạng mục riêng — màn trường mở danh sách đã lọc đúng các dòng đó. */
  onNavigate: (tab: string, todo?: FacilityTodoFilter) => void;
  /** Một dải gọn: mỗi việc là một liên kết, không dòng giải thích (tab Đánh giá CSVC, phương án C — 12/11/2026). */
  strip?: boolean;
}) {
  const { data } = useQuery({
    queryKey: facilityTodoKey(schoolId),
    queryFn: ({ signal }) => kyInstance.get(`facility_todo/${schoolId}`, { signal }).json<FacilityTodoItem[]>(),
  });
  const [all, setAll] = useState(false);
  const items = data ?? [];
  if (!items.length) return null;
  const go = (item: FacilityTodoItem) =>
    onNavigate(FACILITY_TODO_TAB[item.action.kind], item.action.filter ? { key: item.action.filter, title: item.title } : undefined);
  if (strip) {
    return (
      // Vừa nội dung, không nền kín bề ngang (trưởng nhóm 12/11/2026) — đứng cùng hàng với ô lọc.
      <section className="border-warning/40 bg-warning-subtle text-warning-text flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-full border px-3.5 py-1.5 text-sm">
        <span className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4" />Cần hoàn thiện</span>
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => go(item)} title={item.impact}
            className="hover:text-foreground underline-offset-2 hover:underline">
            {item.title} ›
          </button>
        ))}
      </section>
    );
  }
  const shown = all ? items : items.slice(0, VISIBLE);

  return (
    <section className="bg-card shadow-e1 overflow-hidden rounded-lg border">
      <h3 className="border-b px-4 py-2.5 text-sm font-semibold">Cần hoàn thiện</h3>
      <ul className="divide-y">
        {shown.map((item) => {
          const error = item.severity === "ERROR";
          const Icon = error ? CircleAlert : AlertTriangle;
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
                error ? "bg-destructive-subtle text-destructive-text" : "bg-warning-subtle text-warning-text")}>
                <Icon aria-label={error ? "Thiếu dữ liệu" : "Cần kiểm tra"} />
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-sm font-semibold break-words">{item.title}</span>
                <span className="text-muted-foreground block text-xs break-words">{item.impact}</span>
              </span>
              <Button type="button" variant="outline" size="sm" className="ml-10 sm:ml-0" onClick={() => go(item)}>
                {label(item)}
              </Button>
            </li>
          );
        })}
      </ul>
      {items.length > VISIBLE ? (
        <div className="border-t px-4 py-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "Thu gọn" : `Xem thêm ${items.length - VISIBLE}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
