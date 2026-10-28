import { useCan, useList, useMenu, useResourceParams, useTranslate } from "@refinedev/core";
import type { TreeMenuItem } from "@refinedev/core";
import { LayoutGrid, Lock } from "lucide-react";
import { useMemo, type PropsWithChildren } from "react";
import { Link } from "react-router";

import { useAccessibleMenuItems } from "@/shared/components/layout/sidebar";
import { cn } from "@/shared/lib/utils";


/** Nhóm gốc có trang lối vào (`meta.hub`) chứa resource hiện tại — vd. Danh mục dùng chung. */
function findHub(items: TreeMenuItem[], name: string | undefined) {
  if (!name) return undefined;
  const has = (n: TreeMenuItem): boolean => n.name === name || (n.children ?? []).some((c) => has(c as TreeMenuItem));
  return items.find((i) => i.meta?.hub && !i.meta?.module && has(i));
}

/**
 * MỘT bàn làm việc cho các nhóm có nhiều mục nhỏ cùng dạng (Danh mục dùng chung), dùng cho
 * MỌI trang của nhóm — kể cả trang lối vào: cột trái luôn cùng một cách chia nhóm, không đổi
 * bố cục khi đi từ trang tìm sang một danh mục.
 *
 * Cột trái: lối vào "Tìm trong mọi danh mục" (tìm theo NỘI DUNG — không có ô lọc tên riêng,
 * hai ô tìm cạnh nhau là thừa), rồi các nhóm;
 * mỗi dòng mang SỐ MỤC đang dùng, hoặc chấm "trống" khi chưa khai báo gì — thứ người khai
 * báo cần biết mà không phải mở từng cái. Danh mục cố định (`meta.fixed`) không đếm.
 *
 * Cột phải: màn của mục đang chọn, trên đầu là một dòng "chỉ xem" khi tài khoản không
 * thêm được — cán bộ trường tra cứu danh mục do Sở khai báo, không nên phải đi tìm nút Thêm.
 *
 * Bọc quanh nội dung ở `Layout`; màn không thuộc nhóm như vậy thì trả nguyên `children`.
 * Chỉ các mục tài khoản mở được mới hiện (cùng bộ lọc với sidebar).
 */
export function HubShell({ children }: PropsWithChildren) {
  const { menuItems } = useMenu();
  const items = useAccessibleMenuItems(menuItems);
  const { resource } = useResourceParams();
  const hub = findHub(items, resource?.name);
  const t = useTranslate();

  const current = resource?.name;
  const isEntry = !!resource?.meta?.companion;

  const entries = useMemo(() => {
    const map = new Map<string, TreeMenuItem>();
    const walk = (ns: TreeMenuItem[]) =>
      ns.forEach((n) => {
        if (n.route) map.set(n.name, n);
        walk((n.children ?? []) as TreeMenuItem[]);
      });
    walk((hub?.children ?? []) as TreeMenuItem[]);
    return map;
  }, [hub]);

  if (!hub) return <>{children}</>;

  const label = (n: TreeMenuItem) => (n.meta?.label as string) ?? t(`${n.name}.${n.name}`, n.label ?? n.name);
  const entry = [...entries.values()].find((n) => n.meta?.companion);
  const groups = ((hub.children ?? []) as TreeMenuItem[])
    .filter((g) => g.meta?.module)
    // Danh mục CỐ ĐỊNH (giá trị theo quy định, không ai sửa — loại tài sản, chức vụ…) không lên cột trái:
    // chúng chỉ là lựa chọn trong ô chọn của form; đường dẫn vẫn còn.
    .map((g) => ({ g, list: ((g.children ?? []) as TreeMenuItem[]).filter((c) => c.route && !c.meta?.fixed) }))
    .filter((x) => x.list.length);

  const row = (c: TreeMenuItem, withCount = true) => (
    <HubRow key={c.name} item={c} label={label(c)} active={c.name === current} withCount={withCount} />
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav
        aria-label={label(hub)}
        data-print="hide"
        className="bg-card shadow-e1 flex max-h-[calc(100svh-6rem)] flex-col overflow-hidden rounded-lg border lg:sticky lg:top-16"
      >
        <div className="space-y-2 border-b p-3">
          <p className="text-sm font-semibold">{label(hub)}</p>
          {entry ? (
            <Link
              to={entry.route!}
              aria-current={isEntry ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors [&_svg]:size-4",
                isEntry ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/70"
              )}
            >
              <LayoutGrid className={isEntry ? "text-primary" : "text-muted-foreground"} />
              {label(entry)}
            </Link>
          ) : null}
        </div>
        <div className="scrollbar-fade min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
          {groups.map(({ g, list }) => (
            <div key={g.name} className="mb-2 last:mb-0">
              <p className="text-overline text-muted-foreground px-2 pt-2 pb-1">{label(g)}</p>
              {list.map((c) => row(c))}
            </div>
          ))}
        </div>
      </nav>
      <div className="flex min-w-0 flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function HubRow({ item, label, active, withCount }: { item: TreeMenuItem; label: string; active: boolean; withCount: boolean }) {
  return (
    <Link
      to={item.route!}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors [&_svg]:size-4",
        active ? "bg-primary/10 text-primary font-medium shadow-[inset_2px_0_0_var(--primary)]" : "text-foreground hover:bg-muted/70"
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>{item.meta?.icon as React.ReactNode}</span>
      <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
      {withCount && !item.meta?.fixed ? <CountBadge resource={(item.meta?.countResource as string | undefined) ?? item.name}
        extra={item.meta?.countFilters as { field: string; value: string }[] | undefined} /> : null}
      {item.meta?.fixed ? <Lock className="text-muted-foreground/60 !size-3.5 shrink-0" aria-label="Cố định, chỉ đọc" /> : null}
    </Link>
  );
}

/** Số mục ĐANG DÙNG của một danh mục; chưa có mục nào thì báo "trống". */
function CountBadge({ resource, extra }: { resource: string; extra?: { field: string; value: string }[] }) {
  // Chỉ hỏi khi CHẮC có quyền đọc: lúc quyền còn đang tải, cây menu vẽ tạm cả mục sẽ bị ẩn —
  // không gác thì mỗi mục đó bắn một request 403.
  const canRead = useCan({ resource, action: "list" }).data?.can ?? false;
  const { result } = useList({
    resource,
    filters: [
      { field: "active", operator: "eq", value: true },
      ...(extra ?? []).map((f) => ({ field: f.field, operator: "eq" as const, value: f.value })),
    ],
    pagination: { currentPage: 1, pageSize: 1 },
    queryOptions: { staleTime: 60_000, enabled: canRead },
  });
  const total = result?.total;
  if (total === undefined) return null;
  if (total === 0) {
    return <span className="bg-warning-subtle text-warning-text shrink-0 rounded px-1.5 text-[11px] font-medium">trống</span>;
  }
  return <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{total}</span>;
}
