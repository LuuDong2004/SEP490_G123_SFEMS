import { useTranslate } from "@refinedev/core";
import { ShieldAlert } from "lucide-react";

import { StatusScreen } from "@/shared/components/layout/status-screen";

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
// `resource` giữ trong chữ ký cho các chỗ gọi cũ; câu phụ không còn nêu tên màn (là mã kỹ thuật, vd. data_imports).
export function Forbidden(props: { resource?: string }) {
  void props;
  const t = useTranslate();
  return (
    <StatusScreen code="403" icon={<ShieldAlert />}
      title={t("pages.error.forbiddenTitle", "You do not have access to this page")}
      description={t("pages.error.forbiddenAskAdmin", "Ask an administrator if you need it.")} />
  );
}

Forbidden.displayName = "Forbidden";
