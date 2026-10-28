import { useCallback, useEffect, useState } from "react";

/**
 * Chiều cao để một khối lấp đúng phần còn lại của cửa sổ, tính từ mép trên của nó —
 * cho các màn "cột trái + bảng" cao bằng nhau, và đổi số dòng mỗi trang thì bảng cuộn
 * bên trong thay vì đẩy cả trang dài ra.
 *
 * Đo thay vì viết `calc(100svh - Nrem)`: phần phía trên (thanh tab, breadcrumb, tiêu đề,
 * dòng thông báo) cao khác nhau theo màn và theo mật độ giao diện. Chỉ áp từ `minWidth`
 * trở lên — trên màn hẹp hai cột xếp chồng, cao tự nhiên là đúng.
 */
export function useFillHeight(bottomGap = 16, minWidth = 1024, minHeight = 420) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const measure = () => {
      if (window.innerWidth < minWidth) {
        setHeight(undefined);
        return;
      }
      const top = node.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap)));
    };
    measure();
    window.addEventListener("resize", measure);
    // Phần phía trên có thể đổi cao sau lần vẽ đầu (dòng thông báo, chip lọc).
    const observer = new ResizeObserver(measure);
    if (node.parentElement) observer.observe(node.parentElement);
    // Màn vào bằng hiệu ứng trượt lên (`screen-enter`): lần đo đầu rơi vào lúc khối còn bị dịch
    // xuống, nên thấp hụt đúng quãng trượt và để lại một dải trống dưới đáy. Đo lại khi hiệu ứng xong.
    document.addEventListener("animationend", measure);
    return () => {
      document.removeEventListener("animationend", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [node, bottomGap, minWidth, minHeight]);

  return { ref, height };
}
