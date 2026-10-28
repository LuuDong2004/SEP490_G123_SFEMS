"use client";

import { Fragment, useMemo } from "react";
import { Home } from "lucide-react";
import {
  matchResourceFromRoute,
  useBreadcrumb,
  useLink,
  useResourceParams,
} from "@refinedev/core";
import {
  BreadcrumbSeparator as ShadcnBreadcrumbSeparator,
  BreadcrumbItem as ShadcnBreadcrumbItem,
  BreadcrumbList as ShadcnBreadcrumbList,
  BreadcrumbPage as ShadcnBreadcrumbPage,
  Breadcrumb as ShadcnBreadcrumb,
} from "@/shared/ui/breadcrumb";
import { usePerspective } from "@/shared/hooks/use-perspective";

export function Breadcrumb() {
  const Link = useLink();
  const { breadcrumbs } = useBreadcrumb();
  const { resources, resource, action } = useResourceParams();
  const { perspective } = usePerspective();
  const rootRouteResource = matchResourceFromRoute("/", resources);

  const breadCrumbItems = useMemo(() => {
    const list: {
      key: string;
      href: string;
      Component: React.ReactNode;
    }[] = [];

    list.push({
      key: "breadcrumb-item-home",
      href: rootRouteResource.matchedRoute ?? "/",
      Component: (
        <Link to={rootRouteResource.matchedRoute ?? "/"}>
          {rootRouteResource?.resource?.meta?.icon ?? (
            <Home className="h-4 w-4" />
          )}
        </Link>
      ),
    });

    // Hai mục liền nhau cùng tên (phân hệ "Thiết bị" › màn "Thiết bị") là một bước lặp —
    // giữ một, lấy mục có liên kết. Khoá theo VỊ TRÍ, không theo nhãn.
    // Góc nhìn quản lý có cây menu riêng (`meta.mgmtParent`, `meta.mgmtLabel`): đường dẫn phải gọi đúng
    // tên trên menu đó — "Kiểm kê › Đợt kiểm kê", không phải "Thiết bị › Đợt kiểm kê" của góc nhìn trường.
    let source: { label: string; href?: string }[] = breadcrumbs.map((c) => ({ label: c.label, href: c.href }));
    const meta = resource?.meta;
    if (perspective === "management" && meta && (meta.mgmtParent || meta.mgmt != null)) {
      const own = action && action !== "list" ? source.length - 2 : source.length - 1;
      if (own >= 0) {
        const parent = resources.find((r) => r.name === meta.mgmtParent)?.meta?.label as string | undefined;
        source = [
          ...(parent ? [{ label: parent }] : []),
          { label: (meta.mgmtLabel as string) ?? source[own].label, href: source[own].href },
          ...source.slice(own + 1),
        ];
      }
    }
    const crumbs: { label: string; href?: string }[] = [];
    for (const c of source) {
      const prev = crumbs[crumbs.length - 1];
      if (prev && prev.label === c.label) crumbs[crumbs.length - 1] = { label: c.label, href: c.href ?? prev.href };
      else crumbs.push({ label: c.label, href: c.href });
    }
    for (const [i, { label, href }] of crumbs.entries()) {
      list.push({
        key: `breadcrumb-item-${i}`,
        href: href ?? "",
        Component: href ? <Link to={href}>{label}</Link> : <span>{label}</span>,
      });
    }

    return list;
  }, [breadcrumbs, Link, rootRouteResource, resources, resource, action, perspective]);

  // Chỉ có "Trang chủ" (tổng quan, trang không thuộc resource nào): không có gì để chỉ đường.
  if (breadCrumbItems.length <= 1) return null;

  return (
    <ShadcnBreadcrumb data-print="hide">
      <ShadcnBreadcrumbList>
        {breadCrumbItems.map((item, index) => {
          if (index === breadCrumbItems.length - 1) {
            return (
              <ShadcnBreadcrumbPage key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbPage>
            );
          }

          return (
            <Fragment key={item.key}>
              <ShadcnBreadcrumbItem key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbItem>
              <ShadcnBreadcrumbSeparator />
            </Fragment>
          );
        })}
      </ShadcnBreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

Breadcrumb.displayName = "Breadcrumb";
