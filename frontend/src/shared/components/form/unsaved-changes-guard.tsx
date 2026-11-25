"use client";

import * as React from "react";
import { useTranslate, useWarnAboutChange } from "@refinedev/core";
import {
  UNSAFE_NavigationContext,
  useLocation,
  type Navigator,
} from "react-router";

import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { useScreenName } from "@/shared/hooks/use-screen-name";

/**
 * Something the user asked for that would lose the edits they have made, held
 * until the dialog is answered.
 *
 * `run` closes over the *original* `push` / `go` — or, for a caller that came in
 * through `useConfirmDiscard`, over whatever that caller wanted to do — so
 * letting it through is a plain call rather than a dance with the effect that
 * installed the patch.
 */
type PendingAction = {
  run: () => void;
};

/**
 * Ask before discarding, from a place the history navigator cannot see.
 *
 * `null` when the guard is not mounted above the caller, which is what makes
 * `useConfirmDiscard` degrade to running the action straight through rather
 * than throwing.
 */
const ConfirmDiscardContext = React.createContext<
  ((run: () => void) => void) | null
>(null);

/**
 * Run something, but ask first if the form on screen has unsaved edits.
 *
 * For the dismissals the guard cannot recognise on its own. It watches the
 * history navigator's `push` and `go`, which covers every ordinary navigation —
 * but not `replace`, which is deliberately left alone (see the guard below). A
 * dialog that *is* a route dismisses with `replace`, so `route-dialog.tsx` says
 * so explicitly rather than hoping to be guessed at.
 */
export function useConfirmDiscard() {
  const confirm = React.useContext(ConfirmDiscardContext);
  return React.useMemo(() => confirm ?? ((run: () => void) => run()), [confirm]);
}

/**
 * Màn đang mở khai thêm cho hộp hỏi khi rời màn (trưởng nhóm 14/11/2026, phiếu ghi tăng):
 * - `save`: có thì hộp có nút "Lưu nháp" — lưu rồi đi tiếp; trả `false` (lưu hỏng) thì ở lại.
 * - `discard`: việc phải làm khi người dùng chọn thoát không lưu (vd. xoá phiếu nháp hệ thống vừa lập sẵn).
 * - `force`: hỏi cả khi form chưa sửa gì (phiếu hệ thống vừa lập sẵn, người dùng chưa quyết lưu). Hàm — đọc lúc
 *   rời màn, nên màn đổi ý (vừa lưu xong) là có tác dụng ngay, không đợi vẽ lại.
 */
export type LeaveOptions = {
  save?: () => Promise<boolean>;
  discard?: () => Promise<void> | void;
  force?: () => boolean;
  title?: React.ReactNode;
  message?: React.ReactNode;
};

const LeaveOptionsContext = React.createContext<((options: LeaveOptions | null) => void) | null>(null);

/** Khai lựa chọn rời màn cho màn đang mở; gỡ khi màn đóng. */
export function useLeaveOptions(options: LeaveOptions | null) {
  const register = React.useContext(LeaveOptionsContext);
  const latest = React.useRef(options);
  latest.current = options;
  const active = options != null;
  React.useEffect(() => {
    if (!register || !active) return;
    // Bọc qua ref: màn vẽ lại không phải khai lại, guard luôn gọi bản mới nhất.
    register({
      save: latest.current?.save ? () => latest.current?.save?.() ?? Promise.resolve(false) : undefined,
      discard: () => latest.current?.discard?.(),
      force: () => latest.current?.force?.() ?? false,
      get title() { return latest.current?.title; },
      get message() { return latest.current?.message; },
    });
    return () => register(null);
  }, [register, active]);
}

type UnsavedChangesGuardProps = React.PropsWithChildren<{
  /** Overrides the heading. */
  title?: React.ReactNode;
  /**
   * Overrides the body text. Defaults to the `warnWhenUnsavedChanges`
   * translation key, so an `i18nProvider` can still supply it.
   */
  message?: React.ReactNode;
  /** Label of the button that abandons the changes. */
  discardLabel?: React.ReactNode;
  /** Label of the button that keeps the user where they are. */
  stayLabel?: React.ReactNode;
}>;


