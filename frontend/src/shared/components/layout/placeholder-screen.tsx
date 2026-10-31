import { useResourceParams, useTranslate } from "@refinedev/core";
import { Construction } from "lucide-react";

/**
 * Trang GIỮ CHỖ "Tính năng đang phát triển" cho một màn hình chưa dựng. Menu, route, resource và
 * quyền đã khai sẵn ở `app/resources` và `app/router/routes.tsx`; người phụ trách chỉ việc thay
 * phần tử này bằng component thật của mình trong `routes.tsx`, không đụng tới menu.
 */
export function PlaceholderScreen({ note }: { note?: string } = {}) {
  const { resource } = useResourceParams();
  const t = useTranslate();
  const name = resource?.name ?? "";
  const label = (resource?.meta?.label as string | undefined) ?? t(`${name}.${name}`, name);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Construction className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-xl font-semibold">Tính năng đang phát triển</h1>
      <p className="text-muted-foreground text-sm">{label}</p>
      {note ? <p className="text-muted-foreground max-w-prose text-sm">{note}</p> : null}
    </div>
  );
}
