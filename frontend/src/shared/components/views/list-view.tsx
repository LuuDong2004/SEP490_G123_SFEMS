"use client";

import { createContext, useCallback, useContext, useState, type PropsWithChildren, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { BaseRecord, HttpError } from "@refinedev/core";
import { useResourceParams, useTranslate, useUserFriendlyName } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { DataTableMoreActions } from "@/shared/components/data-table/data-table-actions";
import { CreateButton } from "@/shared/components/buttons/create";
import { cn } from "@/shared/lib/utils";

type ListViewProps = PropsWithChildren<{
  className?: string;
}>;

/**
 * Chỗ đặt nút của tiêu đề (Thêm mới…) TRONG hàng công cụ của bảng. Màn là một tab của phân hệ thì
 * tiêu đề ẩn đi (thanh tab đã gọi tên màn) — để nút Thêm mới đứng trơ một hàng riêng là phí chỗ, nên
 * `ListViewHeader` đưa nó (qua portal) vào cuối hàng công cụ của `ListToolbar`, cạnh Cột / Cài đặt.
 * Màn không có `ListToolbar` thì nút vẫn ở hàng tiêu đề như cũ.
 */
const ListActionsSlot = createContext<{ slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void } | null>(null);

/**
 * Thứ một MÀN muốn đặt vào hàng công cụ của bảng thay vì chiếm riêng một hàng phía trên: `lead`
 * đứng ngay sau ô tìm (nút chọn chế độ xem, chip "Đang xem"), `trail` đứng đầu cụm bên phải (nút của màn).
 * `ListToolbar` tự vẽ cả hai; bảng tự dựng hàng công cụ (bảng tổng hợp) dùng `ToolbarLead` /
 * `ToolbarTrail`.
 */
type ToolbarExtrasValue = {
  lead?: ReactNode;
  trail?: ReactNode;
  /** Lối phụ của màn, là các `DropdownMenuItem` — vào menu bánh răng thay vì thành một dãy nút biểu tượng. */
  menu?: ReactNode;
};
const ToolbarExtras = createContext<ToolbarExtrasValue>({});

export function ToolbarExtrasProvider({ lead, trail, menu, children }: PropsWithChildren<ToolbarExtrasValue>) {
  return <ToolbarExtras.Provider value={{ lead, trail, menu }}>{children}</ToolbarExtras.Provider>;
}
export const useToolbarMenu = () => useContext(ToolbarExtras).menu;
/** Cho bảng muốn THÊM mục của riêng nó vào những gì màn đã đặt: đọc ra, bọc lại bằng `ToolbarExtrasProvider`. */
export const useToolbarExtras = () => useContext(ToolbarExtras);
/** Chỗ trong hàng công cụ (ngay sau ô tìm) để cột lọc bên trái đưa ô lọc của nó lên — xem `TOOLBAR_FILTER_SLOT`. */
export const TOOLBAR_FILTER_SLOT = "toolbar-filter-slot";
export const ToolbarLead = () => (
  <>
    <span id={TOOLBAR_FILTER_SLOT} className="contents" />
    {useContext(ToolbarExtras).lead}
  </>
);
export const ToolbarTrail = () => <>{useContext(ToolbarExtras).trail}</>;

export function ListView({ children, className }: ListViewProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <ListActionsSlot.Provider value={{ slot, setSlot }}>
    <div
      className={cn(
        "flex flex-col",
        "gap-4",
        // Screen entrance. Lives here rather than on a route wrapper so
        // it fires when a screen actually mounts — opening a route dialog
        // over a list leaves the list, and its animation, alone.
        "screen-enter screen-enter-stagger",
        className
      )}
    >
      {children}
    </div>
    </ListActionsSlot.Provider>
  );
}

type ListHeaderProps = PropsWithChildren<{
  resource?: string;
  title?: string;
  canCreate?: boolean;
  /** Extra controls beside Create — export, a bulk action, a view switch. */
  actions?: ReactNode;
  headerClassName?: string;
  wrapperClassName?: string;
}>;