/**
 * What `@refinedev/react-router`'s `UnsavedChangesNotifier` does, asked with the
 * application's own dialog.
 *
 * Refine answers `options.warnWhenUnsavedChanges` with `window.confirm` — a
 * browser chrome dialog that carries the page's origin, ignores the theme, and
 * offers "OK" / "Cancel" for a decision about losing work.
 *
 * The mechanism has to stay the same, though. `App.tsx` mounts a
 * `<BrowserRouter>` rather than a data router, so `useBlocker` does not exist
 * here; the only place to intervene is the history `navigator`, whose `push`
 * and `go` are synchronous and expect an answer *now*. A dialog cannot answer
 * synchronously — so instead of asking, this refuses the navigation outright,
 * keeps the call in `pending`, and replays it if the user says to leave.
 *
 * **`replace` is not patched, and must not be.** It is not the user saying "go
 * somewhere else": `useTable`'s `syncWithLocation` writes filters, sorting and
 * pagination back to the URL with it from inside an effect, and every
 * `<Navigate replace>` redirect in `routes.tsx` uses it too. Patching it would
 * put this dialog in front of a session that just expired, and in front of a
 * list quietly syncing its own query string behind an open dialog. The one
 * `replace` that genuinely is the user's decision — dismissing a `RouteDialog` —
 * asks through `useConfirmDiscard` instead, which is a call somebody wrote
 * rather than a class of navigation guessed at.
 *
 * Closing the tab still gets the browser's own dialog: `beforeunload` is the one
 * prompt no page may style or replace, and browsers stopped honouring a custom
 * message years ago precisely so a page could not dress it up.
 */
