import { useMenu, useResourceParams } from "@refinedev/core";
import type { TreeMenuItem } from "@refinedev/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useAccessibleMenuItems } from "@/shared/components/layout/sidebar";
import { cn } from "@/shared/lib/utils";

/**
 * Thanh tab của PHÂN HỆ đang mở (Thiết bị, Mượn trả, ...), nằm trên đầu vùng nội dung.
 *
 * Sidebar chỉ có tên phân hệ; các chức năng của nó là các tab ở đây — mở một phiếu, sang
 * tab bên cạnh là tới chức năng kế tiếp của cùng quy trình mà không phải mở lại menu.
 * Chỉ các tab tài khoản mở được mới hiện (cùng bộ lọc với sidebar). Màn không thuộc phân
 * hệ nào (Tổng hợp, Danh mục, Quản trị...) thì không có thanh tab.
 *
 * Phân hệ của màn đang xem lấy theo `meta.parent` của resource hiện tại — nên cả màn ẩn
 * khỏi menu như Tra cứu tài sản (cha là phân hệ Thiết bị) cũng giữ được thanh tab.
 */
export function ModuleTabs() {
  const { menuItems } = useMenu();
  const items = useAccessibleMenuItems(menuItems);
  const { resource, action } = useResourceParams();
  const parent = resource?.meta?.parent as string | undefined;
  if (!resource) return null;
  // Đang LẬP / SỬA một phiếu hay bản ghi: thanh tab ẩn đi. Lúc đó người dùng đang làm dở một việc —
  // tab là lối rẽ sang việc khác (và làm mất dữ liệu đang gõ), còn breadcrumb và nút quay lại đã
  // đủ để về danh sách.
  if (action === "create" || action === "edit" || action === "clone") return null;

  const find = (nodes: TreeMenuItem[]): TreeMenuItem | undefined => {
    for (const n of nodes) {
      if (n.meta?.module && (n.name === parent || (n.children ?? []).some((c) => c.name === resource.name))) return n;
      const deeper = find((n.children ?? []) as TreeMenuItem[]);
      if (deeper) return deeper;
    }
  };
  const module = find(items);
  if (!module) return null;
  const tabs = ([...(module.children ?? [])] as TreeMenuItem[])
    .filter((c) => c.route)
    .sort((a, b) => ((a.meta?.tabOrder as number) ?? 99) - ((b.meta?.tabOrder as number) ?? 99));
  // Phân hệ chỉ còn một tab (Nhập thiết bị, hoặc tài khoản chỉ có quyền một tab): dải tab một mục
  // không dẫn đi đâu, ẩn đi.
  if (tabs.length < 2) return null;

  return <TabStrip label={String(module.meta?.label ?? module.name)} tabs={tabs} current={resource.name} />;
}

/**
 * Dải tab, cuộn ngang khi không đủ chỗ (phân hệ Thiết bị có tám tab — ở màn 1280px ba tab cuối nằm
 * ngoài khung). Hai thứ để phần bị khuất không thành phần bị quên: tab đang mở luôn được cuộn vào
 * tầm nhìn (mở thẳng một tab cuối từ menu thì nó không nằm khuất bên phải), và mép nào còn tab thì
 * mép đó có nút mũi tên — một dải chữ bị cắt ngang không nói rằng nó cuộn được.
 */
function TabStrip({ label, tabs, current }: { label: string; tabs: TreeMenuItem[]; current: string }) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [tabs.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Tính tay thay vì `scrollIntoView`: nó cuộn cả các khung cha, và chạy một lần lúc mount là chạy
    // TRƯỚC khi phông chữ và icon vào chỗ — bề rộng các tab còn đổi, tab cuối lại trượt ra ngoài. Nên
    // làm lại khi phông tải xong và khi dải tab đổi bề rộng.
    const reveal = () => {
      const tab = el.querySelector<HTMLElement>('[aria-current="page"]');
      if (!tab) return;
      const pad = 40; // chừa chỗ cho nút mũi tên ở mép
      const left = tab.offsetLeft - pad;
      const right = tab.offsetLeft + tab.offsetWidth + pad;
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left);
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
    };
    reveal();
    let alive = true;
    void document.fonts?.ready.then(() => alive && reveal());
    const observer = new ResizeObserver(reveal);
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [current]);

  const scroll = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * Math.max(ref.current.clientWidth * 0.6, 160), behavior: "smooth" });

  return (
    <div className="relative -mt-1" data-print="hide">
      {edge.left ? (
        <button type="button" aria-label="Xem các tab phía trước" onClick={() => scroll(-1)}
          className="from-background via-background text-muted-foreground hover:text-foreground absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-start bg-gradient-to-r to-transparent pb-px">
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      {edge.right ? (
        <button type="button" aria-label="Xem các tab phía sau" onClick={() => scroll(1)}
          className="from-background via-background text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-end bg-gradient-to-l to-transparent pb-px">
          <ChevronRight className="size-4" />
        </button>
      ) : null}
      <nav
        ref={ref}
        aria-label={`Chức năng của phân hệ ${label}`}
        // `overflow-y-hidden` đi cùng `overflow-x-auto`: thiếu nó trình duyệt tự bật cuộn DỌC, và chỉ cần
        // một điểm ảnh tràn (gạch chân của tab đang mở) là hiện thanh cuộn dọc ở cuối thanh tab.
        className="scrollbar-fade relative flex gap-1 overflow-x-auto overflow-y-hidden border-b"
      >
        {tabs.map((t) => {
          const active = t.name === current;
          return (
            <Link
              key={t.name}
              to={t.route!}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-t-md px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors",
                active
                  ? "text-primary font-semibold after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {/* Icon của resource (cùng icon với menu) — nhận ra tab bằng hình nhanh hơn đọc chữ. */}
              {t.meta?.icon ? (
                <span className={cn("shrink-0 [&_svg]:size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden>
                  {t.meta.icon as React.ReactNode}
                </span>
              ) : null}
              {(t.meta?.tabLabel as string) ?? (t.meta?.label as string) ?? t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
