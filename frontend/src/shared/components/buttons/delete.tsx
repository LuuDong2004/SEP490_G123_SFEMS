"use client";

import React from "react";
import {
  type BaseKey,
  type DeleteOneResponse,
  useDeleteButton,
} from "@refinedev/core";
import { Loader2, Trash } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { ROW_ACTION_ITEM, useRowActionsMenu } from "@/shared/components/data-table/row-actions";
import { AlertDialog, AlertDialogTrigger } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { useScreenName } from "@/shared/hooks/use-screen-name";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type DeleteButtonProps = {
  /**
   * Resource name for API data interactions. `identifier` of the resource can be used instead of the `name` of the resource.
   * @default Inferred resource name from the route
   */
  resource?: string;
  /**
   * Data item identifier for the actions with the API
   * @default Reads `:id` from the URL
   */
  recordItemId?: BaseKey;
  /**
   * Access Control configuration for the button
   * @default `{ enabled: true, hideIfUnauthorized: false }`
   */
  accessControl?: {
    enabled?: boolean;
    hideIfUnauthorized?: boolean;
  };
  /**
   * `meta` property is used when creating the URL for the related action and path.
   */
  meta?: Record<string, unknown>;
  /**
   * Drop the text and render a square icon button. The label is not lost — it
   * moves to a tooltip and to `aria-label`, which is what keeps a row of
   * unlabelled icons usable. Defaults the size to `icon`; pass `size` to pick
   * one of the other square sizes.
   */
  iconOnly?: boolean;
  /**
   * Called once the row is gone.
   *
   * Needed wherever the screen the button sits on is *about* the record that
   * was just deleted — a show page has to navigate away, while a list only has
   * to refetch, which Refine already does. Without this the prop would fall
   * into `...rest` and be spread onto the DOM button, where React would warn
   * about it and nothing would call it.
   */
  onSuccess?: (value: DeleteOneResponse) => void;
  /**
   * Bản ghi sắp xoá — hộp hỏi lại gọi đúng tên nó ("Xoá phòng “P101”?"). Không truyền thì hỏi
   * "Xoá phòng này?".
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record?: any;
  /**
   * Tên gọi loại bản ghi trong câu hỏi, khi nhãn của resource không phải một danh từ ("Mượn - trả",
   * "Bảo hành" là nhãn tab — hỏi "Xoá bảo hành này?" là sai nghĩa; phiếu thì hỏi "Xoá phiếu này?").
   */
  noun?: string;
} & Omit<React.ComponentProps<typeof Button>, "onSuccess">;

export const DeleteButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  DeleteButtonProps
>(({ resource, recordItemId, accessControl, meta, children, iconOnly, onSuccess, record, noun: nounOverride, ...rest }, ref) => {
  const {
    hidden,
    disabled,
    loading,
    onConfirm,
    label,
    confirmOkLabel: defaultConfirmOkLabel,
  } = useDeleteButton({
    resource,
    id: recordItemId,
    accessControl,
    meta,
    onSuccess,
  });
  const menu = useRowActionsMenu();
  const [open, setOpenState] = React.useState(false);
  // Trong menu "⋯": giữ menu mở suốt lúc hộp xác nhận mở, vì đóng menu là gỡ
  // luôn nút này cùng hộp thoại của nó; hộp đóng thì menu đóng theo.
  const setOpen = (o: boolean) => {
    setOpenState(o);
    menu?.hold(o);
  };
  const screen = useScreenName(resource);
  const noun = nounOverride ?? screen.noun;
  const named: string | undefined = record?.name ?? record?.fullName ?? record?.title ?? record?.code ?? record?.username ?? undefined;

  const isDisabled = disabled || rest.disabled || loading;
  const isHidden = hidden || rest.hidden;

  if (isHidden) return null;

  const confirmOkText = defaultConfirmOkLabel;

  const trigger = menu ? (
    <AlertDialogTrigger asChild>
      <Button
        {...rest}
        ref={ref}
        disabled={isDisabled}
        variant="ghost"
        size="sm"
        className={cn(ROW_ACTION_ITEM, "text-destructive hover:bg-destructive-subtle hover:text-destructive", rest.className)}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Trash />}
        {label}
      </Button>
    </AlertDialogTrigger>
  ) : (
    <AlertDialogTrigger asChild>
      {/* The span keeps the trigger clickable while the button is disabled. */}
      <span>
        <Button
          {...rest}
          ref={ref}
          disabled={isDisabled}
          // Icon-only means a table row, where a red button on every row reads
          // as forty warnings rather than one available action — and the row a
          // pointer is actually over is the only one the warning is about. So
          // it is a ghost that goes red on hover and on focus: no less visible
          // at the moment of the click, and no louder before it.
          variant={rest.variant ?? (iconOnly ? "ghost" : "destructive")}
          className={cn(
            iconOnly &&
              !rest.variant && [
                "text-muted-foreground",
                "hover:bg-destructive hover:text-destructive-foreground",
                "focus-visible:bg-destructive focus-visible:text-destructive-foreground",
              ],
            rest.className
          )}
          size={rest.size ?? (iconOnly ? "icon" : undefined)}
          aria-label={rest["aria-label"] ?? (iconOnly ? label : undefined)}
        >
          {loading && (
            <Loader2
              className={cn("h-4 w-4 animate-spin", !iconOnly && "mr-2")}
            />
          )}
          {children ??
            (iconOnly ? (
              !loading && <Trash className="size-4" />
            ) : (
              <div className="flex items-center gap-2 font-semibold">
                <Trash className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
        </Button>
      </span>
    </AlertDialogTrigger>
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {iconOnly && !menu ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <ConfirmContent
        tone="danger"
        title={named ? <>Xoá {noun || "mục"} <span className="break-words">“{named}”</span>?</> : `Xoá ${noun || "mục"} này?`}
        description="Xoá rồi không khôi phục được."
        cancelLabel="Không xoá"
        confirmLabel={confirmOkText}
        busy={loading}
        onConfirm={() => {
          if (typeof onConfirm === "function") onConfirm();
          setOpen(false);
        }}
      />
    </AlertDialog>
  );
});

DeleteButton.displayName = "DeleteButton";
