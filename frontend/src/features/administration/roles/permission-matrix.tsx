import { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  PERMISSION_ACTIONS,
  actionLabel,
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/role/types";

/**
 * Ma trận quyền của một vai trò: hàng là chức năng (resource), cột là thao tác (action).
 *
 * Mỗi mã quyền có dạng `{resource}:{action}`, tức là tích của hai trục; danh sách phẳng làm mất
 * một trục. Lưới trả lại trục đó: một hàng đọc là "vai này được làm gì với phiếu nhập", một cột
 * đọc là "ai được duyệt bất cứ thứ gì".
 *
 * Cột lấy từ dữ liệu, không ghim cứng, nên một thao tác mới (ví dụ `configure`) tự có cột thay vì
 * biến mất. Ô không có quyền tương ứng hiện gạch ngang: "không có gì để cấp" khác với "đã bỏ cấp".
 *
 * Giá trị là mảng `{ id }` đúng như API nhận.
 */

export type PermissionRef = { id: number };

type PermissionMatrixProps = {
  value: PermissionRef[] | undefined;
  onChange: (value: PermissionRef[]) => void;
};

type MatrixRow = {
  resource: string;
  label: string;
  /** Quyền ứng với từng thao tác, nếu có. */
  cells: Map<string, Permission>;
  all: Permission[];
};

type TriState = boolean | "indeterminate";

/**
 * Ô tích ba trạng thái: cả, một phần, không. `shared/ui/checkbox` vẽ dấu tích cho trạng thái
 * indeterminate của Radix, nên hàng cấp dở sẽ trông như cấp đủ; ở đây tự vẽ dấu trừ.
 */
function TriStateCheckbox({
  state,
  onToggle,
  label,
  className,
}: {
  state: TriState;
  onToggle: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={state === true}
      // Đang cấp một phần thì bước hữu ích là cấp nốt, nên chỉ ô đã đầy mới bỏ.
      onCheckedChange={() => onToggle(state !== true)}
      aria-label={label}
      aria-checked={state === "indeterminate" ? "mixed" : state}
      className={cn(
        "peer border-input dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-e1",
        "flex items-center justify-center outline-none transition-shadow",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        state === "indeterminate" && "border-primary bg-primary/15 text-primary dark:bg-primary/25",
        className,
      )}
    >
      {state === true && <CheckIcon className="size-3.5" />}
      {state === "indeterminate" && <MinusIcon className="size-3.5" />}
    </CheckboxPrimitive.Root>
  );
}

/** Thứ tự quen thuộc đọc, ghi, xoá, duyệt, xuất, cấu hình; thao tác lạ nối vào cuối. */
function orderActions(actions: Set<string>): string[] {
  const known: string[] = PERMISSION_ACTIONS.filter((action) => actions.has(action));
  const extra = [...actions]
    .filter((action) => !known.includes(action))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

export function PermissionMatrix({ value, onChange }: PermissionMatrixProps) {
  // Danh mục quyền nhỏ và chỉ đổi khi có migration, nên một trang lớn là đủ.
  const { result, query } = useList<Permission>({
    resource: "permissions",
    pagination: { pageSize: 500 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const [search, setSearch] = useState("");

  const permissions = useMemo(() => result?.data ?? [], [result?.data]);

  const { rows, columns } = useMemo(() => {
    const byResource = new Map<string, MatrixRow>();
    const actions = new Set<string>();

    for (const permission of permissions) {
      const { resource, action } = splitPermissionCode(permission.code);
      actions.add(action);

      let row = byResource.get(resource);
      if (!row) {
        row = { resource, label: humanizeResource(resource), cells: new Map(), all: [] };
        byResource.set(resource, row);
      }
      row.cells.set(action, permission);
      row.all.push(permission);
    }

    return {
      rows: [...byResource.values()].sort((a, b) => a.label.localeCompare(b.label, "vi")),
      columns: orderActions(actions),
    };
  }, [permissions]);

  const term = search.trim().toLowerCase();

  const visibleRows = useMemo(
    () =>
      term
        ? rows.filter(
            (row) =>
              row.label.toLowerCase().includes(term) ||
              row.resource.toLowerCase().includes(term) ||
              row.all.some((p) => p.code.toLowerCase().includes(term)),
          )
        : rows,
    [rows, term],
  );

  const selected = useMemo(() => new Set((value ?? []).map((ref) => Number(ref.id))), [value]);

  const emit = (next: Set<number>) => onChange([...next].map((id) => ({ id })));

  const setMany = (subject: Permission[], granted: boolean) => {
    const next = new Set(selected);
    for (const permission of subject) {
      if (granted) next.add(permission.id);
      else next.delete(permission.id);
    }
    emit(next);
  };

  /** Cả, một phần hay không, trên tập quyền được hỏi. */
  const stateOf = (subject: Permission[]): TriState => {
    if (subject.length === 0) return false;
    const granted = subject.filter((p) => selected.has(p.id)).length;
    if (granted === 0) return false;
    if (granted === subject.length) return true;
    return "indeterminate";
  };

  // Ô đầu cột và ô góc tác động lên các hàng đang hiện, nên lọc xong thì "cấp cả cột" chỉ cấp
  // đúng những gì đang thấy.
  const columnSubject = (action: string) =>
    visibleRows.map((row) => row.cells.get(action)).filter((p): p is Permission => p !== undefined);

  const visibleSubject = visibleRows.flatMap((row) => row.all);

  const grantedCount = permissions.filter((p) => selected.has(p.id)).length;

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (permissions.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có quyền nào được định nghĩa.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Lọc theo chức năng hoặc mã quyền"
            className="pl-9"
            aria-label="Lọc quyền"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm tabular-nums">
            <span className="text-foreground font-medium">{grantedCount}</span>/{permissions.length} đã
            cấp
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setMany(visibleSubject, true)}>
            Cấp tất cả
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMany(visibleSubject, false)}>
            Bỏ chọn
          </Button>
        </div>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="bg-muted/50 sticky left-0 z-20 border-b px-3 py-2 text-left">
                <div className="flex items-center gap-2">
                  <TriStateCheckbox
                    state={stateOf(visibleSubject)}
                    onToggle={(next) => setMany(visibleSubject, next)}
                    label="Cấp mọi quyền đang hiển thị"
                  />
                  <span className="text-muted-foreground text-xs">Chức năng</span>
                </div>
              </th>

              {columns.map((action) => {
                const subject = columnSubject(action);
                const granted = subject.filter((p) => selected.has(p.id)).length;

                return (
                  <th
                    key={action}
                    scope="col"
                    className="bg-muted/50 w-28 border-b border-l px-3 py-2 text-center align-bottom"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{actionLabel(action)}</span>
                      <div className="flex items-center gap-1.5">
                        <TriStateCheckbox
                          state={stateOf(subject)}
                          onToggle={(next) => setMany(subject, next)}
                          label={`Cấp ${actionLabel(action)} trên mọi chức năng đang hiển thị`}
                        />
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {granted}/{subject.length}
                        </span>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-muted-foreground px-3 py-8 text-center text-sm"
                >
                  Không có gì khớp với bộ lọc.
                </td>
              </tr>
            )}

            {visibleRows.map((row) => {
              const readPermission = row.cells.get("read");
              // Mọi thao tác khác trên một chức năng đều đi qua màn hình mà `{resource}:read` mở
              // ra, nên ghi mà không đọc là quyền không ai dùng được. Đáng nhắc, không đáng chặn.
              const missingRead =
                readPermission !== undefined &&
                !selected.has(readPermission.id) &&
                row.all.some((p) => p.id !== readPermission.id && selected.has(p.id));

              return (
                <tr key={row.resource} className="group">
                  <th
                    scope="row"
                    className="bg-card group-hover:bg-muted/40 sticky left-0 z-10 border-b px-3 py-2 text-left font-normal transition-colors"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <TriStateCheckbox
                        state={stateOf(row.all)}
                        onToggle={(next) => setMany(row.all, next)}
                        label={`Cấp tất cả trên ${row.label}`}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 font-medium">
                          {row.label}
                          {missingRead && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TriangleAlertIcon className="text-warning size-3.5 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Chưa cấp quyền đọc nên màn hình này vẫn bị ẩn.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                        <span className="text-muted-foreground truncate font-mono text-[11px]">
                          {row.resource}
                        </span>
                      </span>
                    </label>
                  </th>

                  {columns.map((action) => {
                    const permission = row.cells.get(action);

                    if (!permission) {
                      return (
                        <td
                          key={action}
                          className="text-muted-foreground/50 group-hover:bg-muted/40 border-b border-l px-3 py-2 text-center transition-colors"
                        >
                          <span aria-label="Không áp dụng">&mdash;</span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={action}
                        className="group-hover:bg-muted/40 border-b border-l p-0 text-center transition-colors"
                      >
                        <label
                          className="flex cursor-pointer items-center justify-center px-3 py-2"
                          title={permission.description ?? permission.code}
                        >
                          <TriStateCheckbox
                            state={selected.has(permission.id)}
                            onToggle={(next) => setMany([permission], next)}
                            label={permission.code}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
