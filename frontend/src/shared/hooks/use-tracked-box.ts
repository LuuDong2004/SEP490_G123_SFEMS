import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Chuyển động trượt kiểu iOS (trưởng nhóm 13/11/2026: khung chọn trượt mượt "kiểu iPhone") — ra nhanh, hãm êm ở cuối,
 * không nảy; đổi cả vị trí lẫn cỡ. Người dùng bật "giảm chuyển động" thì nhảy thẳng. Gắn cùng `style` của
 * `trackedStyle` cho một thẻ `absolute top-0 left-0` nằm trong khung `relative`.
 */
export const SLIDE_TRANSITION =
  "transition-[transform,width,height,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

export type TrackedBox = { top: number; left: number; width: number; height: number };

/**
 * Vị trí của phần tử khớp `selector` trong `container` (phải là phần tử `relative`), theo toạ độ của `container`. Đo
 * bằng offset chứ không bằng `getBoundingClientRect`: hộp thoại phóng to dần lúc mở, toạ độ màn hình lúc đó bị co lại.
 */
function measure(container: HTMLElement | null, selector: string): TrackedBox | null {
  const el = container?.querySelector<HTMLElement>(selector);
  if (!container || !el) return null;
  let top = 0;
  let left = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * Bám theo phần tử đang chọn để vẽ MỘT khung / vệt chọn trượt tới nó: đo lại khi đổi lựa chọn và khi khung đổi cỡ.
 * Lần đo đầu không trượt (hiện ngay đúng chỗ), các lần sau mới trượt (`animate`). `selector` null = không vẽ.
 */
export function useTrackedBox(container: RefObject<HTMLElement | null>, selector: string | null) {
  const [box, setBox] = useState<TrackedBox | null>(null);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    const update = () => setBox(selector ? measure(container.current, selector) : null);
    update();
    const ro = new ResizeObserver(update);
    if (container.current) ro.observe(container.current);
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(t);
    };
  }, [container, selector]);
  return { box, animate };
}

/** `style` đặt khung trượt lên đúng chỗ của `box`. */
export const trackedStyle = (box: TrackedBox) => ({
  transform: `translate(${box.left}px, ${box.top}px)`,
  width: box.width,
  height: box.height,
});