export function UnsavedChangesGuard({
  children,
  title,
  message,
  discardLabel,
  stayLabel,
}: UnsavedChangesGuardProps) {
  const translate = useTranslate();
  const { pathname } = useLocation();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [leave, setLeave] = React.useState<LeaveOptions | null>(null);
  const leaveRef = React.useRef(leave);
  leaveRef.current = leave;
  const [saving, setSaving] = React.useState(false);
  // Hộp hỏi gọi đúng tên màn đang mở và phân biệt đang NHẬP MỚI hay đang SỬA.
  const screen = useScreenName();
  const editing = screen.action === "edit";

  // `useWarnAboutChange` only returns the context's own setter while Refine's
  // provider is above us; without it the hook builds a fresh no-op every render.
  // Reaching both values through refs is what keeps the effects below keyed on
  // what they are actually about, and `hold` stable enough to hand to consumers.
  const warnWhenRef = React.useRef(warnWhen);
  warnWhenRef.current = warnWhen;
  const setWarnWhenRef = React.useRef(setWarnWhen);
  setWarnWhenRef.current = setWarnWhen;

  // Raised while the held action is replayed, so the patch below lets it past
  // instead of holding it a second time and reopening the dialog.
  const replaying = React.useRef(false);

  const hold = React.useCallback((run: () => void) => {
    if (replaying.current || !(warnWhenRef.current || leaveRef.current?.force?.())) {
      run();
      return;
    }
    // A second attempt while the dialog is up must not overwrite the first — the
    // user is answering about that one.
    setPending((current) => current ?? { run });
  }, []);

  // Refine's own notifier clears the flag whenever the route changes; a form
  // left behind must not go on warning about the page that replaced it.
  React.useEffect(() => {
    return () => setWarnWhenRef.current?.(false);
  }, [pathname]);

  // Leaving the application entirely. The browser owns this one.
  React.useEffect(() => {
    if (!warnWhen) return;

    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigning it is what still triggers the prompt in older browsers; the
      // string itself has been ignored by all of them for years.
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [warnWhen]);

  // Navigating inside the application. Màn khai `force` thì cài sẵn — `hold` tự quyết có hỏi không.
  const watching = warnWhen || !!leave?.force;
  React.useEffect(() => {
    if (!watching) return;

    const { push, go } = navigator;

    navigator.push = (...args: Parameters<Navigator["push"]>) => {
      hold(() => push(...args));
    };
    navigator.go = (...args: Parameters<Navigator["go"]>) => {
      hold(() => go(...args));
    };

    return () => {
      navigator.push = push;
      navigator.go = go;
    };
  }, [navigator, watching, hold]);

  const replay = (run: (() => void) | undefined) => {
    if (!run) return;
    replaying.current = true;
    try {
      run();
    } finally {
      replaying.current = false;
    }
  };

  /** "Lưu nháp": lưu bằng hàm màn khai; lưu được thì đi tiếp, hỏng thì ở lại (màn tự báo lỗi). */
  const saveAndLeave = async () => {
    const run = pending?.run;
    const save = leaveRef.current?.save;
    if (!save) return;
    setSaving(true);
    try {
      const ok = await save();
      if (!ok) {
        setPending(null);
        return;
      }
      setPending(null);
      setWarnWhenRef.current?.(false);
      replay(run);
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    const run = pending?.run;
    setPending(null);
    setWarnWhenRef.current?.(false);
    try {
      await leaveRef.current?.discard?.();
    } catch {
      // Việc dọn dẹp hỏng không giữ người dùng lại màn này.
    }
    if (!run) return;

    // That state has not flushed yet, so the patch is still installed and `run`
    // may well go straight back through it.
    replaying.current = true;
    try {
      run();
    } finally {
      replaying.current = false;
    }
  };

  return (
    <ConfirmDiscardContext.Provider value={hold}>
      <LeaveOptionsContext.Provider value={setLeave}>
      {children}
      </LeaveOptionsContext.Provider>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          // `Esc` is the same answer as the cancel button: stay, and drop what
          // was being held.
          if (!open) setPending(null);
        }}
      >
        {leave?.save ? (
          // Màn có lưu nháp: ba lựa chọn — ở lại · thoát không lưu · lưu nháp rồi thoát.
          <ConfirmContent
            tone="warning"
            title={leave.title ?? title ?? (screen.title ? `Lưu nháp trước khi thoát khỏi màn “${screen.title}”?` : "Lưu nháp trước khi thoát?")}
            description={leave.message ?? message ?? "Thông tin đang nhập chưa được lưu. Lưu nháp để làm tiếp sau, hoặc thoát và bỏ những gì vừa nhập."}
            cancelLabel={stayLabel ?? (editing ? "Tiếp tục sửa" : "Tiếp tục nhập")}
            secondary={{ label: discardLabel ?? "Thoát, không lưu", onClick: () => void discard(), destructive: true }}
            confirmLabel="Lưu nháp"
            busy={saving}
            keepOpen
            onConfirm={() => void saveAndLeave()}
          />
        ) : (
          <ConfirmContent
            tone="warning"
            title={title ?? (screen.title ? `Thoát khỏi màn “${screen.title}”?` : translate("unsavedChangesTitle", "Thoát mà không lưu?"))}
            description={message ?? (editing
              ? "Những gì vừa sửa chưa được lưu. Thoát bây giờ thì mất các thay đổi đó."
              : "Thông tin đang nhập chưa được lưu. Thoát bây giờ thì phải nhập lại từ đầu.")}
            cancelLabel={stayLabel ?? (editing ? "Tiếp tục sửa" : "Tiếp tục nhập")}
            confirmLabel={discardLabel ?? "Thoát, không lưu"}
            destructive
            onConfirm={() => void discard()}
          />
        )}
      </AlertDialog>
    </ConfirmDiscardContext.Provider>
  );
}

UnsavedChangesGuard.displayName = "UnsavedChangesGuard";
