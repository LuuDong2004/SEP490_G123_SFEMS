import { useCan, useCustom } from "@refinedev/core";
import { ChevronRight, Search } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import { FillBox } from "@/shared/components/layout/fill-box";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { customResult } from "@/shared/hooks/use-custom-result";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { Spinner } from "@/shared/components/spinner";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";
import { API_URL } from "@/shared/api/constants";
import { kyInstance } from "@/shared/api/data";
import {
  BodyGrid,
  SchoolGrid,
  bodyTone,
  type BodyStats,
} from "@/features/organization/explorer/body-grid";
import {
  KpiRow,
  type SchoolStats,
} from "@/features/organization/explorer/panels";
import {
  ManagingBodyBranch,
  nodeKey,
  SchoolBranch,
  TREE_NAME_OFFSET,
  TreeStatsHeader,
  type TreeNode,
} from "@/features/organization/explorer/tree";
import { SchoolDialog } from "@/features/organization/schools/school-dialog";
import { SchoolViewSwitch } from "@/features/organization/schools/school-view-switch";
import { SchoolWorkspace } from "@/features/organization/explorer/school-workspace";

type Overview = {
  /** MỘT trang, không phải toàn bộ. */
  schools: SchoolStats[];
  /** Gộp trên toàn phạm vi, không phải của trang. */
  totals: SchoolStats;
  /** Tổng số trường trong phạm vi, để biết còn bao nhiêu chưa tải. */
  total: number;
};

type SortKey = "name" | "schools" | "equipment" | "broken" | "rooms" | "staff";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Xếp theo tên" },
  { value: "schools", label: "Nhiều trường nhất" },
  { value: "equipment", label: "Nhiều thiết bị nhất" },
  { value: "broken", label: "Nhiều hỏng, kém nhất" },
  { value: "rooms", label: "Nhiều phòng nhất" },
  { value: "staff", label: "Nhiều cán bộ nhất" },
];

/** Số trường tải mỗi lần khi đang tìm. */
const PAGE = 50;

type View = "tree" | "grid";

/**
 * "Tổng quan trường học" — cửa vào của trục tổ chức: Sở → cơ quan quản lý →
 * trường → cơ sở → khối nhà → phòng, cộng nút Cán bộ và Thiết bị của mỗi
 * trường.
 *
 * <p>Màn này từng có hai cột, cây bên trái và khung chi tiết bên phải. Bỏ cột
 * phải vì mỗi bản ghi đều đã có trang riêng, và một bản sao rút gọn nằm cạnh
 * cây là bản sao phải sửa hai lần mỗi khi trang thật đổi.
 *
 * <p>Hai cách nhìn cho hai câu hỏi khác nhau. CÂY trả lời "cái này nằm dưới
 * cái kia" và dẫn đường: tên mỗi nút là một liên kết thật. KHỐI trả lời "có
 * những gì và cái nào lớn", và đi xuống TỪNG TẦNG ngay trong lưới — bấm một cơ
 * quan thì thấy các trường của nó dưới dạng thẻ, chứ không nhảy thẳng sang một
 * danh sách dài, vì nhảy như vậy là bỏ mất đúng cái tầng vừa mở.
 *
 * <p>Góc nhìn theo phân quyền dòng chứ không theo vai trò viết cứng: Sở thấy
 * mọi trường nên có nút gốc; cán bộ trường chỉ thấy đúng một trường, nên cây
 * mở thẳng vào trường đó và không có nút gốc.
 */
