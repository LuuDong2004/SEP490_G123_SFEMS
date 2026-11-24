import { useCan, useInfiniteList } from "@refinedev/core";
import {
  Building2,
  ChevronRight,
  DoorOpen,
  Hotel,
  IdCard,
  Landmark,
  Loader2,
  PackageSearch,
  School,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";
import { count } from "@/shared/lib/chart-palette";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NodeKind =
  | "root"
  /** Cơ quan quản lý — Sở hoặc UBND phường/xã. Tầng giữa của cây. */
  | "body"
  | "school"
  | "campus"
  | "building"
  | "room"
  | "staff"
  | "equipment";

/**
 * Màu của một nhánh, theo TẦNG QUẢN LÝ chứ không theo thẩm mỹ.
 *
 * <p>Cây có 169 cơ quan và 946 trường; không tô màu thì Sở, UBND và nhóm chưa
 * xác định là ba thứ khác hẳn nhau về ý nghĩa nhưng trông y hệt nhau. Màu ở
 * đây chỉ nói ĐÂY LÀ TẦNG NÀO — nó không nói trạng thái tốt hay xấu, trừ đúng
 * một chỗ: `warn`, dành cho nhóm chưa xác định, vốn là một việc còn dở.
 *
 * <p>Đọc từ token nên đổi bảng màu thương hiệu là cả cây đổi theo, và không
 * dùng `bg-x/10`: nền alpha lấy màu từ thứ nằm sau nó, nên cùng một chip sẽ ra
 * hai màu khác nhau khi dòng được chọn.
 *
 * <p>Màu đánh dấu CẤP QUẢN LÝ, và chỉ ba cấp ấy có màu: Sở ĐỎ → UBND phường/xã
 * XANH → trường VÀNG. Nhóm chưa xác định mang màu cam cảnh báo vì nó là việc
 * còn dở chứ không phải một cấp. Cơ sở, khối nhà, phòng giữ màu trung tính:
 * chúng là địa điểm bên trong một trường, không phải một cấp quản lý, và thêm
 * màu cho chúng sẽ làm cả cây thành một bảng màu mà không màu nào còn nổi.
 *
 * <p>Đỏ và vàng là ngoại lệ có chủ ý so với hệ màu của ứng dụng, và cần biết
 * khi sửa về sau: ở nơi khác đỏ nghĩa là hỏng, còn vàng là con dấu thương
 * hiệu chỉ dùng ở ba chỗ. Ở đây chúng chỉ đánh dấu cấp, không nói trạng thái,
 * và không đá nhau với nghĩa cũ vì cây không hiện trạng thái ở cột biểu tượng
 * — số hỏng nằm ở cột "Hỏng" bên phải và tự mang màu cảnh báo của nó.
 */
type Tone = "so" | "gov" | "school" | "warn" | "plain";

const TONES: Record<Tone, { icon: string; badge: string }> = {
  so: { icon: "text-destructive", badge: "text-destructive" },
  gov: { icon: "text-info", badge: "text-info-text bg-info-subtle" },
  school: { icon: "text-gold-600", badge: "text-gold-text bg-gold-subtle" },
  warn: { icon: "text-warning", badge: "text-warning-text bg-warning-subtle" },
  plain: { icon: "text-muted-foreground", badge: "text-muted-foreground" },
};

export type TreeNode = {
  kind: NodeKind;
  id: number | null;
  label: string;
  schoolId: number | null;
  /** Bản ghi gốc (trường, cơ sở, khối nhà, phòng) — khung chi tiết đọc thẳng từ đây. */
  record?: any;
  /** Màu của tầng. Vắng thì suy từ `kind`. */
  tone?: Tone;
};

export const nodeKey = (n: TreeNode) => `${n.kind}:${n.id ?? ""}:${n.schoolId ?? ""}`;

/**
 * Đường dẫn tới TRANG RIÊNG của nút — hoặc rỗng nếu nút không có trang nào.
 *
 * <p>Cây từng là nửa trái của một màn hai cột, và chọn một nút chỉ đổi nội
 * dung nửa phải. Giờ mỗi bản ghi có trang của nó, nên cây trở thành thứ dẫn
 * đường: tên nút là một liên kết thật, mở tab mới được, gửi link cho người
 * khác được, và nút Quay lại của trình duyệt làm đúng việc của nó.
 *
 * <p>Nút Cán bộ và Thiết bị của một trường không phải một bản ghi mà là một
 * TẬP, nên chúng dẫn tới đúng tab của trang trường — không phải một màn danh
 * mục lọc sẵn, vì bộ lọc ấy nằm trên địa chỉ và không có gì bảo đảm màn danh
 * mục đọc nó ra thành bộ lọc thật.
 */
export function nodeHref(n: TreeNode): string | null {
  switch (n.kind) {
    case "body":
      // Nhóm "chưa xác định" không phải một cơ quan nên không có trang.
      return n.id == null ? null : `/departments-of-education/show/${n.id}`;
    case "school":
      return `/schools/show/${n.id}`;
    case "campus":
      return `/campuses/show/${n.id}`;
    case "building":
      return `/buildings/show/${n.id}`;
    case "room":
      return `/rooms/show/${n.id}`;
    case "staff":
      return `/schools/show/${n.schoolId}?tab=staff`;
    case "equipment":
      return `/schools/show/${n.schoolId}?tab=equipment`;
    default:
      return null;
  }
}

/** Màu mặc định của mỗi tầng; nhánh cơ quan tự đặt lại theo loại cơ quan. */
const KIND_TONE: Record<NodeKind, Tone> = {
  root: "so",
  body: "gov",
  school: "school",
  // Cơ sở, khối nhà, phòng giữ màu trung tính: ba tầng cấp quản lý đã dùng
  // hết ba màu, và thêm màu thứ tư cho tầng địa điểm sẽ làm cả cây thành một
  // bảng màu mà không màu nào còn nổi lên.
  campus: "plain",
  building: "plain",
  room: "plain",
  // Cán bộ và Thiết bị không phải một tầng của cây địa điểm mà là hai lối tắt
  // treo dưới một trường, nên chúng giữ màu trung tính: tô màu cho chúng sẽ
  // làm người đọc tưởng đó là tầng thứ tư.
  staff: "plain",
  equipment: "plain",
};

/**
 * Một dòng cây chia theo TỈ LỆ, như một bảng: tên chiếm hai phần, dải bốn số
 * liệu chiếm ba phần còn lại.
 *
 * <p>Hai cách làm trước đều để lại một mảng trắng lớn. Cho tên nở tự do thì số
 * dạt ra mép phải và khoảng trống nằm giữa; đặt trần cứng cho tên thì số túm
 * sang trái và khoảng trống chuyển ra mép phải. Chia theo tỉ lệ thì không còn
 * chỗ nào để trống dồn vào: mỗi cột luôn chiếm đúng phần của nó dù thẻ rộng
 * bao nhiêu, và bốn con số nằm thẳng hàng giữa mọi dòng.
 */
const NAME_BOX = "min-w-0 flex-[2] truncate";
const STAT_CELL = "min-w-0 flex-1 text-right tabular-nums";

/**
 * Bề ngang của phần đứng trước ô tên trên một dòng cây: nút mở/thu, biểu
 * tượng và hai khoảng cách. Hàng tiêu đề của dải số liệu lùi đúng bằng ngần
 * này để tiêu đề nằm thẳng trên cột của nó.
 */
export const TREE_NAME_OFFSET = 62;

const ICONS: Record<NodeKind, typeof School> = {
  root: Landmark,
  body: Landmark,
  school: School,
  campus: Building2,
  building: Hotel,
  room: DoorOpen,
  staff: IdCard,
  equipment: PackageSearch,
};

function Row({
  node,
  depth,
  selected,
  onSelect,
  expandable,
  open,
  onToggle,
  loading,
  badge,
}: {
  node: TreeNode;
  depth: number;
  selected: boolean;
  onSelect: (n: TreeNode) => void;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
  loading?: boolean;
  badge?: ReactNode;
}) {
  const Icon = ICONS[node.kind];
  const tone = TONES[node.tone ?? KIND_TONE[node.kind]];
  const href = nodeHref(node);
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expandable ? open : undefined}
      className={cn(
        "group flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-sm",
        selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
      /* Bấm vào DÒNG thì mở/thu để duyệt cây tại chỗ; bấm vào TÊN mới đi tới
         trang riêng. Gộp cả hai vào một cú bấm thì không duyệt được cây nữa —
         mỗi lần mở một nhánh là rời khỏi màn hình. */
      onClick={() => (expandable ? onToggle() : onSelect(node))}
    >
      <button
        type="button"
        aria-label={open ? "Thu gọn" : "Mở rộng"}
        className={cn("text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded", !expandable && "invisible")}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        )}
      </button>
      <Icon className={cn("size-4 shrink-0", tone.icon)} />
      {/* `max-w` là thứ giữ cho dải số liệu không dạt ra mép phải của thẻ.
          Không có nó, ô tên nở hết chiều ngang và giữa tên với những con số là
          một khoảng trắng bằng nửa màn hình. Có trần thì số bám ngay sau tên,
          mà vẫn thẳng hàng giữa các dòng vì trần là một con số cố định. */}
      {href ? (
        <Link
          to={href}
          className={cn(NAME_BOX, "hover:underline")}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
          }}
        >
          {node.label}
        </Link>
      ) : (
        <span className={NAME_BOX}>{node.label}</span>
      )}
      {badge}
    </div>
  );
}

