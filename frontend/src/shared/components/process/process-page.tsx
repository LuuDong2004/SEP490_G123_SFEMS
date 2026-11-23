import { useMenu, usePermissions, useResourceParams, useTranslate } from "@refinedev/core";
import type { TreeMenuItem } from "@refinedev/core";
import { ChevronRight, FileBarChart, FolderCog } from "lucide-react";
import { Link } from "react-router";

import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { permissionFor } from "@/shared/lib/permissions";
import { cn } from "@/shared/lib/utils";
import { ProcessFlow } from "@/shared/components/process/process-flow";

/** Nội dung một trang Quy trình — khai ở `app/resources/modules.tsx`, không ở đây. */
export type ProcessStep = {
  /** Resource của màn làm bước này; bấm vào thẻ là tới đó. */
  resource: string;
  title: string;
  /** Ai lập. */
  maker: string;
  /** Ai duyệt, theo thứ tự cấp. Vắng = trình là xong / không cần duyệt. */
  approver?: string;
  /** Bước xong thì hệ thống làm gì. */
  result: string;
  /** Bước làm khi cần, không bắt buộc (vd. đợt kiểm kê do cấp trên mở). */
  optional?: boolean;
  /** Thứ bước này giao cho bước sau, vài chữ — chạy dọc đường nối như một thẻ nhãn. */
  handoff?: string;
};
export type ProcessConfig = {
  title: string;
  steps: ProcessStep[];
  /** Danh mục cần khai trước. */
  catalogs: string[];
  /** Báo cáo đọc kết quả của phân hệ. */
  reports: string[];
};

/**
 * Trang "Quy trình" của một phân hệ: các bước theo đúng luồng nghiệp vụ của ta, mỗi
 * bước nói ai LẬP, ai DUYỆT ở cấp nào và xong thì hệ thống làm gì — rồi tới danh mục cần
 * có trước và báo cáo liên quan.
 *
 * Thẻ chỉ thành liên kết khi tài khoản mở được màn đó (cùng `permissionFor` mà sidebar
 * dùng); không thì vẫn hiện để người đọc hiểu cả quy trình, nhưng mờ đi và không bấm được.
 */
export function ProcessPage({ config }: { config: ProcessConfig }) {
  const { menuItems } = useMenu();
  const { data: permissions } = usePermissions<string[]>({});
  const t = useTranslate();
  const { resource } = useResourceParams();
  // Tên và đường dẫn của từng resource lấy từ chính cây menu — không khai lại lần hai.
  const byName = new Map<string, TreeMenuItem>();
  const walk = (items: TreeMenuItem[]) => items.forEach((i) => { byName.set(i.name, i); walk((i.children ?? []) as TreeMenuItem[]); });
  walk(menuItems);
  const can = (name: string) => {
    const code = permissionFor(name, "list");
    return !permissions || !code || permissions.includes(code);
  };
  const labelOf = (name: string) => {
    const item = byName.get(name);
    return (item?.meta?.tabLabel as string) ?? (item?.meta?.label as string) ?? t(`${name}.${name}`, name);
  };

  return (
    <ListView>
      {/* Tiêu đề trang nằm trong khối quy trình (nhãn nhỏ + tiêu đề + một dòng) — header chung chỉ
          giữ cho trình đọc màn hình. */}
      <div className="sr-only"><ListViewHeader resource={resource?.name} canCreate={false} title={config.title} /></div>
      <section className="bg-card shadow-e1 space-y-6 rounded-lg border p-5 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-overline text-primary">Quy trình</p>
            <h2 className="text-xl font-bold tracking-tight">{config.title}</h2>
          </div>
        </div>
        <ProcessFlow
          steps={config.steps}
          byName={byName}
          allowed={(s) => can(s.resource) && !!byName.get(s.resource)?.route}
          labelOf={labelOf}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <LinkPanel icon={<FolderCog />} title="Danh mục cần khai báo trước" hint="Khai đủ trước khi lập phiếu đầu tiên."
          names={config.catalogs} byName={byName} can={can} labelOf={labelOf} />
        <LinkPanel icon={<FileBarChart />} title="Báo cáo liên quan" hint="Đọc kết quả của phân hệ này."
          names={config.reports} byName={byName} can={can} labelOf={labelOf} wide />
      </div>
    </ListView>
  );
}

function LinkPanel({
  icon, title, hint, names, byName, can, labelOf, wide,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  names: string[];
  byName: Map<string, TreeMenuItem>;
  can: (n: string) => boolean;
  labelOf: (n: string) => string;
  wide?: boolean;
}) {
  // Chỉ những mục tài khoản mở được: một liên kết bấm vào là 403 thì không nên đưa ra.
  const items = names.map((n) => byName.get(n)).filter((i): i is TreeMenuItem => !!i?.route && can(i.name));
  if (!items.length) return null;
  return (
    <section className="bg-card shadow-e1 rounded-lg border">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <span className="text-muted-foreground ms-auto text-xs tabular-nums">{items.length}</span>
      </header>
      <div className={cn("grid gap-1 p-2", wide ? "sm:grid-cols-2 2xl:grid-cols-3" : "")}>
        {items.map((i) => (
          <Link key={i.name} to={i.route!}
            className="group hover:bg-primary/5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors">
            <span className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors [&_svg]:size-4">
              {(i.meta?.icon as React.ReactNode) ?? <FileBarChart />}
            </span>
            <span className="min-w-0 flex-1 truncate">{labelOf(i.name)}</span>
            <ChevronRight className="text-muted-foreground/50 group-hover:text-primary size-4 shrink-0 transition-[color,translate] group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
