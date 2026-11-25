"use client";

import { cn } from "@/shared/lib/utils";
import {
  useBack,
  useResourceParams,
  useUserFriendlyName,
  useTranslate,
} from "@refinedev/core";
import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { ArrowLeftIcon } from "lucide-react";

type CreateViewProps = PropsWithChildren<{
  className?: string;
}>;

export function CreateView({ children, className }: CreateViewProps) {
  return (
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
  );
}

type CreateHeaderProps = PropsWithChildren<{
  /** Nút quay lại đi tới đâu — mặc định lùi lịch sử trình duyệt; form phiếu ghi tăng về danh sách. */
  onBack?: () => void;
  resource?: string;
  title?: string;
  /** Cạnh tiêu đề: trạng thái, bước của phiếu… — nhỏ, cùng hàng. */
  meta?: ReactNode;
  /** Nút của trang (Lưu nháp, Trình…) — dồn về tay phải, cùng hàng tiêu đề. */
  actionsSlot?: ReactNode;
  wrapperClassName?: string;
  headerClassName?: string;
}>;

export const CreateViewHeader = ({
  onBack,
  resource: resourceFromProps,
  title: titleFromProps,
  meta,
  actionsSlot,
  wrapperClassName,
  headerClassName,
}: CreateHeaderProps) => {
  const back = useBack();

  const getUserFriendlyName = useUserFriendlyName();
  const translate = useTranslate();

  const { resource, identifier } = useResourceParams({
    resource: resourceFromProps,
  });

  // Singular, like `ShowViewHeader` and unlike `ListViewHeader`: this screen is
  // about the one record being written, not about the collection. The plural it
  // used to ask for went unnoticed only because no page rendered this header.
  const title =
    titleFromProps ??
    translate(
      `${identifier ?? resource?.name}.titles.create`,
      getUserFriendlyName(
        resource?.meta?.label ?? identifier ?? resource?.name,
        "singular"
      )
    );

  return (
    <div className={cn("flex flex-col", "gap-4", wrapperClassName)}>
      <div
        className={cn(
          "flex",
          "gap-1",
          "items-center",
          "-ml-2.5",
          headerClassName
        )}
      >
        <Button type="button" data-print="hide" variant="ghost" size="icon" onClick={onBack ?? back} aria-label="Quay lại">
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-xl leading-7 font-bold tracking-tight break-words sm:text-2xl sm:leading-8">{title}</h1>
          {meta ? <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">{meta}</div> : null}
        </div>
        {actionsSlot ? (
          <div data-print="hide" className="ms-auto flex max-w-full flex-wrap items-center justify-end gap-2">{actionsSlot}</div>
        ) : null}
      </div>
    </div>
  );
};

CreateView.displayName = "CreateView";