type Props = {
  selectedKey: string | null;
  onSelect: (n: TreeNode) => void;
};

/** Số con nạp mỗi lần khi mở một nhánh; cuộn tới cuối nhánh thì nạp tiếp. */
const CHILD_PAGE = 30;

/**
 * Một nút có con tải LƯỜI: danh sách con chỉ hỏi API khi nút được mở, nên cây
 * cả nghìn phòng vẫn mở nhanh. Phạm vi dòng của API quyết định ai thấy gì —
 * cán bộ trường gọi cùng endpoint chỉ nhận dữ liệu trường mình.
 *
 * <p>Con cũng nạp THEO TRANG ({@link CHILD_PAGE} một lần): Sở có hàng trăm
 * trường, và nạp một lượt cả trăm dòng — mỗi dòng còn kéo số liệu riêng — là
 * cái giật lúc mở nhánh. Cuộn tới cuối nhánh thì trang sau tự về.
 */
function LazyNode({
  node,
  depth,
  childResource,
  childFilterField,
  childKind,
  selectedKey,
  onSelect,
  renderChild,
  extraChildren,
  badge,
  childFilterValue,
  childSort = "sortOrder",
}: Props & {
  node: TreeNode;
  depth: number;
  childResource: string;
  childFilterField: string;
  /**
   * Giá trị lọc, mặc định là id của nút. Nhóm "chưa xác định" không có id nên
   * truyền `"null"` — phía API, `SchoolSpecifications` hiểu đó là `IS NULL`.
   */
  childFilterValue?: unknown;
  childKind: NodeKind;
  renderChild?: (child: TreeNode, depth: number) => ReactNode;
  extraChildren?: (depth: number) => ReactNode;
  badge?: ReactNode;
  /** Trường để sắp xếp con. Danh mục dùng `sortOrder`, trường học dùng `name`. */
  childSort?: string;
}) {
  const [open, setOpen] = useState(false);
  const mayRead = useCan({ resource: childResource, action: "list" }).data?.can ?? false;
  const { result, query } = useInfiniteList<any>({
    resource: childResource,
    filters: [{ field: childFilterField, operator: "eq", value: childFilterValue ?? node.id }],
    sorters: [{ field: childSort, order: "asc" }],
    pagination: { pageSize: CHILD_PAGE },
    queryOptions: { enabled: open && mayRead },
  });
  const pages = result.data?.pages ?? [];
  const total = pages[0]?.total;
  const hasMore = result.hasNextPage ?? false;
  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isFetching: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(),
  });
  const children: TreeNode[] = pages.flatMap((p) => p.data ?? []).map((r: any) => ({
    kind: childKind,
    id: r.id,
    label: r.name,
    schoolId: node.schoolId,
    record: r,
  }));

  return (
    <div role="group">
      <Row
        node={node}
        depth={depth}
        selected={selectedKey === nodeKey(node)}
        onSelect={onSelect}
        expandable
        open={open}
        onToggle={() => setOpen((o) => !o)}
        loading={open && query.isLoading && mayRead}
        badge={badge}
      />
      {open ? (
        <>
          {children.map((c) =>
            renderChild ? (
              <div key={nodeKey(c)}>{renderChild(c, depth + 1)}</div>
            ) : (
              <Leaf key={nodeKey(c)} node={c} depth={depth + 1} selectedKey={selectedKey} onSelect={onSelect} />
            ),
          )}
          {hasMore ? (
            <div
              ref={loadMoreRef}
              className="text-muted-foreground flex h-8 items-center gap-2 text-xs"
              style={{ paddingLeft: 4 + (depth + 1) * 14 + 26 }}
            >
              {query.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {query.isFetchingNextPage ? "Đang tải thêm…" : "Cuộn để tải thêm"}
              {total != null ? <span className="tabular-nums">· đã hiện {children.length}/{total}</span> : null}
            </div>
          ) : null}
          {extraChildren?.(depth + 1)}
        </>
      ) : null}
    </div>
  );
}

