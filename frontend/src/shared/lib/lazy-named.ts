import { lazy, type ComponentType, type LazyExoticComponent } from "react";

import { reloadForStaleChunk } from "./stale-chunk";

/**
 * `React.lazy` cho một export CÓ TÊN: `lazyNamed(() => import("./users/list"), "UserList")`.
 *
 * Màn hình của các feature đi qua đây ở `index.ts` của feature, nên `app/` vẫn chỉ import
 * `@/features/<tên>` mà mỗi thư mục màn thành một chunk riêng, chỉ tải khi mở tới — gói đầu
 * (màn đăng nhập, khung ứng dụng) không phải mang theo lưới nhập Excel, biểu đồ, in tem…
 * Nơi vẽ phải nằm dưới một `<Suspense>` (khung ứng dụng có sẵn một cái quanh `<Outlet />`).
 * Tải chunk lỗi (thường là tab cũ sau một lần triển khai) thì tải lại trang thay vì để trắng —
 * `stale-chunk.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNamed<M extends Record<K, ComponentType<any>>, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<M[K]> {
  return lazy(() =>
    load().then(
      (m) => ({ default: m[name] }),
      (error: unknown) => {
        // Đang tải lại: trả một promise không bao giờ xong để Suspense giữ màn chờ thay vì vẽ lỗi.
        if (reloadForStaleChunk()) return new Promise<never>(() => {});
        throw error;
      },
    ),
  );
}
