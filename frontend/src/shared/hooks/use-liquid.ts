import { useEffect, useLayoutEffect, useRef } from "react";

import { isMotionReduced } from "@/shared/lib/theme";

type Spot = { l: number; t: number; w: number; h: number };
/** Chỗ cuối của nền theo `memory` — dải tab bị dựng lại khi đổi màn (route mới) vẫn trượt từ tab cũ sang. */
const spots = new Map<string, Spot>();

/**
 * Nền trượt kiểu "chất lỏng" cho một dải tab (như thanh chọn của iOS) — lấy từ demo_taichinh (`useLiquid`).
 *
 * Gắn `boxRef` vào khung dải tab (`position: relative`), `indRef` vào một `<span>` nền (`position: absolute`, nằm
 * dưới các tab). Khi `key` đổi (tab khác được chọn): viên trượt nguyên khối sang tab mới, hơi vượt đà rồi dừng, bề
 * rộng đổi êm theo tab đích. Lần đặt đầu và lúc đổi cỡ thì đặt thẳng, không chạy hiệu ứng.
 * Người dùng bật "giảm chuyển động" của hệ điều hành thì nền nhảy thẳng tới chỗ mới.
 */
export function useLiquid<B extends HTMLElement = HTMLElement>(key: unknown, { selector = '[aria-current="page"]', memory }: {
  selector?: string;
  /** Tên dải tab: nhớ chỗ cũ qua các lần dựng lại (mỗi màn một lần dựng). */
  memory?: string;
} = {}) {
  const boxRef = useRef<B>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const last = useRef<Spot | null>(memory ? spots.get(memory) ?? null : null);
  const first = useRef(true);

  const place = (animate: boolean) => {
    const box = boxRef.current;
    const ind = indRef.current;
    if (!box || !ind) return;
    const tab = box.querySelector<HTMLElement>(selector);
    if (!tab || !tab.offsetWidth) {
      // Chưa đo được (khối vừa dựng còn ẩn, chưa vào chỗ): giữ chỗ cũ trong bộ nhớ, đặt khi đo được.
      ind.style.opacity = "0";
      return;
    }
    const l = tab.offsetLeft;
    const t = tab.offsetTop;
    const w = tab.offsetWidth;
    const h = tab.offsetHeight;
    const prev = last.current;
    // Nền đã ở đúng chỗ (đổi cỡ, phông tải xong, StrictMode chạy hiệu ứng lần hai): không đụng vào — đặt lại lúc
    // này sẽ thay `transition` và cắt ngang hiệu ứng đang chạy.
    if (!first.current && prev && prev.l === l && prev.t === t && prev.w === w && prev.h === h) return;
    const dir = !prev ? 0 : Math.sign(l - prev.l) || Math.sign(t - prev.t);
    const reduced = isMotionReduced();
    // Lần đặt ĐẦU TIÊN đo được sau khi dựng lại cũng là một lần đổi tab (có chỗ cũ trong bộ nhớ) → chạy hiệu ứng.
    const moving = (animate || first.current) && dir !== 0 && !reduced;
    // Viên trượt NGUYÊN KHỐI sang tab mới (vị trí hơi vượt đà rồi dừng, bề rộng đổi êm theo tab đích) — không kéo
    // dãn thành một dải phủ qua các tab ở giữa.
    const MOVE = "left .34s cubic-bezier(.3, 1.35, .5, 1), width .45s cubic-bezier(.5, 0, .2, 1), top .3s ease, height .3s ease, opacity .2s";
    const put = (x: Spot) => Object.assign(ind.style, { left: `${x.l}px`, top: `${x.t}px`, width: `${x.w}px`, height: `${x.h}px`, right: "", bottom: "" });
    if (moving && prev && first.current) {
      // Vừa dựng lại: đặt viên ở chỗ cũ trước (không hiệu ứng), ép trình duyệt vẽ, rồi mới cho trượt sang chỗ mới.
      ind.style.transition = "none";
      put(prev);
      void ind.offsetWidth;
    }
    ind.style.transition = moving ? MOVE : "opacity .2s";
    ind.style.opacity = "1";
    put({ l, t, w, h });
    first.current = false;
    last.current = { l, t, w, h };
    if (memory) spots.set(memory, last.current);
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  useLayoutEffect(() => {
    placeRef.current(true);
  }, [key]);

  // Phông chữ tải xong, khung đổi cỡ → đặt lại ngay, không chạy hiệu ứng.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => placeRef.current(false));
    ro.observe(box);
    box.querySelectorAll(":scope > *").forEach((c) => ro.observe(c));
    let alive = true;
    void document.fonts?.ready.then(() => alive && placeRef.current(false));
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);

  return [boxRef, indRef] as const;
}