function Leaf({ node, depth, selectedKey, onSelect, badge }: Props & { node: TreeNode; depth: number; badge?: ReactNode }) {
  return (
    <Row
      node={node}
      depth={depth}
      selected={selectedKey === nodeKey(node)}
      onSelect={onSelect}
      expandable={false}
      open={false}
      onToggle={() => {}}
      badge={badge}
    />
  );
}

/**
 * Dải số liệu ở cuối một dòng cây: trường, phòng, thiết bị.
 *
 * <p>Tồn tại vì dòng cây trải hết chiều ngang thẻ, và trước đây chỉ có tên ở
 * mép trái với một con số ở mép phải — ở giữa là một khoảng trống rộng bằng
 * nửa màn hình, không nói gì. Dải này lấp chỗ ấy bằng đúng những con số mà
 * người đọc màn tổng quan đang đi tìm, nên khoảng trống biến mất như một hệ
 * quả chứ không phải bằng cách thu hẹp khung lại.
 *
 * <p>Số 0 bị ẩn: bốn con số 0 lặp lại trên trăm dòng chỉ là nhiễu, và làm
 * chìm mất những dòng có số thật.
 */
function StatCell({ value, label, tone, empty = "Chưa khai" }: { value?: number; label: string; tone?: string; empty?: string | null }) {
  // Chưa có số liệu (vd. dòng khối nhà, phòng): ô trống. Bằng 0: ghi chữ ("Chưa khai", "Không tính được") thay cho
  // dấu gạch khó hiểu. `empty = null`: số 0 là số thật, hiện "0".
  if (value == null) return <span className={STAT_CELL} aria-hidden />;
  if (value === 0 && empty) return <span className={cn(STAT_CELL, "text-muted-foreground text-xs font-normal italic")}>{empty}</span>;
  return (
    // Số thật tô màu chính, đậm: nổi lên giữa các ô "Chưa khai" mờ.
    <span className={cn(STAT_CELL, "text-primary font-semibold", value ? tone : undefined)} title={label}>
      {count.format(value)}
    </span>
  );
}