export const ListViewHeader = ({
  canCreate,
  resource: resourceFromProps,
  title: titleFromProps,
  actions,
  wrapperClassName,
  headerClassName,
}: ListHeaderProps) => {
  const getUserFriendlyName = useUserFriendlyName();
  const translate = useTranslate();

  const { resource, identifier, resources } = useResourceParams({
    resource: resourceFromProps,
  });
  const resourceName = identifier ?? resource?.name;

  const isCreateButtonVisible = canCreate ?? !!resource?.create;

  const title =
    titleFromProps ??
    translate(
      `${identifier ?? resource?.name}.titles.list`,
      getUserFriendlyName(
        resource?.meta?.label ?? identifier ?? resource?.name,
        "plural"
      )
    );

  const hasActions = isCreateButtonVisible || actions;
  const slotCtx = useContext(ListActionsSlot);
  // Màn là một TAB của phân hệ (cha mang `meta.module` — phân hệ nghiệp vụ hay nhóm danh mục dùng
  // chung): thanh tab ngay trên đã gọi tên nó, tiêu đề to lặp lại lần nữa chỉ chiếm chỗ — giữ cho
  // trình đọc màn hình, ẩn khỏi mắt. Trang Quy trình (`meta.process`) vẫn hiện tiêu đề của nó.
  const parentName = resource?.meta?.parent as string | undefined;
  const inModule = !!resources.find((r) => r.name === parentName)?.meta?.module;
  const hideTitle = !resource?.meta?.process && (inModule || (!titleFromProps && !!resource?.meta?.tabLabel));

  const actionNodes = hasActions ? (
    <>
      {actions}
      {isCreateButtonVisible && <CreateButton resource={resourceName} />}
    </>
  ) : null;

  // Tiêu đề ẩn và bảng có hàng công cụ: nút đi vào hàng công cụ, không chiếm một hàng riêng.
  // Tiêu đề ẩn mà cũng không có nút nào: không vẽ hàng — một hàng rỗng vẫn ăn hai lần `gap` của màn.
  if (hideTitle && (slotCtx?.slot || !actionNodes)) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {actionNodes && slotCtx?.slot ? createPortal(actionNodes, slotCtx.slot) : null}
      </>
    );
  }

  return (
    <div className={cn("flex flex-col", "gap-3", wrapperClassName)}>
      {/*
        Không có dòng phụ đề dưới tiêu đề — đã bỏ vì mọi màn đều lặp lại điều
        tên màn và cột bảng đã nói. Giải thích nghiệp vụ nằm ở trang Quy trình.
      */}
      <div
        className={cn(
          "flex",
          "flex-wrap",
          "items-start",
          "justify-between",
          "gap-x-4 gap-y-3",
          headerClassName
        )}
      >
        <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
          <h1 className="truncate text-3xl font-bold leading-9 tracking-tight">
            {title}
          </h1>
        </div>
        {hasActions && (
          <div data-print="hide" className={cn("flex shrink-0 items-center gap-2", hideTitle && "ms-auto")}>
            {actionNodes}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The row between the page header and the table.
 *
 * Three zones, and the split is the point:
 *
 *   `search`   takes the room. It is what gets typed into.
 *   `filters`  sits immediately beside it, because narrowing the table is the
 *              same job as searching it and the two belong to one another.
 *   `actions`  goes against the right edge — refresh, columns, export. These
 *              act on the table as a whole rather than on what it contains, so
 *              they are found rather than reached for, and grouping them apart
 *              is what stops a row of six controls reading as one undifferentiated
 *              strip.
 *
 * Inside that right cluster the screen's own action (Thêm mới / Lập phiếu, portaled
 * in from `ListViewHeader`) comes FIRST — việc chính của màn không đứng sau hai nút
 * tác động lên cái bảng.
 *
 * Pass `table` and the three standard actions come for free, in that order on
 * every list. `actions` is for the one-off beside them — Notifications' "Mark
 * all read" — and lands to their left.
 *
 * `basis-72` is what makes the row wrap rather than crush: below that width the
 * search takes its own line and the controls drop under it.
 */
export function ListToolbar<TData extends BaseRecord>({
  table,
  search,
  filters,
  actions,
  className,
  searchClassName,
}: {
  /** Enables the standard Refresh / Columns / Export cluster. */
  table?: UseTableReturnType<TData, HttpError>;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Bề rộng ô tìm của riêng màn (vd. `sm:max-w-sm`) khi hàng công cụ còn nhiều nút cần chỗ. */
  searchClassName?: string;
}) {
  const extras = useContext(ToolbarExtras);
  const hasActions = Boolean(actions) || Boolean(table) || Boolean(extras.trail);
  const slotCtx = useContext(ListActionsSlot);
  const setSlot = slotCtx?.setSlot;
  // Ô nhận nút của tiêu đề (xem `ListActionsSlot`); gỡ khi bảng rời màn.
  const slotRef = useCallback((el: HTMLElement | null) => setSlot?.(el), [setSlot]);
  if (!search && !filters && !hasActions && !slotCtx) return null;

  return (
    <div
      data-print="hide"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {search && (
        <div className={cn("min-w-0 flex-1 sm:max-w-xl", extras.lead ? "basis-40" : "basis-72", searchClassName)}>{search}</div>
      )}
      {/* Ô tìm đứng đầu hàng, bên trái — như mọi danh sách khác; nút chọn chế độ xem ngay sau nó. */}
      <ToolbarLead />
      {filters}
      {hasActions || slotCtx ? (
        // Right-aligned only once the row actually holds everything on one
        // line. Wrapped, `ms-auto` would strand the controls against the right
        // edge on their own line with nothing opposite them.
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {/* Nút của màn đứng ĐẦU cụm, trước Chọn cột và Thao tác khác: nó là việc người ta tới màn
              này để LÀM, còn hai nút kia tác động lên cái bảng — việc chính không đứng sau. */}
          {slotCtx ? <span ref={slotRef} className="contents" /> : null}
          {extras.trail}
          {actions}
          {/* Một nút bánh răng cho mọi thứ tác động lên CÁI BẢNG (làm mới, cột, nhập / xuất) và các
              lối phụ của màn — hàng công cụ chỉ còn ô tìm, chế độ xem, việc chính, và nút này. */}
          {table && <DataTableMoreActions table={table} extraItems={extras.menu} />}
        </div>
      ) : null}
    </div>
  );
}

ListToolbar.displayName = "ListToolbar";

ListView.displayName = "ListView";
