import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";


/** Cỡ màn điện thoại (CSS px) — iPhone 13 / 14 / 15, cỡ phổ biến nhất; bố cục co theo đúng ngưỡng màn nhỏ như máy thật. */
const PHONE = { width: 390, height: 844 };

/** Viền vỏ máy hai bên (10 + 10) và phần đỉnh có tai thỏ (24) — cộng vào cỡ màn để ra cỡ cả máy. */
const BEZEL_X = 20;
const BEZEL_Y = 44;

/** Chỉ nhận đường dẫn TRONG hệ thống ("/..."), không nhận "//host" hay địa chỉ ngoài — trang này không thành cửa chuyển hướng. */
function safePath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

/**
 * Xem một màn của hệ thống trong KHUNG ĐIỆN THOẠI, ngay trên máy tính — cho bản chạy demo ở localhost, nơi điện thoại
 * không quét QR vào được. Khung là `iframe` cùng địa chỉ, nên dùng chung phiên đăng nhập với tab đang mở; màn bên trong
 * đúng cỡ máy đã chọn. Chỉ có máy, không tiêu đề hay nút — máy cao hết cửa sổ.
 */
export function MobilePreview() {
  const [params] = useSearchParams();
  const path = safePath(params.get("path"));
  const frame = useRef<HTMLIFrameElement>(null);
  const phone = PHONE;
  // Cửa sổ thấp / hẹp hơn máy thì thu nhỏ CẢ máy theo tỉ lệ — màn bên trong vẫn đúng cỡ máy thật, không bị cắt ngắn.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 24) / (phone.height + BEZEL_Y), (window.innerWidth - 32) / (phone.width + BEZEL_X)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [phone.height, phone.width]);

  return (
    <div className="bg-muted/60 flex min-h-svh items-start justify-center px-4 py-3">
      {path ? (
        // Vỏ máy: viền dày bo tròn, tai thỏ ở đỉnh — chỉ để nhìn ra đây là màn điện thoại.
        <div style={{ width: (phone.width + BEZEL_X) * scale, height: (phone.height + BEZEL_Y) * scale }}>
          <div className="relative origin-top-left rounded-[2.75rem] border-[10px] border-neutral-900 bg-neutral-900 pt-6 shadow-2xl"
            style={{ width: phone.width + BEZEL_X, height: phone.height + BEZEL_Y, transform: `scale(${scale})` }}>
            <span aria-hidden className="absolute top-1 left-1/2 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
            <iframe
              ref={frame}
              title="Giao diện điện thoại"
              src={path}
              className="block rounded-t-xl rounded-b-[2.1rem] bg-white"
              style={{ width: phone.width, height: phone.height }}
            />
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Thiếu đường dẫn màn cần xem.</p>
      )}
    </div>
  );
}
