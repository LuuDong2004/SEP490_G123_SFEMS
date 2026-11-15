import { useEffect } from "react";
import { useSearchParams } from "react-router";

/** Giá trị `?level=` của lựa chọn "Ngoài danh mục tối thiểu". */
export const OUTSIDE = "outside";

/**
 * Cấp học đang xem của màn Danh mục tối thiểu / Số lượng tối thiểu — chọn ở menu xổ của TAB (`meta.tabMenu`), nằm
 * trên địa chỉ trang `?level=TH|THCS|THPT|outside` nên gửi liên kết là mở đúng cấp. Địa chỉ không có cấp, hoặc có cấp
 * tài khoản không thấy (trường chỉ thấy cấp của mình), thì tự ghi lại thành `fallback` để chữ trên tab khớp màn.
 */
export function useLevelParam(levels: { id: number; code: string }[], fallback: string | undefined) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("level");
  const outside = raw === OUTSIDE;
  const level = outside ? undefined : levels.find((l) => l.code === raw);

  useEffect(() => {
    if (!levels.length || outside || level || !fallback) return;
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("level", fallback);
      return next;
    }, { replace: true });
  }, [levels.length, outside, level, fallback, setParams]);

  return { outside, level };
}
