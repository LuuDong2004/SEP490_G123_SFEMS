import { cn } from "@/shared/lib/utils";

/**
 * Dòng nổi khi rê chuột — dùng chung cho MỌI bảng danh sách (DataTable và các bảng tự vẽ: Tổng quan trường, Thiết bị
 * dạng tổng hợp, báo cáo): nhấc lên 2px, bóng đổ + viền màu chính mảnh, nền pha nhẹ màu chính (kể cả ô ghim). Nhấc
 * chứ không phóng to — phóng làm chữ nhoè và xô sang trái. Bật "giảm chuyển động" thì chỉ đổi nền.
 */
export const LIFT_ROW = cn(
  "relative transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
  "hover:z-[2] hover:-translate-y-0.5",
  "hover:shadow-[0_14px_30px_-12px_rgb(0_0_0/.28),0_0_0_1px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
  "hover:[&>td]:!bg-[color-mix(in_srgb,var(--primary)_4%,var(--card))]",
  "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
);
