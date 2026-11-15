import { useMenu, useResourceParams } from "@refinedev/core";
import type { TreeMenuItem } from "@refinedev/core";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAccessibleMenuItems, useManagementMenu } from "@/shared/components/layout/sidebar";
import { useLiquid } from "@/shared/hooks/use-liquid";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { TAB_ACTIVE, TAB_HINT, TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * Một lựa chọn trong menu xổ của tab (`meta.tabMenu` của resource): mở màn của tab với `?{param}={value}`.
 * `short` là chữ ghi kèm trên tab khi đang chọn ("· THCS"); vắng thì dùng `label`.
 */
export type TabMenuItem = { param: string; value: string; label: string; short?: string; separatorBefore?: boolean };

import { tabHint } from "./tab-hints";

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
  const { perspective } = usePerspective();
  const managementMenu = useManagementMenu(items);
  const parent = resource?.meta?.parent as string | undefined;
  if (!resource) return null;
  // Đang LẬP / SỬA một phiếu hay bản ghi: thanh tab ẩn đi. Lúc đó người dùng đang làm dở một việc —
  // tab là lối rẽ sang việc khác (và làm mất dữ liệu đang gõ), còn breadcrumb và nút quay lại đã
  // đủ để về danh sách.
  if (action === "create" || action === "edit" || action === "clone") return null;
  // Màn CHI TIẾT (xem một phiếu, một hồ sơ): có nút quay lại và breadcrumb — thanh tab phân hệ chỉ chiếm chỗ và kéo
  // nội dung xuống (trưởng nhóm 15/11/2026: "view detail thì bỏ thanh menu đi"). Thanh tab chỉ ở các màn danh sách.
  if (action === "show") return null;

  const find = (nodes: TreeMenuItem[]): TreeMenuItem | undefined => {
    for (const n of nodes) {
      if (n.meta?.module && (n.name === parent || (n.children ?? []).some((c) => c.name === resource.name))) return n;
      const deeper = find((n.children ?? []) as TreeMenuItem[]);
      if (deeper) return deeper;
    }
  };
  // Góc nhìn quản lý: nhóm việc trên menu (Trường học, Thiết bị, Mua sắm, Kiểm kê) là một dòng, các mục
  // của nó là thanh tab ở đây.
  if (perspective === "management") {
    const group = managementMenu.find((g) => g.meta?.mgmtTabs && (g.children ?? []).some((c) => c.name === resource.name));
    // Tên tab là tên trên menu quản lý (`meta.label` đã mang `mgmtLabel`), không phải `tabLabel` của phân hệ trường.
    const groupTabs = ((group?.children ?? []) as TreeMenuItem[])
      .filter((c) => c.route)
      .map((c) => ({ ...c, meta: { ...c.meta, tabLabel: undefined } }) as TreeMenuItem);
    if (group && groupTabs.length > 1) return <TabStrip label={String(group.meta?.label ?? group.name)} tabs={groupTabs} current={resource.name} management />;
  }

  const module = find(items);
  // Phân hệ là cách TRƯỜNG làm việc — góc nhìn quản lý vào từng màn thẳng từ menu của nó. Ngoại lệ:
  // nhóm danh mục dùng chung (`tabsEverywhere`), vì Sở là người khai danh mục.
  if (!module || (perspective === "management" && !module.meta?.tabsEverywhere)) return null;

  // Tab của góc nhìn quản lý (`meta.audience: "management"`, vd. Đợt kiểm kê) không hiện với tài khoản của
  // trường — cùng luật với sidebar. Quản trị viên (`full`) vẫn thấy đủ.
  const tabs = ([...(module.children ?? [])] as TreeMenuItem[])
    .filter((c) => c.route && !(perspective === "school" && c.meta?.audience === "management"))
    .sort((a, b) => ((a.meta?.tabOrder as number) ?? 99) - ((b.meta?.tabOrder as number) ?? 99));

  // Chỉ một tab thì không có gì để chọn — không vẽ dải tab.
  if (tabs.length <= 1) return null;
  return <TabStrip label={String(module.meta?.label ?? module.name)} tabs={tabs} current={resource.name} management={perspective === "management"} />;
}

/**
 * Dải tab, cuộn ngang khi không đủ chỗ (phân hệ Thiết bị có tám tab — ở màn 1280px ba tab cuối nằm
 * ngoài khung). Hai thứ để phần bị khuất không thành phần bị quên: tab đang mở luôn được cuộn vào
 * tầm nhìn (mở thẳng một tab cuối từ menu thì nó không nằm khuất bên phải), và mép nào còn tab thì
 * mép đó có nút mũi tên — một dải chữ bị cắt ngang không nói rằng nó cuộn được.
 */
