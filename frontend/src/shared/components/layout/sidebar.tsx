"use client";

import { initialsOf } from "@/shared/lib/format";
import React from "react";
import {
  useMenu,
  useLink,
  useRefineOptions,
  useActiveAuthProvider,
  useGetIdentity,
  useLogout,
  usePermissions,
  useTranslate,
  type TreeMenuItem,
} from "@refinedev/core";
import {
  ChevronRight,
  ListIcon,
  LogOutIcon,
  PanelLeftIcon,
  UserRoundIcon,
} from "lucide-react";
import { Link } from "react-router";
import { permissionFor } from "@/shared/lib/permissions";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarRail as ShadcnSidebarRail,
  useSidebar as useShadcnSidebar,
} from "@/shared/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";

type Identity = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
};

/* --------------------------------------------------------------------------
   Shared class recipes. Every nav row — link, collapsible trigger, dropdown
   trigger — goes through `navRowClass` so the three stay visually identical.
   -------------------------------------------------------------------------- */

/**
 * Thứ bậc của cây menu đọc được từ chính dòng chữ: gốc (cấp 0) là dòng to và
 * đậm nhất, mỗi cấp sâu hơn nhỏ và nhạt đi một nấc. Trước đây nhóm gốc vẽ bằng
 * kiểu "overline" 11px in hoa trong khi nhóm con là dòng cỡ thường có icon —
 * gốc trông bé hơn con, thứ bậc đọc ngược.
 */
function depthClass(depth: number) {
  if (depth <= 0) return "text-sm font-semibold";
  if (depth === 1) return "text-[13px] font-medium";
  return "text-[13px] font-normal";
}

function navRowClass({
  isSelected,
  isCollapsed,
  depth = 0,
}: {
  isSelected?: boolean;
  isCollapsed?: boolean;
  depth?: number;
}) {
  return cn(
    "group/nav relative flex w-full items-center gap-3 rounded-md",
    depthClass(depth),
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isCollapsed ? "h-10 justify-center px-0" : depth >= 2 ? "px-3 py-1.5" : "px-3 py-2",
    isSelected
      ? [
          // The active row is a solid pill in the rail's own hover colour, and
          // the *icon* carries the accent rather than the label. Tinting the
          // label instead is what makes an active row read as a link rather
          // than a position — and on the light rail there is no accent that
          // stays legible as body text on a pale surface anyway.
          "bg-sidebar-accent text-sidebar-accent-foreground nav-active",
          "[&_svg]:text-sidebar-primary",
          // The tick in the gutter. It is what survives the row being read
          // peripherally, when the fill is too quiet to register.
          "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]",
          "before:rounded-r-full before:bg-sidebar-primary",
          isCollapsed && "before:inset-y-2",
        ]
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
  );
}

function getDisplayName(item: TreeMenuItem) {
  return item.meta?.label ?? item.label ?? item.name;
}

function getIcon(item: TreeMenuItem) {
  return item.meta?.icon ?? item.icon ?? <ListIcon />;
}

/* --------------------------------------------------------------------------
   Access control. `useMenu` does not apply it — it only drops items marked
   `meta.hide` or with neither a list route nor children — so the filtering
   happens here, against the same permission codes the access control provider
   answers `can` from.
   -------------------------------------------------------------------------- */

/**
 * The menu tree with everything this account cannot reach removed.
 *
 * A leaf survives if its list permission is held. A section header survives if
 * anything under it did, which is what makes the whole Administration group
 * disappear for an account with no admin permissions rather than leaving an
 * empty heading behind.
 *
 * With no access control provider configured, `permissions` is undefined and
 * nothing is filtered — the shell stays usable in an app that has not opted
 * into any of this.
 */
