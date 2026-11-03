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
  /** Vòng quanh logo ở màn chờ toàn trang. */
  "2xl": 112,
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
  // Nét dày theo đường kính (~1/16, làm tròn nửa pixel): 16–24px → 1,5px, 40px → 2,5px, 56px → 3,5px, vòng màn chờ
  // 112px → 7px. Dày hơn (1/9 trước đây) trông nặng như cục mực; mảnh hơn 1,5px thì vòng nhỏ không thấy.
  const stroke = Math.max(1.5, Math.round((px / 16) * 2) / 2);
  // Vòng chuyển sắc kiểu iOS: một dải màu chính đậm dần về đầu cung, phần đuôi tan vào nền — quay với nhịp
  // nhanh-chậm (không đều) nên trông "sống" hơn vòng quay đều. Mặt nạ tròn khoét giữa thành vòng.
  const ring = `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke - 0.5}px))`;
  return (
    <span role="status" aria-label={label} className={cn("relative inline-flex shrink-0", className)} style={{ width: px, height: px }}>
      {px >= 40 ? <span aria-hidden className="bg-primary/20 animate-breathe absolute -inset-2 rounded-full blur-md" /> : null}
      <span aria-hidden className="bg-muted/70 absolute inset-0 rounded-full" style={{ mask: ring, WebkitMask: ring }} />
      <span aria-hidden className="animate-orbit absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--primary) 15%, transparent) 90deg, var(--primary) 340deg, transparent 341deg)",
          mask: ring,
          WebkitMask: ring,
        }} />
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
  // Logo Sở giữa một vòng chuyển sắc đang quay — màn chờ lúc vỏ ứng dụng chưa dựng không còn là một vòng xoay trơn.
  return (
    <div className="bg-background flex h-screen w-full flex-col items-center justify-center gap-5">
      <div className="relative flex size-28 items-center justify-center">
        <Spinner size="2xl" label={label} className="absolute inset-0" />
        <img src="/logo-so-gddt-hcm.png" alt="" className="relative size-[4.5rem] rounded-full bg-white object-contain p-1 shadow-e2" />
      </div>
      <p className="text-muted-foreground animate-pulse text-sm font-medium tracking-wide">{label}…</p>
    </div>
  );
}
