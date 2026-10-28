import { cn } from "@/shared/lib/utils";

/**
 * Vòng xoay chờ dùng chung cho toàn hệ thống.
 *
 * <p>Một vòng tròn nền mờ cộng một cung màu thương hiệu quay tròn. Vẽ bằng SVG
 * chứ không bằng viền CSS: `border-top-color` chỉ tô được trọn một phần tư
 * viền nên cung luôn dài đúng 90°, còn `stroke-dasharray` cho phép chọn độ dài
 * cung — và một cung ngắn đọc ra là "đang chạy" rõ hơn một phần tư vòng.
 *
 * <p><b>Màu lấy từ token, không viết cứng.</b> Cung dùng `--primary` nên nó
 * đổi theo mười bộ màu thương hiệu mà người dùng chọn được; nền vòng dùng
 * `--muted` nên nó đúng ở cả chế độ sáng và tối. Viết cứng một mã màu xanh ở
 * đây là tạo ra đúng một chỗ trong hệ thống không nghe theo bộ token.
 *
 * <p>`aria-label` và `role="status"` để trình đọc màn hình nói được là đang
 * chờ; một vòng xoay không có nhãn với người khiếm thị là một trang im lặng.
 */

const SIZES = {
  sm: 16,
  md: 24,
  lg: 40,
  xl: 56,
} as const;

export type SpinnerSize = keyof typeof SIZES;

export function Spinner({
  size = "md",
  className,
  label = "Đang tải",
}: {
  size?: SpinnerSize;
  className?: string;
  /** Nhãn cho trình đọc màn hình. Không hiển thị. */
  label?: string;
}) {
  const px = SIZES[size];
  // Nét dày theo đường kính: một vòng 16px với nét 4px trông như một cục mực,
  // còn vòng 56px với nét 2px thì mảnh đến mức không thấy.
  const stroke = Math.max(2, Math.round(px / 10));
  const r = (px - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex shrink-0", className)}
      style={{ width: px, height: px }}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        className="animate-spin"
        aria-hidden="true"
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted opacity-60"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          // Cung chiếm khoảng một phần tư vòng, phần còn lại để trống.
          strokeDasharray={`${circumference * 0.28} ${circumference}`}
          className="text-primary"
        />
      </svg>
    </span>
  );
}

/**
 * Vòng xoay chiếm cả khung, căn giữa.
 *
 * <p>Dùng khi chưa có gì để hiển thị: một trang đang xác thực, một màn hình
 * đang nạp lần đầu. Khi đã biết hình dạng của nội dung sắp tới thì
 * `Skeleton` nói được nhiều hơn — nó cho thấy trước bố cục — nên vòng xoay
 * dành cho lúc chưa biết gì.
 */
export function PageSpinner({
  className,
  label = "Đang tải",
  size = "lg",
}: {
  className?: string;
  label?: string;
  size?: SpinnerSize;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 w-full flex-1 items-center justify-center",
        className
      )}
    >
      <Spinner size={size} label={label} />
    </div>
  );
}

/**
 * Vòng xoay giữa màn hình, chiếm toàn bộ chiều cao khung nhìn.
 *
 * <p>Dành cho lúc vỏ ứng dụng còn chưa dựng — phiên đang được kiểm tra, quyền
 * đang được đọc. Nền lấy từ `--background` nên nó không nháy trắng khi người
 * dùng đang ở chế độ tối.
 */
export function FullPageSpinner({ label = "Đang tải" }: { label?: string }) {
  return (
    <div className="bg-background flex h-screen w-full items-center justify-center">
      <Spinner size="xl" label={label} />
    </div>
  );
}