function TabStrip({ label, tabs, current, management = false }: { label: string; tabs: TreeMenuItem[]; current: string; management?: boolean }) {
  // Nền tab đang mở trượt kiểu iOS khi đổi tab (`useLiquid`); cùng phần tử với khung cuộn của dải tab.
  const [params] = useSearchParams();
  const [ref, indRef] = useLiquid<HTMLElement>(current, { memory: `tabs:${label}` });
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Mép phải tính theo TAB CUỐI, không theo `scrollWidth`: viên màu trượt hơi vượt đà khi đổi tab, nằm ngoài
      // tab cuối một lúc và kéo `scrollWidth` ra theo — nút ">" bật lên che chữ tab cuối và nằm lì ở đó vì không còn
      // sự kiện cuộn / đổi cỡ nào để đo lại.
      const tabsInStrip = el.querySelectorAll<HTMLElement>("a, [data-tab]");
      const lastTab = tabsInStrip[tabsInStrip.length - 1];
      const end = lastTab ? lastTab.offsetLeft + lastTab.offsetWidth : el.scrollWidth;
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < end - 4;
      setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Đo lại khi viên màu dừng trượt — lúc nó vượt đà trình duyệt có thể đã cuộn dải tab đi vài điểm ảnh.
    el.addEventListener("transitionend", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("transitionend", measure);
      observer.disconnect();
    };
  }, [ref, tabs.length, current]);

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
  }, [ref, current]);

  const scroll = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * Math.max(ref.current.clientWidth * 0.6, 160), behavior: "smooth" });

  return (
    // Thanh chọn kiểu iOS (như thanh chọn nghề của demo_taichinh), bo góc theo thẻ / nút của app: các tab nằm trên một thanh trắng, tab đang
    // mở là viên màu chính nổi lên, trượt kiểu chất lỏng sang tab mới (`useLiquid`).
    <div className={cn(TAB_STRIP, "block")} data-print="hide">
      {edge.left ? (
        <button type="button" aria-label="Xem các tab phía trước" onClick={() => scroll(-1)}
          className="from-muted via-muted text-muted-foreground hover:text-foreground absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start rounded-l-full bg-gradient-to-r to-transparent ps-2.5">
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      {edge.right ? (
        <button type="button" aria-label="Xem các tab phía sau" onClick={() => scroll(1)}
          className="from-muted via-muted text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end rounded-r-full bg-gradient-to-l to-transparent pe-2.5">
          <ChevronRight className="size-4" />
        </button>
      ) : null}
      <nav
        ref={ref}
        aria-label={`Chức năng của phân hệ ${label}`}
        // `overflow-y-hidden` đi cùng `overflow-x-auto`: thiếu nó trình duyệt tự bật cuộn DỌC khi chỉ một điểm ảnh tràn.
        className="relative flex gap-1 overflow-x-auto overflow-y-hidden rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Viên màu của tab đang mở: MỘT phần tử trượt giữa các tab thay vì mỗi tab tự vẽ. Lớp sáng chéo + bóng màu
            chính cho cảm giác nổi như nút iOS. */}
        <span ref={indRef} aria-hidden
          className="pill-on pointer-events-none absolute rounded-full opacity-0" />
        {tabs.map((t) => {
          const active = t.name === current;
          const fullLabel = String(t.meta?.label ?? t.label ?? t.name);
          // Rê chuột: một câu nói tab chứa gì (`tab-hints.ts`); chưa có câu thì hiện tên đầy đủ khi tab mang tên ngắn.
          const hint = tabHint(t.name, management) ?? (TAB_SHORT[t.name] ? fullLabel : undefined);
          // Tab có menu xổ (`meta.tabMenu`): bấm mở danh sách lựa chọn, mỗi lựa chọn là một liên kết tới màn đó với
          // tham số riêng (?level=THCS). Tab đang mở ghi kèm lựa chọn hiện tại.
          const menu = t.meta?.tabMenu as TabMenuItem[] | undefined;
          if (menu?.length) {
            const picked = active ? menu.find((m) => params.get(m.param) === m.value) : undefined;
            return (
              <DropdownMenu key={t.name}>
                <DropdownMenuTrigger asChild>
                  <button type="button" data-tab aria-current={active ? "page" : undefined} title={hint}
                    className={cn(TAB_ITEM, active ? TAB_ACTIVE : TAB_IDLE)}>
                    {t.meta?.icon ? (
                      <span className={cn("shrink-0 transition-colors duration-300 [&_svg]:size-4", active ? "text-primary-foreground delay-75" : "text-muted-foreground")} aria-hidden>
                        {t.meta.icon as React.ReactNode}
                      </span>
                    ) : null}
                    {TAB_SHORT[t.name] ?? (t.meta?.tabLabel as string) ?? (t.meta?.label as string) ?? t.label}
                    <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={6} className="min-w-[14rem]"
                  // Đóng menu không trả focus về tab: tab đang mở hiện vòng focus viền quanh viên màu.
                  onCloseAutoFocus={(e) => e.preventDefault()}>
                  {menu.map((m) => (
                    <Fragment key={m.value}>
                      {m.separatorBefore ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem asChild>
                        <Link to={`${t.route}?${m.param}=${encodeURIComponent(m.value)}`}>
                          {m.label}
                          {picked?.value === m.value ? <Check className="text-primary ms-auto size-4" aria-hidden /> : null}
                        </Link>
                      </DropdownMenuItem>
                    </Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          const link = (
            <Link
              key={t.name}
              to={t.route!}
              aria-current={active ? "page" : undefined}
              className={cn(
                // Chữ đổi màu trễ một nhịp (delay) để viên màu trượt tới rồi chữ mới sáng lên.
                TAB_ITEM,
                active ? TAB_ACTIVE : TAB_IDLE
              )}
            >
              {/* Icon của resource (cùng icon với menu) — nhận ra tab bằng hình nhanh hơn đọc chữ. */}
              {t.meta?.icon ? (
                <span className={cn("shrink-0 transition-colors duration-300 [&_svg]:size-4", active ? "text-primary-foreground delay-75" : "text-muted-foreground")} aria-hidden>
                  {t.meta.icon as React.ReactNode}
                </span>
              ) : null}
              {TAB_SHORT[t.name] ?? (t.meta?.tabLabel as string) ?? (t.meta?.label as string) ?? t.label}
            </Link>
          );
          if (!hint) return link;
          return (
            <Tooltip key={t.name} delayDuration={300}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4} tone="light"
                className={TAB_HINT}>
                {hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Tên NGẮN trên tab — tab nằm trong một phân hệ / nhóm đã nói rõ ngữ cảnh ("Mua sắm" › "Đề xuất"), nên không lặp
 * lại cả tên đầy đủ. Tiêu đề trang, breadcrumb, menu vẫn dùng tên đầy đủ; rê chuột lên tab thấy tên đầy đủ.
 * Tên ở đây: tối đa ba chữ.
 */
const TAB_SHORT: Record<string, string> = {
  // Quản trị — cấu hình
  code_rules: "Quy tắc sinh mã",
  school_code_rules: "Mã của trường",
  approval_flows: "Luồng duyệt",
  ai_settings: "AI",
  // Quản trị — tài khoản, dữ liệu, giám sát
  row_level_policies: "Phạm vi dữ liệu",
  school_users: "Tài khoản trường",
  staff_accounts: "Tài khoản cán bộ",
  data_transfer: "Nhập / xuất",
  system_status: "Tình trạng",
  activity_logs: "Nhật ký",
  data_changes: "Lịch sử dữ liệu",
  // Thiết bị
  equipment: "Thiết bị",
  // Cấp phát & sử dụng
  equipment_allocations: "Cấp phát",
  // Mượn trả
  equipment_loans: "Mượn thiết bị",
  // Sửa chữa & bảo trì
  repair_orders: "Sửa chữa",
  facility_works: "Sửa chữa công trình",
  // Mua sắm
  equipment_adequacy: "Định mức",
  purchase_proposals: "Đề xuất",
  procurement_plans: "Kế hoạch",
  // Danh mục chung
  standard_adjustment_rules: "Điều chỉnh chuẩn",
  equipment_configs: "Thông số kỹ thuật",
  equipment_standards: "Danh mục tối thiểu",
  equipment_norms: "Định mức",
  norm_matrix: "Số lượng tối thiểu",
  acquisition_methods: "Hình thức mua",
  movement_reasons: "Lý do biến động",
  room_types: "Loại CSVC",
  facility_groups: "Khối CSVC",
  facility_standard_rules: "Chuẩn CSVC",
};
