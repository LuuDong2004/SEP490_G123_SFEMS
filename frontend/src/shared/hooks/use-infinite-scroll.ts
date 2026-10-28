import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tải trang tiếp theo khi người dùng cuộn tới cuối danh sách.
 *
 * <p>Trả về một ref để gắn vào một thẻ trống đặt CUỐI danh sách. Thẻ đó lọt
 * vào khung nhìn nghĩa là người dùng đã cuộn tới đáy, và đó là lúc gọi
 * {@code onLoadMore}.
 *
 * <p>Dùng `IntersectionObserver` chứ không nghe sự kiện `scroll`: sự kiện
 * scroll bắn hàng chục lần mỗi giây và buộc phải tự đo `scrollTop` cộng
 * `clientHeight` cộng `scrollHeight` — ba phép đọc layout mà trình duyệt phải
 * tính lại bố cục để trả lời. Observer chỉ gọi lại đúng lúc trạng thái đổi.
 *
 * <p>`rootMargin` 200px: bắt đầu tải TRƯỚC khi thẻ canh thực sự hiện ra, nên
 * dữ liệu thường về kịp lúc người dùng cuộn tới — cuộn liên tục thay vì cuộn
 * rồi đứng chờ.
 *
 * <p>Hai điều kiện chặn gọi lặp, và cả hai đều cần: `hasMore` để không gọi khi
 * đã hết, `isFetching` để không gọi lần hai khi trang trước còn đang về. Thiếu
 * cái thứ hai thì một lần cuộn tới đáy sẽ bắn liên tiếp mấy request cho cùng
 * một trang.
 */
export function useInfiniteScroll({
  hasMore,
  isFetching,
  onLoadMore,
  rootMargin = "200px",
}: {
  hasMore: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  // Giữ trong ref để observer không phải dựng lại mỗi lần một trong hai cờ
  // đổi — dựng lại observer giữa lúc đang cuộn làm mất lần gọi lại.
  const state = useRef({ hasMore, isFetching, onLoadMore });
  state.current = { hasMore, isFetching, onLoadMore };

  // Thẻ canh giữ trong STATE chứ không trong ref: nó có thể gắn vào DOM SAU lần chạy effect (danh sách
  // trong popover chỉ dựng khi mở ra, mở lần hai thì `hasMore` đã đúng sẵn từ bộ nhớ đệm) — với ref, effect
  // không chạy lại và thẻ canh mới không bao giờ được theo dõi: "Cuộn để tải thêm" đứng im.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((el: HTMLDivElement | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((entry) => entry.isIntersecting);
        if (!seen) return;
        const { hasMore: more, isFetching: busy, onLoadMore: load } = state.current;
        if (more && !busy) load();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
    // Dựng lại khi thẻ canh đổi, và khi một lần tải vừa XONG (`isFetching` về false): nếu thẻ canh vẫn đang
    // trong tầm nhìn (trang vừa tải chưa đủ dài để đẩy nó đi), observer mới báo ngay và tải tiếp — observer
    // cũ thì im, vì với nó trạng thái "đang thấy" chưa hề đổi.
  }, [node, rootMargin, hasMore, isFetching]);

  return attach;
}