export function useAccessibleMenuItems(items: TreeMenuItem[]): TreeMenuItem[] {
  const { data: permissions } = usePermissions<string[]>({});

  return React.useMemo(() => {
    if (!permissions) return items;

    const filter = (nodes: TreeMenuItem[]): TreeMenuItem[] =>
      nodes.flatMap((node) => {
        const children = filter((node.children ?? []) as TreeMenuItem[]);
        // Trang ĐI KÈM (Quy trình của phân hệ, tổng quan danh mục — `meta.companion`) không có
        // mã quyền riêng nên luôn "qua" bộ lọc. Nhóm chỉ còn toàn trang đi kèm là nhóm tài
        // khoản này không làm được việc gì — ẩn cả nhóm.
        if (children.length > 0 && children.every((c) => c.meta?.companion)) return [];
        if (children.length > 0) {
          return [{ ...node, children }];
        }
        // A node with no surviving children is only kept if it is a real
        // destination in its own right and this account may open it.
        if (!node.route) return [];

        const required = permissionFor(node.name, "list");
        return !required || permissions.includes(required) ? [node] : [];
      });

    return filter(items);
  }, [items, permissions]);
}

/* --------------------------------------------------------------------------
   Sidebar
   -------------------------------------------------------------------------- */

/**
 * Cây menu tài khoản này đang thấy: đã lọc quyền và theo góc nhìn (trường / quản lý / đầy đủ). Thanh bên
 * vẽ nó, ô tìm màn trên thanh đầu trang tìm trong nó — để hai nơi không gợi ý hai bộ màn khác nhau.
 */
export function useVisibleMenuItems(): TreeMenuItem[] {
  const { menuItems } = useMenu();
  // MỘT cây cho mọi tài khoản, chỉ lọc theo quyền: Sở không thấy Nhập thiết bị vì không có quyền
  // lập, trường không thấy Kế hoạch mua sắm vì không có quyền xem. Không có góc nhìn riêng.
  return useAccessibleMenuItems(menuItems);
}

