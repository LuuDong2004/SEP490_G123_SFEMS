import { useGo, useTranslate } from "@refinedev/core";
import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * What a signed-in user sees when they reach a screen their roles do not cover.
 *
 * Distinct from the 404 in `error-component.tsx` on purpose. The page exists
 * and the address is right; what is missing is a permission, and saying so is
 * the difference between "you mistyped" and "ask an administrator".
 *
 * Reached by typing or bookmarking a URL — the sidebar already hides what it
 * leads to. The API refuses the same request independently, so this is a
 * courtesy, not the boundary.
 */
export function Forbidden({ resource }: { resource?: string }) {
  const go = useGo();
  const t = useTranslate();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        "min-h-[60vh] px-6 text-center",
        "screen-enter"
      )}
    >
      <div className="bg-muted text-muted-foreground rounded-full p-4">
        <ShieldAlertIcon className="size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pages.error.forbiddenTitle", "You do not have access to this page")}
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          {resource
            ? t("pages.error.forbiddenDescriptionResource", { resource }, `Your roles do not include permission to view ${resource}.`)
            : t("pages.error.forbiddenDescription", "Your roles do not include permission to view this page.")}{" "}
          {t("pages.error.forbiddenAskAdmin", "Ask an administrator if you need it.")}
        </p>
      </div>

      <Button variant="outline" onClick={() => go({ to: "/" })}>
        {t("pages.error.forbiddenBack", "Back to the dashboard")}
      </Button>
    </div>
  );
}

Forbidden.displayName = "Forbidden";
