import { useList, useOne } from "@refinedev/core";
import { Building2, Landmark, School, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

import { CrossLink } from "@/shared/components/cross-link";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { RoleSummary } from "@/domains/user/types";

/**
 * Vai trò của tài khoản, NHÓM THEO CẤP (Sở · UBND · Trường · Hệ thống) — mỗi vai một dòng gọn: ô tích, tên, một
 * câu mô tả. Mã vai không hiện (người cấp tài khoản không cần nó). Đã chọn nơi công tác thì nhóm hợp với nơi đó
 * được làm nổi, nhóm khác mờ đi — vẫn chọn được, vì có vai ghép (quản trị viên ở Sở…).
 *
 * Giá trị là mảng `{ id }` API cần, đưa thẳng vào `onFinish`.
 */

export type RoleRef = { id: number };

type Role = RoleSummary & { description: string | null };

/** Nơi công tác đang chọn trên form: trường, cơ quan quản lý (Sở / UBND), hoặc chưa chọn. */
export type RolePlacement = "school" | "so" | "ubnd" | null;

type Group = { key: string; title: string; icon: ReactNode; tone: string; fits: RolePlacement[]; match: (code: string) => boolean };

const GROUPS: Group[] = [
  { key: "so", title: "Cấp Sở", icon: <Landmark />, tone: "text-chart-1", fits: ["so"], match: (c) => c.startsWith("SO_") },
  { key: "ubnd", title: "Cấp UBND", icon: <Building2 />, tone: "text-chart-3", fits: ["ubnd"], match: (c) => c.startsWith("UBND_") },
  {
    key: "school", title: "Cấp trường", icon: <School />, tone: "text-chart-4", fits: ["school"],
    match: (c) => c.startsWith("SCHOOL_") || c === "TEACHER" || c === "SUBJECT_HEAD",
  },
  { key: "system", title: "Hệ thống", icon: <ShieldCheck />, tone: "text-chart-2", fits: [], match: (c) => c === "ADMIN" },
];
const OTHER: Group = { key: "other", title: "Khác", icon: <Users />, tone: "text-muted-foreground", fits: [], match: () => true };
/** Thứ tự trong nhóm: lãnh đạo trước, rồi chuyên viên / cán bộ, rồi người dùng. */
const RANK = ["LEADER", "SPECIALIST", "STAFF", "SUBJECT_HEAD", "TEACHER"];
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

export function RolePicker({ value, onChange, placement = null }: {
  value: RoleRef[] | undefined;
  onChange: (value: RoleRef[]) => void;
  placement?: RolePlacement;
}) {
  // Danh sách vai ngắn và cố định; xin trang lớn để không sót vai người dùng đang tìm.
  const { result, query } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 100 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const selected = new Set((value ?? []).map((ref) => Number(ref.id)));
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

  const roles = result?.data ?? [];
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
    .map((g, k, all) => ({
      ...g,
      roles: roles
        .filter((r) => g.match(r.code) && !all.slice(0, k).some((p) => p.match(r.code)))
        .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, "vi")),
    }))
    .filter((g) => g.roles.length > 0);

  return (
    <div className={GRID}>
      {groups.map((g) => {
        const dim = placement != null && g.fits.length > 0 && !g.fits.includes(placement);
        const picked = g.roles.filter((r) => selected.has(r.id)).length;
        return (
          <section key={g.key}
            className={cn("rounded-xl border transition-opacity", dim ? "opacity-55 hover:opacity-100" : "bg-card",
              placement != null && g.fits.includes(placement) && "border-primary/40 shadow-e1")}>
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