/** Hàng tiêu đề của dải số liệu — bốn con số không nhãn thì không đọc được. */
/** `schoolCount = false` khi các dòng là TRƯỜNG: cột "Trường" để trống, vẫn giữ chỗ cho các cột sau thẳng hàng. */
export function TreeStatsHeader({ schoolCount = true }: { schoolCount?: boolean }) {
  return (
    <div className="text-sm font-bold tracking-wide uppercase text-muted-foreground flex flex-[3] items-center gap-4 pr-2">
      {/* Cột đầu: số trường ở dòng cơ quan, số lớp ở dòng trường. */}
      <span className={STAT_CELL}>{schoolCount ? "Trường" : "Lớp"}</span>
      <span className={STAT_CELL}>Cán bộ</span>
      <span className={STAT_CELL}>Phòng</span>
      <span className={STAT_CELL}>Thiết bị</span>
    </div>
  );
}

export function TreeStats({
  schools,
  staff,
  rooms,
  equipment,
}: {
  /** Cột đầu: số trường (dòng cơ quan) hoặc số lớp (dòng trường). */
  schools?: number;
  staff?: number;
  rooms?: number;
  equipment?: number;
}) {
  return (
    // Số là thứ người ta đọc ở cây này: chữ thường, đậm vừa — không mờ nhỏ như chú thích. Ô chữ "Chưa khai" mờ.
    <span className="text-foreground hidden flex-[3] items-center gap-4 text-sm font-medium sm:flex">
      <StatCell value={schools} label="Trường" />
      <StatCell value={staff} label="Cán bộ" />
      <StatCell value={rooms} label="Phòng" />
      <StatCell value={equipment} label="Thiết bị" />
    </span>
  );
}

