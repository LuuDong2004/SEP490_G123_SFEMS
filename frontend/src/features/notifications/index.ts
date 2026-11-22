import { lazyNamed } from "@/shared/lib/lazy-named";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const NotificationList = lazyNamed(() => import("./list"), "NotificationList");
