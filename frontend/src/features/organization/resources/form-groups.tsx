import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Nhóm ô có tên bên TRÁI: tên nhóm + một dòng mô tả ở cột trái, ô nhập lưới hai cột ở cột phải (hộp lớp học,
 * khối nhà). Hộp hẹp thì tên nhóm nằm trên. Bọc các nhóm trong `SIDE_GROUPS` để có vạch ngăn giữa nhóm.
 */
export function SideGroup({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-x-6 gap-y-3 py-5 first:pt-0 last:pb-0 @2xl:grid-cols-[11rem_minmax(0,1fr)]">
      <header>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-primary size-4 shrink-0" />
          {title}
        </h3>
        {description ? <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p> : null}
      </header>
      <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Khung bọc các `SideGroup`: vạch đứt ngăn giữa các nhóm. */
export const SIDE_GROUPS = "@container divide-border divide-y divide-dashed";

/** Nhóm ô có tiêu đề nhỏ nằm TRÊN, ô nhập lưới ba cột (hộp phòng). */
export function TopGroup({ icon: Icon, title, children, cols = 3 }: { icon: LucideIcon; title: string; children: ReactNode; cols?: 3 | 4 }) {
  return (
    <section className="space-y-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Icon className="text-primary size-3.5 shrink-0" />
        {title}
      </h3>
      <div className={cols === 4 ? "grid items-start gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" : "grid items-start gap-x-4 gap-y-5 sm:grid-cols-3"}>{children}</div>
    </section>
  );
}
