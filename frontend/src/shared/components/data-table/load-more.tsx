/**
 * Điểm canh CUỐI danh sách cuộn của hộp chọn: gắn `attach` của `useInfiniteScroll` / `useShowMore`; lọt vào tầm nhìn là
 * tải / hiện thêm. Đặt ngay sau bảng, TRONG khung cuộn. Hết dữ liệu thì không vẽ.
 */
export function LoadMore({ attach, hasMore, loading }: { attach: (el: HTMLDivElement | null) => void; hasMore: boolean; loading?: boolean }) {
  if (!hasMore) return null;
  return (
    <div ref={attach} className="text-muted-foreground py-3 text-center text-xs">
      {loading ? "Đang tải thêm…" : "Cuộn để xem thêm"}
    </div>
  );
}
