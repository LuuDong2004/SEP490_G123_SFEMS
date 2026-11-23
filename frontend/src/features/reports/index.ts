import { lazyNamed } from "@/shared/lib/lazy-named";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const ReportSnapshotList = lazyNamed(() => import("./snapshots"), "ReportSnapshotList");
export const ReportSnapshotShow = lazyNamed(() => import("./snapshots"), "ReportSnapshotShow");
export const Reports = lazyNamed(() => import("./reports"), "Reports");
