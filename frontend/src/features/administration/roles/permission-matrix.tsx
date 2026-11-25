import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  CheckIcon,
  MinusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  PERMISSION_ACTIONS,
  actionLabel,
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/role/types";
import { grantable, selfApproving } from "@/domains/permission/types";

/**
 * The permissions a role grants, as a resource x action matrix.
 *
 * Every code is `{resource}:{action}`, which is a product of two axes, and a
 * list flattens one of them away. A grid puts it back: a row reads as "what
 * this role may do to blog posts", a column as "who may delete anything", and
 * the shape of a role becomes something you can see rather than something you
 * reconstruct from a column of checkboxes.
 *
 * Columns come from the data, not from a fixed list, so a code with an action
 * nobody anticipated gets its own column instead of disappearing. A resource
 * with no permission for a column shows a dash: nothing to grant is a different
 * statement from granted-and-then-revoked, and a disabled checkbox says
 * neither.
 *
 * The value is the array of `{ id }` refs the API expects.
 */

export type PermissionRef = { id: number };

type PermissionMatrixProps = {
  value: PermissionRef[] | undefined;
  onChange: (value: PermissionRef[]) => void;
  /**
   * Loại vai — chỉ hiện quyền loại vai đó mang được (`grantable`). null = chưa chọn loại, chưa hiện quyền nào.
   */
  roleType: string | null;
  /** Vai khoá quyền (Quản trị viên): chỉ xem, không tích được. */
  readOnly?: boolean;
};

type MatrixRow = {
  resource: string;
  label: string;
  /** The permission for each action, where one exists. */
  cells: Map<string, Permission>;
  all: Permission[];
};

type TriState = boolean | "indeterminate";

/**
 * A checkbox that can say "some".
 *
 * `components/ui/checkbox.tsx` draws a tick for Radix's indeterminate state, so
 * a half-granted row would look fully granted through it. The matrix lives or
 * dies on that distinction — every header box in it summarises the boxes below
 * or beside it — so it draws its own indicator rather than hand-editing the
 * stock primitive.
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
      // Partly granted, and the useful move from there is to grant the rest —
      // so only a full box clears.
      onCheckedChange={() => onToggle(state !== true)}
      aria-label={label}
      aria-checked={state === "indeterminate" ? "mixed" : state}
      className={cn(
        "peer border-input dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-e1",
        "flex items-center justify-center outline-none transition-shadow",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        state === "indeterminate" &&
          "border-primary bg-primary/15 text-primary dark:bg-primary/25",
        className
      )}
    >
      {state === true && <CheckIcon className="size-3.5" />}
      {state === "indeterminate" && <MinusIcon className="size-3.5" />}
    </CheckboxPrimitive.Root>
  );
}

/**
 * `read`, `write`, `delete` keep their familiar order; an action the catalogue
 * grows later is appended rather than dropped.
 */
