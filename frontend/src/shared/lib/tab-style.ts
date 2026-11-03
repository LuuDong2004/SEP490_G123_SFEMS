import { cn } from "@/shared/lib/utils";

/**
 * MỘT cỡ cho mọi THANH TAB điều hướng của app — tab phân hệ (`module-tabs`), `Tabs` của shared/ui (Tổng quan trường…),
 * tab trang tính khi nhập dữ liệu. Ngoại lệ có chủ ý: `Segmented` nằm trong thanh công cụ cạnh ô tìm / nút lọc thì gọn
 * hơn (cao 32px) cho cân với các ô đó — vẫn dùng chung màu, viên trượt, chữ. Từng chỗ tự đặt cỡ thì cao 32px chỗ này, 36px chỗ kia, đệm và khoảng
 * cách icon lệch nhau — người dùng chuyển màn thấy tab "nhảy" (góp ý của trưởng nhóm). Thanh tab mới: dùng ba hằng này,
 * không tự đặt `h-*` / `px-*` / `text-*`.
 */

/** Khung chứa các tab: nền xám nhạt, viền, bo tròn, đệm 4px. */
export const TAB_STRIP = "bg-muted/60 relative inline-flex w-fit max-w-full items-center gap-1 rounded-full border p-1";

/** Một tab: cao 36px, đệm ngang 16px, chữ 14px đậm vừa, icon 16px cách chữ 8px; lún nhẹ khi nhấn. */
export const TAB_ITEM = cn(
  "relative z-[1] inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap select-none outline-none",
  "transition-[color,background-color,scale] duration-300 active:scale-[0.96] active:duration-100",
  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

/** Tab chưa chọn. */
export const TAB_IDLE = "text-muted-foreground hover:bg-card/70 hover:text-foreground";

/** Tab đang chọn: chữ trắng sáng lên trễ một nhịp, sau khi viên màu trượt tới. */
export const TAB_ACTIVE = "pill-on-text delay-75";
