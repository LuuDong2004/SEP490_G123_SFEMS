import { useCallback, useEffect, useState, type SetStateAction } from "react";

/**
 * `useState` nhớ qua tải lại trang và qua lần chuyển menu.
 *
 * - `local`: sở thích của người dùng (dạng xem cây / khối) — giữ lâu dài.
 * - `session`: chỗ đang đứng (tầng đang mở, trang, ô tìm) — giữ trong tab này,
 *   mất khi đóng tab, để lần mở sau bắt đầu từ đầu thay vì từ một chỗ đã quên.
 *
 * Bộ nhớ trình duyệt có thể bị chặn (trình duyệt riêng tư, chính sách máy) — lúc
 * đó hook chạy như `useState` thường, không bao giờ làm vỡ màn hình.
 *
 * Khoá đổi (cùng một instance chuyển từ danh mục này sang danh mục khác) thì giá
 * trị được đọc lại từ khoá MỚI — giữ giá trị cũ là ghi đè nó sang khoá mới.
 */
export function usePersistentState<T>(key: string, initial: T, where: "local" | "session" = "session") {
  const storage = () => (where === "local" ? window.localStorage : window.sessionStorage);
  const read = (k: string): T => {
    try {
      const raw = storage().getItem(k);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  };
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: read(key) }));
  let current = state;
  if (state.key !== key) {
    // Cập nhật ngay trong lúc vẽ (mẫu "trạng thái suy từ prop" của React): lần vẽ này đã dùng giá trị đúng.
    current = { key, value: read(key) };
    setState(current);
  }
  const setValue = useCallback(
    (next: SetStateAction<T>) =>
      setState((s) => ({ key: s.key, value: typeof next === "function" ? (next as (prev: T) => T)(s.value) : next })),
    [],
  );
  useEffect(() => {
    try {
      storage().setItem(current.key, JSON.stringify(current.value));
    } catch {
      // bộ nhớ bị chặn hoặc đầy — giữ trong bộ nhớ React là đủ
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key, current.value]);
  return [current.value, setValue] as const;
}
