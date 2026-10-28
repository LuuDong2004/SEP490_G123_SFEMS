"use client";

import { initialsOf } from "@/shared/lib/format";
import {
  useActiveAuthProvider,
  useGetIdentity,
  useLogout,
  useRefineOptions,
  useTranslate,
} from "@refinedev/core";
import { LogOutIcon, UserRoundIcon } from "lucide-react";
import { Link } from "react-router";

import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { HeaderSearch } from "@/shared/components/layout/header-search";
import { NotificationBell } from "@/shared/components/layout/notification-bell";
import { HelpButton } from "@/shared/components/layout/help-button";
import { ThemeCustomizer } from "@/shared/components/theme/theme-customizer";
import { ThemeToggle } from "@/shared/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { getAuthorities } from "@/shared/api/session";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { SYSTEM_ROLE_LABELS } from "@/domains/role/types";

type Identity = {
  username?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
};

/**
 * Sticky application bar.
 *
 * Frosted rather than opaque, so content scrolling underneath stays faintly
 * visible — the detail that gives the Apex shell its depth.
 *
 * Ba vùng: trái là BREADCRUMB ("đang ở đâu" — trước đây chiếm riêng một hàng trong trang, còn thanh
 * này gần như trống), phải là ô tìm nhanh, các nút tiện ích, một vạch ngăn, rồi tài khoản (ảnh + tên —
 * có tên thì mới nhận ra đó là một menu). Màn hẹp: breadcrumb về lại đầu trang (`Layout`).
 */
export function Header() {
  const { isMobile } = useSidebar();
  const t = useTranslate();
  const { title } = useRefineOptions();

  return (
    <header
      data-slot="app-header"
      className={cn(
        "sticky top-0 z-30 flex h-12 shrink-0",
        "border-b border-border bg-card"
      )}
    >
      {/*
        The bar itself is full-bleed so its bottom border runs the width of the
        viewport; its contents ride the same column as the page below, which is
        what keeps the search field lined up with the breadcrumb and the table.
      */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-(--shell-max-w) items-center",
          "justify-between gap-3 px-(--shell-gutter-x)"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger
            aria-label={t("layout.openMenu", "Open menu")}
            className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          />

          {/* On mobile the sidebar brand is off-canvas, so restate it here. */}
          {isMobile && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-4">
                {title.icon}
              </div>
              <span className="truncate text-sm font-bold tracking-tight">
                {title.text}
              </span>
            </div>
          )}

          <div className="hidden min-w-0 md:block">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <HeaderSearch />
          <HelpButton />
          <NotificationBell />
          <ThemeToggle />
          <ThemeCustomizer />
          <span aria-hidden className="bg-border mx-1.5 hidden h-6 w-px sm:block" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const t = useTranslate();

  if (!authProvider?.getIdentity) return null;

  const name =
    user?.fullName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const roles = (getAuthorities()?.roles ?? []).map((r) => SYSTEM_ROLE_LABELS[r] ?? r);
  const avatar = (size: string, text: string) => (
    <Avatar className={size}>
      {user?.avatar && <AvatarImage src={user.avatar} alt={name} />}
      <AvatarFallback className={cn("bg-primary/10 font-semibold text-primary", text)}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      {/* Nút gọn: chỉ ảnh — tên, thư và vai nằm ở đầu thẻ xổ xuống. */}
      <DropdownMenuTrigger
        aria-label={t("layout.userMenu", "User menu")}
        title={name}
        className={cn(
          "rounded-full transition-shadow hover:ring-2 hover:ring-primary/25 data-[state=open]:ring-2 data-[state=open]:ring-primary/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {avatar("size-8", "text-xs")}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-0">
        {/* Đầu thẻ: ai đang đăng nhập — ảnh, tên đủ (xuống dòng, không cắt), thư, vai. */}
        <div className="bg-surface-subtle flex items-start gap-3 border-b p-4">
          {avatar("size-10", "text-sm")}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm leading-snug font-semibold break-words">{name || user?.username}</p>
            {user?.email ? <p className="text-muted-foreground truncate text-xs">{user.email}</p> : null}
            {roles.length ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {roles.map((r) => (
                  <Badge key={r} variant="neutral">{r}</Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="p-1.5">
          <DropdownMenuItem asChild className="gap-3 px-2.5 py-2">
            <Link to="/profile">
              <UserRoundIcon className="size-4" />
              <span className="flex flex-col">
                <span>{t("layout.yourAccount", "Your account")}</span>
                <span className="text-muted-foreground text-xs">Hồ sơ, mật khẩu, xác thực hai yếu tố</span>
              </span>
            </Link>
          </DropdownMenuItem>
        </div>
        <div className="border-t p-1.5">
          <DropdownMenuItem onClick={() => logout()} className="gap-3 px-2.5 py-2">
            <LogOutIcon className="size-4" />
            <span>{isLoggingOut ? t("buttons.loggingOut", "Logging out…") : t("buttons.logout", "Log out")}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

Header.displayName = "Header";