function CountBadge({ value, tone = "plain" }: { value?: number; tone?: Tone }) {
  if (value == null) return null;
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs tabular-nums", TONES[tone].badge)}>
      {value}
    </span>
  );
}

/**
 * Nhánh của MỘT cơ quan quản lý: các trường nó quản lý.
 *
 * <p>Đây là tầng giữa mà cây trước đây không có — mọi trường treo thẳng dưới
 * nút gốc, nên 946 trường thành một danh sách phẳng và không ai thấy được
 * trường nào thuộc Sở, trường nào thuộc UBND nào.
 *
 * <p>Danh sách trường nạp LƯỜI qua resource `schools` lọc theo
 * `departmentOfEducation.id` — cùng cơ chế mà Cơ sở → Khối nhà → Phòng đã
 * dùng, nên mở một UBND không kéo về trường của 168 UBND khác.
 */
export function ManagingBodyBranch({
  body,
  depth,
  selectedKey,
  onSelect,
}: Props & {
  body: {
    id: number | null;
    name: string;
    type: string;
    schools: number;
    staff?: number;
    rooms?: number;
    equipment?: number;
  };
  depth: number;
}) {
  // Ba tầng, ba màu: Sở là cơ quan quản lý cấp tỉnh nên mang màu thương hiệu;
  // 168 UBND mang màu chính quyền địa phương; nhóm chưa xác định mang màu cảnh
  // báo, vì nó là việc còn dở chứ không phải một cơ quan.
  const tone: Tone =
    body.type === "SO" ? "so" : body.type === "UNASSIGNED" ? "warn" : "gov";
  const node: TreeNode = {
    kind: "body",
    id: body.id,
    label: body.name,
    schoolId: null,
    record: body,
    tone,
  };
  return (
    <LazyNode
      node={node}
      depth={depth}
      childResource="schools"
      childFilterField="departmentOfEducation.id"
      // Nhóm chưa xác định không có id; API hiểu "null" là IS NULL.
      childFilterValue={body.id ?? "null"}
      childKind="school"
      childSort="name"
      selectedKey={selectedKey}
      onSelect={onSelect}
      badge={
        <TreeStats
          schools={body.schools}
          staff={body.staff}
          rooms={body.rooms}
          equipment={body.equipment}
        />
      }
      renderChild={(school, d) => (
        <SchoolBranch
          school={school.record}
          depth={d}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      )}
    />
  );
}

/** Cây của MỘT trường: Cơ sở → Khối nhà → Phòng, cộng hai nút Cán bộ và Thiết bị. */
export function SchoolBranch({
  school,
  stats,
  depth,
  selectedKey,
  onSelect,
}: Props & { school: any; stats?: any; depth: number }) {
  const node: TreeNode = { kind: "school", id: school.id, label: school.name, schoolId: school.id, record: school };
  return (
    <LazyNode
      node={node}
      depth={depth}
      childResource="campuses"
      childFilterField="school.id"
      childKind="campus"
      selectedKey={selectedKey}
      onSelect={onSelect}
      /* Cùng bốn cột với dòng cơ quan, trừ cột "trường" vốn vô nghĩa ở đây —
         nên số của một trường nằm thẳng hàng với số của cơ quan chứa nó. */
      badge={
        <TreeStats
          schools={stats?.classes}
          staff={stats?.staff}
          rooms={stats?.rooms}
          equipment={stats?.equipment}
        />
      }
      renderChild={(campus, d) => (
        <LazyNode
          node={campus}
          depth={d}
          childResource="buildings"
          childFilterField="campus.id"
          childKind="building"
          selectedKey={selectedKey}
          onSelect={onSelect}
          renderChild={(building, d2) => (
            <LazyNode
              node={building}
              depth={d2}
              childResource="rooms"
              childFilterField="building.id"
              childKind="room"
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          )}
        />
      )}
      extraChildren={(d) => (
        <>
          <Leaf
            node={{ kind: "staff", id: null, label: "Cán bộ, giáo viên", schoolId: school.id, record: school }}
            depth={d}
            selectedKey={selectedKey}
            onSelect={onSelect}
            badge={<CountBadge value={stats?.staff} />}
          />
          <Leaf
            node={{ kind: "equipment", id: null, label: "Thiết bị", schoolId: school.id, record: school }}
            depth={d}
            selectedKey={selectedKey}
            onSelect={onSelect}
            badge={<CountBadge value={stats?.equipment} />}
          />
        </>
      )}
    />
  );
}