function orderActions(actions: Set<string>): string[] {
  const known: string[] = PERMISSION_ACTIONS.filter((action) =>
    actions.has(action)
  );
  const extra = [...actions]
    .filter((action) => !known.includes(action))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

export function PermissionMatrix({ value, onChange, roleType, readOnly = false }: PermissionMatrixProps) {
  // The catalogue is fixed and small — it only changes when a migration adds a
  // permission — so one large page is the whole of it.
  const { result, query } = useList<Permission>({
    resource: "permissions",
    pagination: { pageSize: 200 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const [search, setSearch] = useState("");

  const permissions = useMemo(
    () => (roleType ? (result?.data ?? []).filter((p) => grantable(p, roleType)) : []),
    [result?.data, roleType],
  );

  // Đổi loại vai (form tạo) → bỏ quyền đã tích không hợp loại mới.
  useEffect(() => {
    if (readOnly || !roleType || !result?.data || !value?.length) return;
    const keep = value.filter((ref) => permissions.some((p) => p.id === ref.id));
    if (keep.length !== value.length) onChange(keep);
  }, [readOnly, roleType, result?.data, permissions, value, onChange]);

  const { rows, columns } = useMemo(() => {
    const byResource = new Map<string, MatrixRow>();
    const actions = new Set<string>();

    for (const permission of permissions) {
      const { resource, action } = splitPermissionCode(permission.code);
      actions.add(action);

      let row = byResource.get(resource);
      if (!row) {
        row = {
          resource,
          label: humanizeResource(resource),
          cells: new Map(),
          all: [],
        };
        byResource.set(resource, row);
      }
      row.cells.set(action, permission);
      row.all.push(permission);
    }

    return {
      rows: [...byResource.values()].sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
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
              row.all.some((p) => p.code.toLowerCase().includes(term))
          )
        : rows,
    [rows, term]
  );

  const selected = useMemo(
    () => new Set((value ?? []).map((ref) => Number(ref.id))),
    [value]
  );

  const emit = (next: Set<number>) => {
    if (!readOnly) onChange([...next].map((id) => ({ id })));
  };

  const setMany = (subject: Permission[], granted: boolean) => {
    const next = new Set(selected);
    const codes = new Set(subject.map((p) => p.code));
    for (const permission of subject) {
      // Tích cả nhóm thì bỏ qua quyền duyệt của phiếu mà nhóm đã có quyền lập: một vai không vừa lập vừa duyệt (GBR-07).
      if (granted && permission.code.endsWith(":approve") && codes.has(permission.code.replace(":approve", ":write"))) continue;
      if (granted) next.add(permission.id);
      else next.delete(permission.id);
    }
    emit(next);
  };

  /** Whole, partial or none, over whatever set of permissions is asked about. */
  const stateOf = (subject: Permission[]): TriState => {
    if (subject.length === 0) return false;
    const granted = subject.filter((p) => selected.has(p.id)).length;
    if (granted === 0) return false;
    if (granted === subject.length) return true;
    return "indeterminate";
  };

  // The column and corner boxes act on the rows you can see, so a search
  // narrows "grant this column" to what it says on screen.
  const columnSubject = (action: string) =>
    visibleRows
      .map((row) => row.cells.get(action))
      .filter((p): p is Permission => p !== undefined);

  const visibleSubject = visibleRows.flatMap((row) => row.all);

  const grantedCount = permissions.filter((p) => selected.has(p.id)).length;
  const both = selfApproving(new Set(permissions.filter((p) => selected.has(p.id)).map((p) => p.code)));

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {roleType ? "Chưa có quyền nào được định nghĩa." : "Chọn loại vai để hiện các quyền."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
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
            <span className="text-foreground font-medium">{grantedCount}</span>/
            {permissions.length} đã cấp
          </span>
          {readOnly ? null : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMany(visibleSubject, true)}
              >
                Cấp tất cả
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMany(visibleSubject, false)}
              >
                Bỏ chọn
              </Button>
            </>
          )}
        </div>
      </div>

      {both.length > 0 ? (
        <p className="bg-warning-subtle text-warning-text flex items-start gap-2 rounded-md px-3 py-2 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          Một vai không được vừa lập vừa duyệt: {both.join(", ")}. Bỏ quyền Ghi hoặc quyền Duyệt rồi mới lưu được.
        </p>
      ) : null}

      <fieldset disabled={readOnly} className="bg-card min-w-0 overflow-x-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-muted/50 sticky left-0 z-20 border-b px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <TriStateCheckbox
                    state={stateOf(visibleSubject)}
                    onToggle={(next) => setMany(visibleSubject, next)}
                    label="Cấp mọi quyền đang hiển thị"
                  />
                  <span className="text-muted-foreground text-xs">
                    Chức năng
                  </span>
                </div>
              </th>

              {columns.map((action) => {
                const subject = columnSubject(action);
                const granted = subject.filter((p) =>
                  selected.has(p.id)
                ).length;

                return (
                  <th
                    key={action}
                    scope="col"
                    className="bg-muted/50 w-28 border-b border-l px-3 py-2 text-center align-bottom"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium capitalize">
                        {actionLabel(action)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <TriStateCheckbox
                          state={stateOf(subject)}
                          onToggle={(next) => setMany(subject, next)}
                          label={`Cấp ${actionLabel(action)} trên mọi tài nguyên đang hiển thị`}
                        />
                        <span className="text-muted-foreground text-[0.6875rem] tabular-nums">
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
              // Every other action on a resource is reached through a screen
              // that `{resource}:read` is what opens, so write without read is
              // a grant nobody can use. Worth pointing out, not worth refusing:
              // the API is what decides.
              const missingRead =
                readPermission !== undefined &&
                !selected.has(readPermission.id) &&
                row.all.some(
                  (p) => p.id !== readPermission.id && selected.has(p.id)
                );

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
                                Chưa cấp quyền xem nên màn hình này vẫn bị ẩn.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                        <span className="text-muted-foreground truncate font-mono text-[0.6875rem]">
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
      </fieldset>
    </div>
  );
}
