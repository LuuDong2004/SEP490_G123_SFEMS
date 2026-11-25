import { useDataProvider, type BaseRecord, type CrudFilter } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";

const STEP = 200;

/**
 * Đọc MỌI dòng của một resource, từng trang một, cho hộp chọn phải lọc tiếp ở trình duyệt. `useList` với một cỡ trang cố
 * định thì dòng vượt quá cỡ đó mất mà không báo.
 */
export function useAllRows<T extends BaseRecord>(resource: string, filters: CrudFilter[], enabled: boolean) {
  const dataProvider = useDataProvider();
  return useQuery({
    queryKey: [resource, "all-rows", filters],
    enabled,
    retry: false,
    // Mở hộp là đọc lại: phiếu vừa lập ở màn khác phải có mặt, khoá này nằm ngoài lượt làm mới của Refine.
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const all: T[] = [];
      for (let page = 1; ; page++) {
        const res = await dataProvider().getList<T>({
          resource, filters, pagination: { currentPage: page, pageSize: STEP, mode: "server" }, meta: { signal },
        });
        all.push(...res.data);
        if (res.data.length < STEP || all.length >= res.total) return all;
      }
    },
  });
}