export function SchoolExplorer() {
  // Nhớ qua F5 và qua lần chuyển menu: dạng xem là sở thích (lưu lâu dài, mặc định
  // KHỐI); chỗ đang đứng — tầng đang mở, trang, ô tìm — theo phiên của tab.
  const [view, setView] = usePersistentState<View>("explorer.view", "grid", "local");
  const [filter, setFilter] = usePersistentState("explorer.filter", "");
  const [dialog, setDialog] = useState(false);
  const [selectedKey, setSelectedKey] = usePersistentState<string | null>("explorer.selected", null);
  /** Cơ quan đang mở trong lưới. Rỗng = đang ở tầng cơ quan. */
  const [pickedBody, setOpenBodyRaw] = usePersistentState<BodyStats | null>("explorer.openBody", null);

  const mayCreateSchool = useCan({ resource: "schools", action: "create" }).data?.can ?? false;
  const mayListSchools = useCan({ resource: "schools", action: "list" }).data?.can ?? false;

  // Ô tìm gõ tới đâu gọi tới đó sẽ bắn một request mỗi phím.
  const [search, setSearch] = useState(() => filter.trim());
  useEffect(() => {
    const id = setTimeout(() => setSearch(filter.trim()), 300);
    return () => clearTimeout(id);
  }, [filter]);

  // Xếp danh sách: theo tên, hoặc theo một con số (nhiều nhất trước). Dòng cơ quan xếp ở máy khách (đã có đủ
  // trong một lần gọi), dòng trường xếp ở máy chủ vì danh sách trường được tải theo trang.
  const [sort, setSort] = usePersistentState<SortKey>("explorer.sort", "name", "local");

  // Tầng giữa. Chỉ trả về cơ quan CÓ trường trong phạm vi người gọi: 168 UBND
  // mà phần lớn rỗng là một danh sách không ai đọc nổi.
  const { result: bodyResult, query: bodyQuery } = useCustom<BodyStats[]>({
    url: `${API_URL}/school_overview/bodies`,
    method: "get",
  });
  const bodies = useMemo<BodyStats[]>(
    () => (Array.isArray(bodyResult?.data) ? (bodyResult.data as BodyStats[]) : []),
    [bodyResult]
  );
  const sortedBodies = useMemo(() => {
    if (sort === "name") return bodies;
    const key = { schools: "schools", equipment: "equipment", broken: "equipmentBroken", rooms: "rooms", staff: "staff" }[sort] as keyof BodyStats;
    return [...bodies].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
  }, [bodies, sort]);

  // Tài khoản chỉ thấy MỘT cơ quan (UBND phường / xã): không có tầng cơ quan nào để chọn — màn mở thẳng
  // danh sách trường của địa bàn đó và gọi tên nó ở tiêu đề, thay vì "Toàn ngành" rồi một ô duy nhất.
  const onlyBody = bodies.length === 1 && bodies[0].id != null ? bodies[0] : null;
  const openBody = onlyBody ?? pickedBody;

  // Phân trang phía trình duyệt: danh sách cơ quan có hơn trăm dòng nhưng về
  // trong MỘT lần gọi, vì số liệu của nó là một câu gộp duy nhất. Cắt trang ở
  // đây rẻ hơn một vòng gọi lại mỗi lần lật trang.
  const [bodyPage, setBodyPage] = usePersistentState("explorer.bodyPage", 1);
  const [bodySize, setBodySize] = usePersistentState("explorer.bodySize", 20);
  const bodyPageCount = Math.max(1, Math.ceil(bodies.length / bodySize));
  // Không đặt lại trang khi dữ liệu vừa về — đó đúng là lúc trang đã lưu được khôi
  // phục. Chỉ kéo về trang cuối nếu danh sách ngắn đi.
  useEffect(() => {
    if (bodies.length && bodyPage > bodyPageCount) setBodyPage(bodyPageCount);
  }, [bodies.length, bodyPage, bodyPageCount, setBodyPage]);
  const visibleBodies = useMemo(
    () => sortedBodies.slice((bodyPage - 1) * bodySize, bodyPage * bodySize),
    [sortedBodies, bodyPage, bodySize]
  );

  // Tải theo trang và GHÉP lại: "Xem thêm" chỉ đọc trang kế, không đọc lại từ đầu
  // n trang đã có (mỗi trang là một câu gộp số liệu cho từng trường).
  const listParams = { sort: sort === "schools" ? "name" : sort, ...(search ? { q: search } : {}) };
  const query = useInfiniteQuery({
    queryKey: ["school_overview", "pages", listParams],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      kyInstance
        .get("school_overview", { searchParams: { ...listParams, _start: pageParam, _end: pageParam + PAGE }, signal })
        .json<Overview>(),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + (p.schools?.length ?? 0), 0);
      return last.schools?.length && loaded < last.total ? loaded : undefined;
    },
  });
  const overview = useMemo<Overview | undefined>(() => {
    const first = query.data?.pages[0];
    return first ? { ...first, schools: query.data!.pages.flatMap((p) => p.schools ?? []) } : undefined;
  }, [query.data]);
  const schools = useMemo(() => overview?.schools ?? [], [overview]);
  const total = overview?.total ?? 0;
  const hasMore = query.hasNextPage;
  // "Chỉ có đúng một trường" là câu hỏi về PHẠM VI của tài khoản, nên hỏi tổng
  // số chứ không hỏi độ dài trang đang tải.
  const single = total === 1;

  // Trường của cơ quan đang mở trong lưới. Gọi riêng chứ không lọc từ trang
  // đang có: danh sách kia là một trang của toàn ngành, nên lọc phía trình
  // duyệt sẽ tìm trong đúng cái tập đang thiếu.
  // Cấp trong cũng phân trang. Sở có 108 trường và một UBND có tới 57, nên
  // "mở ra là thấy hết" chỉ đúng với những cơ quan nhỏ; những cơ quan lớn —
  // đúng những cơ quan người ta hay mở — sẽ thành một lưới dài vô tận.
  const [drillPage, setDrillPage] = usePersistentState("explorer.drillPage", 1);
  const [drillSize, setDrillSize] = usePersistentState("explorer.drillSize", 20);
  // Mở một cơ quan khác thì về trang 1 của nó — ở chỗ bấm, không trong effect, để
  // lần khôi phục sau F5 không bị đặt lại.
  const setOpenBody = (b: BodyStats | null) => {
    setOpenBodyRaw(b);
    setDrillPage(1);
  };

  // Trường của cơ quan đang mở, ĐỌC KÈM SỐ LIỆU (phòng, thiết bị, hỏng) từ cùng nguồn với chế độ tìm —
  // đọc từ danh sách trường thường thì thẻ chỉ còn tên và mã.
  const { result: drillResult, query: drillQuery } = useCustom<Overview>({
    url: `${API_URL}/school_overview`,
    method: "get",
    config: { query: { body: openBody?.id ?? "null", sort: sort === "schools" ? "name" : sort, _start: (drillPage - 1) * drillSize, _end: drillPage * drillSize } },
    queryOptions: { enabled: view === "grid" && openBody !== null && !search && !single && !onlyBody },
  });
  const drillOverview = customResult(drillResult?.data, "schools");
  const drillSchools = drillOverview?.schools ?? [];
  const drillTotal = drillOverview?.total ?? 0;

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isFetching: query.isFetching,
    onLoadMore: () => void query.fetchNextPage(),
  });

  // Chỉ để tô dòng vừa bấm; điều hướng là việc của chính liên kết trên nhãn.
  const select = (n: TreeNode) => setSelectedKey(nodeKey(n));

  // Đang tìm thì thứ người ta tìm là TRƯỜNG, nên cả hai cách nhìn đều hiện
  // thẳng trường: người gõ tên một trường không muốn phải đoán nó nằm dưới
  // UBND nào rồi mở ra.
  // UBND (một cơ quan duy nhất) cũng xem thẳng danh sách trường của mình — kèm số liệu từng trường —
  // thay vì một nhánh cơ quan phải mở ra.
  const showingSchools = Boolean(search) || single || onlyBody != null;
  useEffect(() => {
    if (showingSchools) setOpenBody(null);
  }, [showingSchools]);

  const loading = query.isLoading || (view === "grid" && !showingSchools && bodyQuery.isLoading);

  // Tài khoản chỉ thấy MỘT trường (cán bộ, lãnh đạo trường): không có gì để duyệt qua cây hay
  // lưới — tiêu đề "Toàn ngành", cây một dòng và các cột số không tiêu đề chỉ là nhiễu. Màn này
  // thành bàn làm việc của chính trường đó: tên trường, các chỉ số, rồi các bảng của trường.
  const own = single && !search ? schools[0] : null;
  if (own?.id) return <SchoolWorkspace stats={own} />;

  return (
    <div className="space-y-4">
      {/* Màn không có ListViewHeader: tiêu đề cho trình đọc màn hình và tab trình duyệt. */}
      <h1 className="sr-only">Trường học và cơ sở vật chất</h1>
      {/* Tên phạm vi, số trường và sáu chỉ số trên MỘT thẻ. Nút bấm ở hàng công cụ của bảng. */}
      {overview ? (
        <KpiRow
          s={overview.totals}
          schools={total}
          title={onlyBody ? onlyBody.name : "Sở Giáo dục và Đào tạo TP. Hồ Chí Minh"}
          // Chỉ đếm cơ quan CÓ trường trong phạm vi người xem và bỏ dòng "chưa xác định". Số trường đã ở ô đầu.
          meta={onlyBody ? null : `${new Intl.NumberFormat("vi-VN").format(bodies.filter((b) => b.id != null).length)} cơ quan quản lý có trường`}
        />
      ) : null}

      <FillBox>
      <Card className="min-h-0 flex-1 gap-0 overflow-y-auto py-0">
        <div className="border-border bg-card sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b p-3">
          {/* Rộng cố định: ô tìm trải hết chiều ngang thì con trỏ nằm ở mép
              trái còn nút đổi cách nhìn ở tận mép phải, và giữa chúng là một
              dải trắng dài chẳng của ai. */}
          <div className="relative w-full sm:w-96">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Tìm trường..."
              className="h-8 pl-8"
            />
          </div>
          <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setBodyPage(1); setDrillPage(1); }}>
            <SelectTrigger className="h-8 w-52" aria-label="Sắp xếp"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.filter((o) => o.value !== "schools" || !showingSchools).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 sm:ms-auto">
            {/* Cách hiển thị là thiết lập của cả bảng — đứng mép phải như nút chọn chế độ xem ở các màn khác,
                không chen giữa ô tìm và ô sắp xếp. */}
            <SchoolViewSwitch current={view} showList={mayListSchools}
              onPick={(v) => { setView(v); setBodyPage(1); }} />
            {mayCreateSchool ? (
              <Button size="sm" onClick={() => setDialog(true)}>
                Thêm trường
              </Button>
            ) : null}
          </div>
        </div>

        {/* Đường dẫn của lưới. Chỉ hiện khi đã đi xuống một tầng, vì ở tầng
            trên cùng nó chỉ lặp lại tiêu đề trang. */}
        {view === "grid" && openBody && !onlyBody ? (
          <div className="border-border text-muted-foreground flex items-center gap-1 border-b px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => setOpenBody(null)}
              className="hover:text-foreground hover:underline"
            >
              Cơ quan quản lý
            </button>
            <ChevronRight className="size-3.5" />
            <span className={bodyTone(openBody.type)}>{openBody.name}</span>
            <span className="ms-2 text-xs">
              {new Intl.NumberFormat("vi-VN").format(openBody.schools)} trường
            </span>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
          </div>
        ) : view === "grid" ? (
          showingSchools ? (
            <SchoolGrid schools={schools} emptyText={emptyText(search)} />
          ) : openBody ? (
            drillQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm">
                <Spinner size="sm" />
                Đang tải...
              </div>
            ) : (
              <SchoolGrid schools={drillSchools} emptyText="Cơ quan này chưa có trường nào." />
            )
          ) : (
            <BodyGrid
              bodies={visibleBodies}
              onOpen={setOpenBody}
              emptyText={emptyText(search)}
            />
          )
        ) : (
          <>
            {/* Dải tiêu đề nằm NGOÀI khung cây để chạy hết chiều ngang thẻ, và
                mang nền `--surface-subtle` mà mọi bảng trong ứng dụng dùng cho
                băng tiêu đề của nó. Để bên trong khung cây thì nó thụt vào
                theo `p-2` và đọc ra như một dòng dữ liệu viết hoa.

                Đệm trái cộng thêm 8px của `p-2`, đệm phải cộng 8px của `pr-2`
                trên mỗi dòng, nên bốn cột số của tiêu đề rơi đúng lên bốn cột
                số của các dòng bên dưới. */}
            {/* Có cả khi đang liệt kê thẳng trường (UBND, đang tìm): thiếu tiêu đề thì ba cột số ở dòng
                trường không ai biết là số gì. */}
            {!single ? (
              <div
                className="border-border bg-table-head text-table-head-text [&_span]:text-table-head-text relative hidden h-10 items-center gap-1 border-b sm:flex"
                style={{ paddingLeft: TREE_NAME_OFFSET + 8, paddingRight: 16 }}
              >
                {/* Tiêu đề cột tên đặt TUYỆT ĐỐI để nằm sát mép trái mà không
                    co mất phần của ô tên — co mất thì bốn cột số lệch đi. */}
                <span className="text-overline absolute left-3">
                  {showingSchools ? "Trường" : "Cơ quan quản lý"}
                </span>
                <span className="min-w-0 flex-[2]" />
                <TreeStatsHeader schoolCount={!showingSchools} />
              </div>
            ) : null}

            <div role="tree" className="p-2">
            {/* Không có dòng gốc "Sở GD&ĐT TP.HCM": Sở đã là một dòng cơ quan quản lý ngay bên dưới (108 trường
                THPT), một dòng gốc trùng tên chỉ là hai Sở đứng liền nhau. */}
            {showingSchools
              ? schools.map((s) => (
                  <SchoolBranch
                    key={s.id}
                    school={s}
                    stats={s}
                    depth={single ? 0 : 1}
                    selectedKey={selectedKey}
                    onSelect={select}
                  />
                ))
              : visibleBodies.map((b) => (
                  <ManagingBodyBranch
                    key={b.code}
                    body={b}
                    depth={1}
                    selectedKey={selectedKey}
                    onSelect={select}
                  />
                ))}
            {showingSchools && schools.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">{emptyText(search)}</p>
            ) : null}
          </div>
          </>
        )}

        {/* Phân trang — dùng chung thanh của bảng dữ liệu, để mọi chỗ trong
            ứng dụng không lệch nhau về cách đếm trang. Cả tầng cơ quan lẫn
            tầng trường bên trong đều có, vì cả hai đều đủ dài để cần. */}
        {!loading && !showingSchools && !openBody && bodies.length > 0 ? (
          <div className="border-border bg-card sticky bottom-0 z-20 mt-auto border-t px-3 py-2">
            <DataTablePagination
              currentPage={bodyPage}
              pageCount={bodyPageCount}
              setCurrentPage={setBodyPage}
              pageSize={bodySize}
              setPageSize={(n) => {
                setBodySize(n);
                setBodyPage(1);
              }}
              total={bodies.length}
            />
          </div>
        ) : null}

        {view === "grid" && openBody && !drillQuery.isLoading && drillTotal > 0 ? (
          <div className="border-border bg-card sticky bottom-0 z-20 mt-auto border-t px-3 py-2">
            <DataTablePagination
              currentPage={drillPage}
              pageCount={Math.max(1, Math.ceil(drillTotal / drillSize))}
              setCurrentPage={setDrillPage}
              pageSize={drillSize}
              setPageSize={(n) => {
                setDrillSize(n);
                setDrillPage(1);
              }}
              total={drillTotal}
            />
          </div>
        ) : null}

        {/* Thẻ canh: lọt vào khung nhìn nghĩa là đã cuộn tới đáy, và đó là lúc
            tải trang sau. Chỉ cần khi đang hiện kết quả tìm. */}
        {showingSchools && hasMore ? (
          <div
            ref={loadMoreRef}
            className="text-muted-foreground border-border flex items-center justify-center gap-2 border-t p-3 text-center text-xs"
          >
            {query?.isFetching ? (
              <>
                <Spinner size="sm" />
                Đang tải...
              </>
            ) : (
              `${schools.length}/${total} trường, cuộn để tải thêm`
            )}
          </div>
        ) : null}
      </Card>
      </FillBox>

      <SchoolDialog open={dialog} onOpenChange={setDialog} onSaved={() => query.refetch()} />
    </div>
  );
}

function emptyText(search: string) {
  return search
    ? "Không có trường nào khớp."
    : "Tài khoản chưa được gán trường nào, hoặc chưa có trường.";
}