export function Sidebar() {
  const { open, isMobile } = useShadcnSidebar();
  const { selectedKey } = useMenu();
  const visibleItems = useVisibleMenuItems();
  const isCollapsed = !open && !isMobile;

  return (
    <ShadcnSidebar
      collapsible="icon"
      className="border-none"
      data-slot="app-sidebar"
    >
      <ShadcnSidebarRail />
      <SidebarBrand />

      <ShadcnSidebarContent
        className={cn(
          "scrollbar-fade gap-3 overflow-x-hidden border-r border-sidebar-border py-4",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {visibleItems.map((item: TreeMenuItem) => (
          <SidebarItem
            key={item.key || item.name}
            item={item}
            selectedKey={selectedKey}
            isCollapsed={isCollapsed}
          />
        ))}
      </ShadcnSidebarContent>

      <SidebarUser isCollapsed={isCollapsed} />
    </ShadcnSidebar>
  );
}

/* --------------------------------------------------------------------------
   Brand block — mirrors the header height so the two rules line up.
   -------------------------------------------------------------------------- */

function SidebarBrand() {
  const { title } = useRefineOptions();
  const { open, isMobile, toggleSidebar } = useShadcnSidebar();
  const t = useTranslate();
  const isCollapsed = !open && !isMobile;

  return (
    <ShadcnSidebarHeader
      className={cn(
        "h-12 shrink-0 flex-row items-center gap-3 overflow-hidden",
        "border-b border-r border-sidebar-border p-0",
        isCollapsed ? "justify-center px-2" : "px-4"
      )}
    >
      {/* Collapsed, the logo doubles as the way back out of the icon rail —
          otherwise only the hairline rail or Ctrl/Cmd+B can expand it. */}
      <BrandMark
        icon={title.icon}
        isCollapsed={isCollapsed}
        onExpand={toggleSidebar}
      />

      {!isCollapsed && (
        <>
          {/* Tên đầy đủ quá dài cho bề ngang rail (bị cắt "thiết bị…"), nên
              tách hai dòng: dòng chính là tên ngắn của hệ thống, dòng phụ là
              đơn vị chủ quản. Tên đầy đủ nằm ở tooltip và tiêu đề tab. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5" title={typeof title.text === "string" ? title.text : undefined}>
            <span className="truncate text-[15px] font-bold leading-tight tracking-tight text-sidebar-foreground">
              CSVC &amp; Thiết bị
            </span>
            <span className="truncate text-[11px] leading-tight text-sidebar-foreground/60">
              Sở GD&amp;ĐT TP. Hồ Chí Minh
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={t("layout.collapseSidebar", "Collapse sidebar")}
            className={cn(
              "size-8 shrink-0 rounded-lg text-sidebar-foreground/60",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <PanelLeftIcon className="size-4" />
          </Button>
        </>
      )}
    </ShadcnSidebarHeader>
  );
}

function BrandMark({
  icon,
  isCollapsed,
  onExpand,
}: {
  icon: React.ReactNode;
  isCollapsed: boolean;
  onExpand: () => void;
}) {
  const t = useTranslate();
  const mark = (
    <div
      className={cn(
        // Logo Sở GD&ĐT TP.HCM (như bản Jmix): huy hiệu tròn trên nền trắng để
        // nổi trên sidebar tối.
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-white p-0.5",
        "[&_img]:size-full [&_img]:object-contain"
      )}
    >
      {icon}
    </div>
  );

  if (!isCollapsed) return mark;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onExpand}
          aria-label={t("layout.expandSidebar", "Expand sidebar")}
          className="rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {mark}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{t("layout.expandSidebar", "Expand sidebar")}</TooltipContent>
    </Tooltip>
  );
}

/* --------------------------------------------------------------------------
   Menu items
   -------------------------------------------------------------------------- */

type MenuItemProps = {
  item: TreeMenuItem;
  selectedKey?: string;
  isCollapsed: boolean;
  depth?: number;
};

function SidebarItem(props: MenuItemProps) {
  const { item, isCollapsed } = props;

  // Nhóm có trang tổng quan (`meta.hub`, vd. Danh mục dùng chung): MỘT dòng mở trang đó.
  if (item.meta?.hub && !item.meta?.module) {
    const selected = containsKey(item, props.selectedKey);
    return (
      <SidebarLink
        {...props}
        item={{ ...item, route: item.meta.hub as string, key: (selected ? props.selectedKey : item.key) ?? item.name }}
      />
    );
  }

  // Nhóm việc của góc nhìn quản lý: một dòng mở mục đầu của nhóm, sáng khi đang ở bất kỳ mục nào.
  if (item.meta?.mgmtTabs) {
    const first = ((item.children ?? []) as TreeMenuItem[]).find((c) => c.route);
    if (!first) return null;
    const selected = containsKey(item, props.selectedKey);
    return <SidebarLink {...props} item={{ ...item, route: first.route, key: (selected ? props.selectedKey : item.key) ?? item.name }} />;
  }

  // Phân hệ (`meta.module`): MỘT dòng mở tab chính; các chức năng con nằm ở thanh tab
  // trên đầu trang (`module-tabs.tsx`), không xổ ra trong sidebar.
  if (item.meta?.module) {
    return <SidebarModule {...props} />;
  }

  // Nhóm chỉ còn ĐÚNG MỘT mục sau khi lọc quyền (phía trường: "Trường học & cơ sở vật chất" chỉ có
  // Tổng quan trường học): một dòng mở thẳng mục đó — xổ ra một danh sách một dòng chỉ thêm một cú bấm.
  const only = (item.children ?? []) as TreeMenuItem[];
  if (only.length === 1 && only[0].route && !(only[0].children ?? []).length) {
    const selected = containsKey(item, props.selectedKey);
    return (
      <SidebarLink
        {...props}
        item={{ ...item, route: only[0].route, key: (selected ? props.selectedKey : item.key) ?? item.name }}
      />
    );
  }

  // `meta.group: true` marks a section header rather than a navigable resource.
  if (item.meta?.group) {
    return <SidebarGroup {...props} />;
  }

  if (item.children && item.children.length > 0) {
    // No room to expand a subtree in the icon rail — flyout instead.
    return isCollapsed ? (
      <SidebarSubmenuFlyout {...props} />
    ) : (
      <SidebarSubmenu {...props} />
    );
  }

  return <SidebarLink {...props} />;
}

function SidebarGroup({ item, selectedKey, isCollapsed }: MenuItemProps) {
  const children = item.children ?? [];

  // Thu gọn: nhóm là MỘT icon, bấm mở menu con bên cạnh — bày hết mục con thành một cột icon
  // không nhãn (Quản trị có hơn chục mục) là một dải hình không ai đọc được.
  if (isCollapsed) {
    return <SidebarSubmenuFlyout item={item} selectedKey={selectedKey} isCollapsed />;
  }

  /*
   * Nhóm cấp 1 cũng thu gọn được, không chỉ nhóm con. Khi danh mục đã lên tới
   * mười mấy mục, một sidebar mà mọi nhóm luôn mở là một cột dài phải cuộn
   * mới thấy phần Quản trị ở cuối.
   *
   * Mở sẵn chỉ khi nhóm chứa trang đang xem (xét đệ quy qua mọi cấp), còn lại
   * thu gọn — nên lần đầu vào, menu chỉ là danh sách tên nhóm.
   */
  return (
    <Collapsible
      defaultOpen={containsKey(item, selectedKey)}
      className="group/section flex flex-col"
    >
      {/* Gốc là một dòng menu đầy đủ — icon, chữ đậm cỡ thường — chứ không
          phải một nhãn overline nhỏ: nó phải nổi hơn mọi thứ nằm dưới nó. */}
      <CollapsibleTrigger className={navRowClass({ depth: 0 })}>
        <NavIcon item={item} />
        <span className="line-clamp-2 flex-1 text-left leading-snug">
          {getDisplayName(item)}
        </span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            "group-data-[state=open]/section:rotate-90"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="ms-4 mt-0.5 flex flex-col gap-0.5 ps-2">
          {children.map((child) => (
            <SidebarItem
              key={child.key || child.name}
              item={child}
              selectedKey={selectedKey}
              isCollapsed={false}
              depth={1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Nhánh này có chứa trang đang xem không — xét ĐỆ QUY. Menu danh mục có ba
 * cấp (nhóm -> nhóm con -> danh mục), nên chỉ nhìn con trực tiếp thì nhóm lớn
 * sẽ không bao giờ tự mở khi đang ở một danh mục nằm sâu hai cấp.
 */
function containsKey(item: TreeMenuItem, key: string | undefined): boolean {
  if (!key) return false;
  return (item.children ?? []).some(
    (child) => child.key === key || containsKey(child, key)
  );
}

function SidebarSubmenu({ item, selectedKey, depth = 0 }: MenuItemProps) {
  const children = item.children ?? [];
  const hasSelectedChild = containsKey(item, selectedKey);

  return (
    <Collapsible defaultOpen={hasSelectedChild} className="group/collapsible">
      <CollapsibleTrigger className={navRowClass({ isCollapsed: false, depth })}>
        <NavIcon item={item} />
        <span className="line-clamp-2 flex-1 text-left leading-snug">
          {getDisplayName(item)}
        </span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            "group-data-[state=open]/collapsible:rotate-90"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="ms-3 mt-0.5 flex flex-col gap-0.5 ps-2">
          {children.map((child) => (
            <SidebarItem
              key={child.key || child.name}
              item={child}
              selectedKey={selectedKey}
              isCollapsed={false}
              depth={depth + 1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarSubmenuFlyout({ item, selectedKey }: MenuItemProps) {
  const Link = useLink();
  const children = item.children ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={navRowClass({ isCollapsed: true })}>
        <NavIcon item={item} />
        <span className="sr-only">{getDisplayName(item)}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="start" className="min-w-48">
        <DropdownMenuLabel>{getDisplayName(item)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children.map((child) => {
          const isSelected = child.key === selectedKey;

          return (
            <DropdownMenuItem key={child.key || child.name} asChild>
              <Link
                // Mục con là một phân hệ / nhóm danh mục (không có route riêng): mở tab chính của nó.
                to={child.route || moduleHome(child as TreeMenuItem)?.route || ""}
                className={cn(
                  "flex w-full items-center gap-2",
                  (isSelected || containsKey(child as TreeMenuItem, selectedKey)) && "bg-accent text-accent-foreground"
                )}
              >
                <span className="[&_svg]:size-4">{getIcon(child)}</span>
                <span className="truncate">{getDisplayName(child)}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Tab mở ra khi bấm một phân hệ: `meta.home` nếu tài khoản mở được, không thì tab đầu không phải Quy trình. */
export function moduleHome(item: TreeMenuItem): TreeMenuItem | undefined {
  const children = (item.children ?? []) as TreeMenuItem[];
  return children.find((c) => c.name === item.meta?.home && c.route)
    ?? children.find((c) => !c.meta?.process && c.route)
    ?? children.find((c) => c.route);
}

function SidebarModule({ item, selectedKey, isCollapsed, depth = 0 }: MenuItemProps) {
  const home = moduleHome(item);
  if (!home) return null;
  // Sáng khi đang ở BẤT KỲ tab nào của phân hệ, không chỉ tab chính.
  const selected = containsKey(item, selectedKey);
  return (
    <SidebarLink
      item={{ ...item, route: home.route, key: (selected ? selectedKey : item.key) ?? item.name }}
      selectedKey={selectedKey}
      isCollapsed={isCollapsed}
      depth={depth}
    />
  );
}

function SidebarLink({ item, selectedKey, isCollapsed, depth = 0 }: MenuItemProps) {
  const Link = useLink();
  const { isMobile, setOpenMobile } = useShadcnSidebar();
  const isSelected = item.key === selectedKey;
  const label = getDisplayName(item);
  const badge = item.meta?.badge as React.ReactNode | undefined;

  const row = (
    <Link
      to={item.route || ""}
      aria-current={isSelected ? "page" : undefined}
      // Tapping a link on mobile should close the drawer behind it.
      onClick={() => isMobile && setOpenMobile(false)}
      className={navRowClass({ isSelected, isCollapsed, depth })}
    >
      <NavIcon item={item} isSelected={isSelected} />
      {isCollapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          {/* Xuống tối đa 2 dòng thay vì cắt cụt: "Tổ chức và cơ sở vật chất"
              bị cắt thành "Tổ chức và cơ sở vậ…" là mất đúng phần phân biệt. */}
          <span className="line-clamp-2 flex-1 leading-snug">{label}</span>
          {badge != null && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5",
                "bg-sidebar-primary/15 text-[10px] font-semibold text-sidebar-primary"
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (!isCollapsed) return row;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavIcon({
  item,
  isSelected,
}: {
  item: TreeMenuItem;
  isSelected?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center [&_svg]:size-4",
        isSelected ? "text-sidebar-primary" : "text-current"
      )}
    >
      {getIcon(item)}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Footer — only rendered when an auth provider can actually identify someone.
   -------------------------------------------------------------------------- */

function SidebarUser({ isCollapsed }: { isCollapsed: boolean }) {
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const t = useTranslate();

  if (!authProvider?.getIdentity) return null;

  const name = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const avatar = (
    <Avatar className="size-8 shrink-0">
      {user?.avatar && <AvatarImage src={user.avatar} alt={name} />}
      <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <ShadcnSidebarFooter className="border-r border-t border-sidebar-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-lg p-1.5 text-left",
            "transition-colors hover:bg-sidebar-accent/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isCollapsed && "justify-center"
          )}
        >
          {avatar}
          {!isCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {name || t("layout.account", "Account")}
              </span>
              {user?.email && (
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.email}
                </span>
              )}
            </div>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="min-w-52">
          {name && <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserRoundIcon className="size-4" />
              <span>{t("layout.yourAccount", "Your account")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => logout()}
            className="text-destructive focus:text-destructive"
          >
            <LogOutIcon className="size-4" />
            <span>{isLoggingOut ? t("buttons.loggingOut", "Logging out…") : t("buttons.logout", "Log out")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnSidebarFooter>
  );
}

Sidebar.displayName = "Sidebar";
