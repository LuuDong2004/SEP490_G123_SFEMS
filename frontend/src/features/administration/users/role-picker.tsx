import { useList, useOne } from "@refinedev/core";
import { useEffect } from "react";
import { Landmark, School, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

import { CrossLink } from "@/shared/components/cross-link";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { UserType } from "@/domains/portal/types";
import type { RoleSummary } from "@/domains/user/types";

/**
 * Vai trò của tài khoản, NHÓM THEO LOẠI VAI (Sở · UBND · Trường · Hệ thống) — mỗi vai một dòng gọn: ô tích, tên, một
 * câu mô tả. Mã vai không hiện (người cấp tài khoản không cần nó). Đã biết loại tài khoản thì chỉ hiện vai cùng loại —
 * máy chủ từ chối vai khác loại (docs/kien-truc/11 §11) — và bỏ những vai đã chọn mà không hợp loại.
 *
 * Giá trị là mảng `{ id }` API cần, đưa thẳng vào `onFinish`.
 */

export type RoleRef = { id: number };

type Role = RoleSummary & { description: string | null; roleType: UserType };

/** Nơi công tác đang chọn trên form: trường, cơ quan quản lý (Sở / UBND), hoặc chưa chọn. */
export type RolePlacement = "school" | "so" | "ubnd" | null;

type Group = { key: string; title: string; icon: ReactNode; tone: string; type: UserType | null };

const GROUPS: Group[] = [
  { key: "so", title: "Cấp Sở", icon: <Landmark />, tone: "text-chart-1", type: "SO" },
  { key: "school", title: "Cấp trường", icon: <School />, tone: "text-chart-4", type: "SCHOOL" },
  { key: "system", title: "Hệ thống", icon: <ShieldCheck />, tone: "text-chart-2", type: "SYSTEM" },
];
const OTHER: Group = { key: "other", title: "Khác", icon: <Users />, tone: "text-muted-foreground", type: null };
/** Thứ tự trong nhóm: lãnh đạo trước, rồi chuyên viên / cán bộ. */
const RANK = ["LEADER", "SPECIALIST", "STAFF"];
const rank = (code: string) => {
  const i = RANK.findIndex((k) => code.endsWith(k));
  return i < 0 ? RANK.length : i;
};

/** Nơi công tác của form → nhóm vai nên làm nổi: có trường là cấp trường, có cơ quan thì theo loại cơ quan. */
export function useRolePlacement(school: { id: number | null } | null | undefined, body: { id: number | null } | null | undefined): RolePlacement {
  const { result } = useOne<{ type: string }>({
    resource: "departments_of_education",
    id: body?.id ?? "",
    queryOptions: { enabled: !school?.id && body?.id != null },
  });
  if (school?.id) return "school";
  if (body?.id == null) return null;
  return result?.type === "so" ? "so" : result?.type === "ubnd" ? "ubnd" : null;
}

/** Loại tài khoản theo nơi công tác của form tạo; chưa rõ thì null. */
export function placementType(mode: "school" | "body" | "none", placement: RolePlacement): UserType | null {
  if (mode === "school") return "SCHOOL";
  if (mode === "none") return "SYSTEM";
  return placement === "so" ? "SO" : null;
}

export function RolePicker({ value, onChange, userType = null }: {
  value: RoleRef[] | undefined;
  onChange: (value: RoleRef[]) => void;
  /** Loại tài khoản — chỉ hiện và chỉ giữ vai cùng loại. null = chưa rõ, hiện tất cả. */
  userType?: UserType | null;
}) {
  // Danh sách vai ngắn và cố định; xin trang lớn để không sót vai người dùng đang tìm.
  const { result, query } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 100 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const selected = new Set((value ?? []).map((ref) => Number(ref.id)));
  const all = result?.data;

  // Đổi loại tài khoản (form tạo) → bỏ vai đã chọn không hợp loại mới.
  useEffect(() => {
    if (!userType || !all || !value?.length) return;
    const keep = value.filter((ref) => all.some((r) => r.id === Number(ref.id) && r.roleType === userType));
    if (keep.length !== value.length) onChange(keep);
  }, [userType, all, value, onChange]);
  const toggle = (roleId: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(roleId);
    else next.delete(roleId);
    onChange([...next].map((id) => ({ id })));
  };

  if (query.isLoading) {
    return (
      <div className={GRID}>
        {GROUPS.map((g) => <Skeleton key={g.key} className="h-40 w-full" />)}
      </div>
    );
  }

  const roles = (all ?? []).filter((r) => !userType || r.roleType === userType);
  if (roles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Chưa có vai trò nào. Hãy{" "}
        <CrossLink to="/roles/create" resource="roles" action="create" newTab className="text-primary font-medium">tạo vai trò</CrossLink>{" "}
        trước.
      </p>
    );
  }

  const groups = [...GROUPS, OTHER]
    .map((g) => ({
      ...g,
      roles: roles
        .filter((r) => (g.type ? r.roleType === g.type : !GROUPS.some((p) => p.type === r.roleType)))
        .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, "vi")),
    }))
    .filter((g) => g.roles.length > 0);

  return (
    <div className={GRID}>
      {groups.map((g) => {
        const picked = g.roles.filter((r) => selected.has(r.id)).length;
        return (
          <section key={g.key} className="bg-card rounded-xl border">
            <header className="flex items-center gap-2 border-b px-3.5 py-2.5">
              <span className={cn("[&_svg]:size-4", g.tone)}>{g.icon}</span>
              <span className="text-sm font-semibold">{g.title}</span>
              {picked ? <span className="text-primary ms-auto text-xs font-medium tabular-nums">Đã chọn {picked}</span> : null}
            </header>
            <ul className="p-1.5">
              {g.roles.map((role) => {
                const on = selected.has(role.id);
                return (
                  <li key={role.id}>
                    <label title={role.description ?? undefined}
                      className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
                        on ? "bg-primary/[0.07]" : "hover:bg-accent/50")}>
                      <Checkbox checked={on} onCheckedChange={(c) => toggle(role.id, c === true)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", on && "text-primary font-medium")}>{role.name}</span>
                        {role.description ? (
                          <span className="text-muted-foreground line-clamp-1 text-xs">{role.description}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Lưới nhóm theo bề rộng thẻ chứa (`@container`), không theo màn hình. */
const GRID = "grid items-start gap-3 @2xl:grid-cols-2 @5xl:grid-cols-4";
