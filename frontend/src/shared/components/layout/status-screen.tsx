import { ArrowLeft, Home, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/ui/button";

/**
 * Khung chung của các màn lỗi (404, 403, 500, 503): mã lỗi chữ lớn màu cảnh báo (cam → đỏ, các chữ số nổi lệch nhịp),
 * dưới là tiêu đề, một câu ngắn và lối ra. Có `retry` (máy chủ không phản hồi, màn gặp lỗi) thì nút chính là "Thử lại";
 * không có thì là "Về Tổng hợp" + "Quay lại".
 */
export function StatusScreen({ code, title, description, retry }: {
  code: string;
  /** Không còn vẽ (mã lỗi hiện bằng chữ số); giữ trong chữ ký cho các chỗ gọi. */
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  /** Lỗi tạm thời: nút "Thử lại" gọi hàm này. */
  retry?: () => void;
}) {
  const navigate = useNavigate();
  const digit =
    "inline-block bg-[linear-gradient(160deg,#f59e0b_0%,#f97316_40%,#dc2626_100%)] bg-clip-text px-[0.02em] pb-[0.08em] text-[clamp(7rem,16vw,12rem)] leading-none font-extrabold text-transparent select-none";
  return (
    <div className="screen-enter flex min-h-[72vh] flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      {/* Mã lỗi chữ lớn; các chữ số nổi lên xuống lệch nhịp — một làn sóng nhẹ chạy qua dãy số. */}
      <div aria-label={code} className="flex items-end">
        {code.split("").map((d, i) => (
          <span key={i} aria-hidden className={`${digit} animate-float-soft`} style={{ animationDelay: `${i * 0.35}s` }}>{d}</span>
        ))}
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {retry ? (
          <>
            <Button type="button" size="lg" onClick={retry}>
              <RotateCw />
              Thử lại
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => navigate("/")}>
              <Home />
              Về Tổng hợp
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="lg" onClick={() => navigate("/")}>
              <Home />
              Về Tổng hợp
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft />
              Quay lại
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
