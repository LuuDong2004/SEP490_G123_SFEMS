import { BookOpen, ChevronRight, CircleAlert, CircleCheck, CircleHelp, CircleSlash, LayoutGrid, PackagePlus, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";
import { FillBox } from "@/shared/components/layout/fill-box";
import { CrossLink } from "@/shared/components/cross-link";
import { HelpHint } from "@/shared/components/form/help-hint";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { NormRow, SchoolAdequacy } from "@/domains/procurement/types";

import { AsideRow } from "../resources/equipment-aside";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { LoadingText } from "@/shared/components/spinner";

type State = "short" | "met" | "surplus" | "unknown" | "optional" | "none";

/** Một dòng đối chiếu thuộc trạng thái nào — quyết định nhãn ở cột cuối và ô lọc nhanh. */
function stateOf(r: NormRow): State {
  if (r.optional) return "optional";
  if (r.minQuantity == null) return "none";
  if (r.required == null) return "unknown";
  if (r.shortage !== 0) return "short";
  return (r.surplus ?? 0) > 0 ? "surplus" : "met";
}

/**
 * Các ô lọc đếm ĐÚNG phép của dải chỉ số trên đầu màn (`AdequacyService`): "Đã đủ" gồm cả thiết bị
 * thừa (thừa là đủ rồi còn dư), nên Còn thiếu + Đã đủ + Chưa tính được = số thiết bị tối thiểu được
 * tính. Dòng tự chọn / phụ lục không ghi số nằm ngoài phép đếm đó — có ô riêng, để "Tất cả" trừ đi
 * nó ra đúng mẫu số trên dải chỉ số.
 */
const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "short", label: "Còn thiếu" },
  { value: "met", label: "Đã đủ" },
  { value: "surplus", label: "Thừa", hint: "Có nhiều hơn định mức" },
  { value: "unknown", label: "Chưa tính được" },
  { value: "excluded", label: "Không tính", hint: "Nhóm tự chọn hoặc không ghi số lượng, không tính đủ hay thiếu" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/** Biểu tượng mỗi tình trạng ở cột lọc trái, cùng màu với ô số tương ứng ở đầu màn. */
const FILTER_ICONS: Record<Exclude<Filter, "all">, ReactNode> = {
  short: <CircleAlert className="text-destructive" />,
  met: <CircleCheck className="text-success" />,
  surplus: <PackagePlus className="text-warning" />,
  unknown: <CircleHelp className="text-warning" />,
  excluded: <CircleSlash className="text-muted-foreground" />,
};

function matches(filter: Filter, st: State) {
  if (filter === "all") return true;
  if (filter === "met") return st === "met" || st === "surplus";
  if (filter === "excluded") return st === "optional" || st === "none";
  return st === filter;
}

/** Các tình trạng lọc được (bỏ "Tất cả"), đúng thứ tự và nhãn của cột lọc trái. */
export const STATUS_FILTERS = FILTERS.filter((f) => f.value !== "all") as readonly { value: Exclude<Filter, "all">; label: string }[];
export type StatusFilter = Filter;

/** Các tình trạng một dòng khớp — dòng thừa khớp cả "Đã đủ" lẫn "Thừa", như phép đếm của cột lọc trái. */
export const statusesOf = (r: NormRow): string[] =>
  STATUS_FILTERS.filter((f) => matches(f.value, stateOf(r))).map((f) => f.value);

/** Bỏ dấu, chữ thường. Hạ chữ TRƯỚC khi đổi "đ": làm ngược lại thì "Đ" hoa sót dấu ("Đồng hồ" không khớp "dong ho"). */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");
/** Chỉ còn chữ và số — để "09001" khớp mã "THCS-09-001". */
const compact = (s: string) => s.replace(/[^a-z0-9]/g, "");

const haystack = (r: NormRow) => fold(`${r.normName} ${r.catalogCode ?? ""} ${r.subjectName ?? ""} ${r.typeName ?? ""}`);
/** Cụm có nằm liền trong chữ không; mã so cả khi bỏ dấu gạch / khoảng trắng ("09001" khớp "THCS-09-001"). */
const hasPhrase = (hay: string, q: string) => hay.includes(q) || (compact(q) !== "" && compact(hay).includes(compact(q)));
/** Chữ có đứng ĐẦU một từ không — "chieu" khớp "máy chiếu", không khớp giữa một từ khác. */
const startsWord = (hay: string, w: string) => hay.split(/[^a-z0-9]+/).some((t) => t.startsWith(w));

/**
 * Lọc theo từ khoá, tìm trong tên, mã, môn và loại thiết bị, gõ có dấu hay không đều như nhau. Ưu tiên khớp
 * NGUYÊN CỤM ("dong ho" → các thiết bị "Đồng hồ…"); không thiết bị nào khớp cụm thì mới tách từng chữ, mỗi
 * chữ phải đứng đầu một từ, không cần đúng thứ tự hay liền nhau ("tranh truyen" → "Bộ tranh minh họa … truyện").
 * Tách từng chữ ngay từ đầu thì chữ ngắn như "ho" khớp cả "hoạt", "học", "họa" — gõ "Đồng hồ" ra 57 dòng.
 */
function searchRows(rows: NormRow[], term: string): Set<number> | null {
  const q = fold(term).trim().replace(/\s+/g, " ");
  if (!q) return null;
  const hays = rows.map((r) => [r.normId, haystack(r)] as const);
  const phrase = hays.filter(([, h]) => hasPhrase(h, q));
  if (phrase.length) return new Set(phrase.map(([id]) => id));
  const words = q.split(" ");
  return new Set(hays.filter(([, h]) => words.every((w) => startsWord(h, w) || hasPhrase(h, w))).map(([id]) => id));
}

/** Nhãn cột cuối: Thiếu N / Đủ / Thừa N / Chưa tính được (rê chuột: vì sao) / Tự chọn / Không ghi số. */
function StatusCell({ r }: { r: NormRow }) {
  const st = stateOf(r);
  // Thiếu nhưng đề xuất chưa nhập về đã phủ hết phần thiếu: không còn là việc phải xin nữa.
  if (st === "short" && r.proposed > 0 && r.proposed >= (r.shortage ?? 0)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Badge variant="warning">Đã đề xuất đủ</Badge></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          Còn thiếu {r.shortage}, đã đề xuất {r.proposed} ở các phiếu đang chờ duyệt hoặc chưa nhập về. Xin thêm là trùng.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (st === "short") return <Badge variant="destructive" className="tabular-nums">Thiếu {r.shortage}</Badge>;
  if (st === "met") return <Badge variant="success">Đủ</Badge>;
  if (st === "surplus") return <Badge variant="info" className="tabular-nums">Thừa {r.surplus}</Badge>;
  if (st === "optional" || st === "none") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Badge variant="neutral">{st === "optional" ? "Tự chọn" : "Không ghi số"}</Badge></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {st === "optional"
            ? "Nhóm tự chọn, chỉ mua khi trường chọn phương án hoặc môn này. Không tính đủ hay thiếu."
            : "Thông tư không ghi số lượng nên không tính đủ hay thiếu."}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span><Badge variant="warning">Chưa tính được</Badge></span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{r.warning ?? "Thiếu dữ liệu để tính định mức"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Bảng đối chiếu danh mục thiết bị tối thiểu của MỘT trường — cùng khuôn với màn Danh mục tối
 * thiểu: nhóm theo môn (bấm để mở), mỗi dòng một thiết bị, cột cuối là nhãn trạng thái. Lý do
 * "chưa tính được" không lặp lại trên từng dòng mà gom thành một dòng nhắc trên đầu (rê chuột vào
 * nhãn vẫn thấy lý do của dòng đó). Mặc định lọc "Còn thiếu" và mở sẵn các môn.
 *
 * @param select có thì mỗi dòng (có thiết bị trong danh mục) có ô tích — hộp chọn thiết bị của đề xuất mua sắm
 * @param collapsed các môn ĐÓNG sẵn (chỉ mở khi đang tìm) — cho màn chuẩn của trường, nơi một trường
 *     mới nhập liệu có vài trăm thiết bị thiếu: mở hết là một trang dài ba chục màn hình
 */
/** Các dòng đang hiện (sau lọc và tìm) cùng tên bộ lọc — để màn chứa bảng in đúng thứ người dùng đang xem. */
export type AdequacyView = {
  rows: NormRow[];
  filterLabel: string;
  /** Tình trạng đang lọc, môn đang chọn (tên), từ khoá đang tìm — để hộp "Xem báo cáo" mở ra đúng như thế. */
  status: StatusFilter;
  subject?: string;
  term?: string;
};

/** Ô "Phải có": số theo chuẩn Bộ gạch ngang khi điều chỉnh đã duyệt đổi nó. */
function RequiredCell({ r }: { r: NormRow }) {
  if (r.required == null || r.optional) return <span className="text-muted-foreground font-normal">—</span>;
  if (r.adjustment && r.baseRequired != null && r.baseRequired !== r.required) {
    return (
      <span title={`Chuẩn Bộ ${r.baseRequired}, đã duyệt điều chỉnh còn ${r.required}`}>
        <s className="text-muted-foreground me-1 font-normal">{r.baseRequired}</s>
        {r.required}
      </span>
    );
  }
  return <>{r.required}</>;
}

/** Ô "Đang có": thiết bị thay thế đã quy đổi thì nói rõ có bao nhiêu là quy đổi. */
function CurrentCell({ r }: { r: NormRow }) {
  const extra = r.current - (r.baseCurrent ?? r.current);
  if (!r.adjustment || extra <= 0) return <>{r.current}</>;
  return (
    <span title={`${r.baseCurrent} của thiết bị này + ${extra} quy đổi từ ${r.adjustment.substituteCount} ${r.adjustment.substituteName ?? "thiết bị thay thế"}`}>
      {r.current}
      <span className="text-muted-foreground ms-1 text-xs">({r.baseCurrent}+{extra})</span>
    </span>
  );
}

export function AdequacyTable({ data, select, collapsed, actions, onView, adjust, initialFilter, aside }: {
  data: SchoolAdequacy | undefined;
  /** Chọn nhiều thiết bị (theo `catalogId`). `disabled` trả lý do không chọn được, vd. đã có trên phiếu. */
  select?: {
    selected: ReadonlySet<number>;
    onToggle: (row: NormRow) => void;
    disabled?: (row: NormRow) => string | null;
  };
  collapsed?: boolean;
  /** Nút của cả bảng (vd. Xuất Excel), sát mép phải hàng công cụ. */
  actions?: ReactNode;
  /** Báo các dòng đang hiện mỗi khi lọc / tìm đổi (để in danh sách thiếu, thừa). */
  onView?: (view: AdequacyView) => void;
  /** Cột "Điều chỉnh" cuối bảng (màn chuẩn của trường): nhãn đã duyệt / nháp và nút Điều chỉnh. */
  adjust?: (row: NormRow) => ReactNode;
  /** Bộ lọc lúc mở — mặc định "Còn thiếu"; màn cấu hình điều chỉnh mở "Tất cả". */
  initialFilter?: Filter;
  /**
   * Màn chuẩn của trường: cột lọc TRÁI (Tất cả · Tình trạng · Môn học, kèm số) và bảng PHẲNG bên phải, cùng khuôn
   * màn Thiết bị — thay cho ô chọn tình trạng và các nhóm môn thu gọn. Tự vẽ thẻ của mình; đặt thẳng trên trang.
   */
  aside?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "short");
  const [term, setTerm] = useState("");
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("all");
  // Phân trang chỉ ở bố cục cột lọc trái (bảng phẳng); bố cục nhóm theo môn đã tự thu gọn.
  const [page, setPage] = useState(1);
  // Nhớ số dòng mỗi trang qua F5, như các danh sách khác.
  const [pageSize, setPageSize] = usePersistentState<number>("adequacy.pageSize", 20, "local");
  useEffect(() => setPage(1), [filter, subject, term, pageSize]);

  const counts = useMemo(() => {
    const c = { all: data?.rows.length ?? 0, short: 0, met: 0, surplus: 0, unknown: 0, excluded: 0 };
    for (const r of data?.rows ?? []) {
      const st = stateOf(r);
      if (st === "short" || st === "unknown") c[st]++;
      else if (st === "optional" || st === "none") c.excluded++;
      else {
        c.met++;
        if (st === "surplus") c.surplus++;
      }
    }
    return c;
  }, [data]);

  // Lý do "chưa tính được", gom lại: mỗi lý do một dòng nhắc, kèm số thiết bị dính.
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data?.rows ?? []) {
      if (stateOf(r) === "unknown") m.set(r.warning ?? "Thiếu dữ liệu để tính", (m.get(r.warning ?? "Thiếu dữ liệu để tính") ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const groups = useMemo(() => {
    // Tìm trong các dòng của bộ lọc đang chọn: khớp cụm ở dòng đã bị lọc ra không được chặn việc tách chữ.
    const found = searchRows((data?.rows ?? []).filter((r) => matches(filter, stateOf(r))), term);
    const map = new Map<string, { key: string; name: string; rows: NormRow[]; short: number; met: number; surplus: number; unknown: number }>();
    for (const r of data?.rows ?? []) {
      const st = stateOf(r);
      if (!matches(filter, st)) continue;
      if (found && !found.has(r.normId)) continue;
      const key = String(r.subjectId ?? "none");
      if (!map.has(key)) map.set(key, { key, name: r.subjectName ?? "Chưa gắn môn", rows: [], short: 0, met: 0, surplus: 0, unknown: 0 });
      const g = map.get(key)!;
      g.rows.push(r);
      if (st === "short") g.short++;
      else if (st === "met") g.met++;
      else if (st === "surplus") {
        g.met++;
        g.surplus++;
      }
      else if (st === "unknown") g.unknown++;
    }
    return [...map.values()];
  }, [data, filter, term]);

  // Cột lọc trái: các môn có dòng trong tình trạng đang chọn (không theo ô tìm — danh sách môn đứng yên khi gõ).
  const subjects = useMemo(() => {
    const map = new Map<string, { key: string; name: string; n: number }>();
    for (const r of data?.rows ?? []) {
      if (!matches(filter, stateOf(r))) continue;
      const key = String(r.subjectId ?? "none");
      if (!map.has(key)) map.set(key, { key, name: r.subjectName ?? "Chưa gắn môn", n: 0 });
      map.get(key)!.n++;
    }
    return [...map.values()];
  }, [data, filter]);
  const subjectOn = !!aside && subject !== "all" && subjects.some((s) => s.key === subject);
  const flat = useMemo(
    () => (subjectOn ? groups.filter((g) => g.key === subject) : groups).flatMap((g) => g.rows),
    [groups, subject, subjectOn],
  );

  useEffect(() => {
    const label = FILTERS.find((f) => f.value === filter)?.label ?? "";
    const subjectName = subjectOn ? subjects.find((s) => s.key === subject)?.name : undefined;
    onView?.({ rows: flat, filterLabel: subjectName ? `${label} · ${subjectName}` : label, status: filter, subject: subjectName, term: term.trim() || undefined });
  }, [flat, filter, subject, subjectOn, subjects, term, onView]);

  if (!data) return <LoadingText />;
  if (data.rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có danh mục thiết bị tối thiểu cho cấp học của trường này.</p>;
  }

  // Đang lọc hay đang tìm thì mở sẵn mọi môn (bấm vẫn thu gọn được); "Tất cả" thì đóng sẵn.
  const openByDefault = term.trim() !== "" || (!collapsed && filter !== "all");
  const isOpen = (key: string) => (toggled.has(key) ? !openByDefault : openByDefault);
  const toggle = (key: string) =>
    setToggled((o) => {
      const next = new Set(o);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const cols = (select ? 10 : 9) + (adjust ? 1 : 0);

  /** Một dòng thiết bị — dùng chung cho bảng nhóm theo môn và bảng phẳng của cột lọc trái. */
  const row = (r: NormRow, i: number) => (
    <TableRow key={r.normId}
      // Hộp chọn: bấm cả dòng là tích / bỏ tích, như hộp chọn thiết bị của phiếu ghi tăng.
      className={cn("group/row", LIFT_ROW, select && r.catalogId && !select.disabled?.(r) ? "cursor-pointer" : undefined)}
      onClick={select && r.catalogId && !select.disabled?.(r) ? () => select.onToggle(r) : undefined}>
      {select ? (
        <TableCell className="py-1 text-center" onClick={(e) => e.stopPropagation()}>
          {r.catalogId ? (() => {
            const why = select.disabled?.(r) ?? null;
            return (
              <Checkbox
                aria-label={`Chọn ${r.normName}`}
                title={why ?? undefined}
                disabled={why != null}
                checked={why == null && select.selected.has(r.catalogId)}
                onCheckedChange={() => select.onToggle(r)}
              />
            );
          })() : null}
        </TableCell>
      ) : null}
      <TableCell className="text-muted-foreground py-2 text-center tabular-nums">{i + 1}</TableCell>
      <TableCell className="text-muted-foreground truncate py-2 font-mono text-xs">{r.catalogCode ?? "—"}</TableCell>
      <TableCell className="truncate py-2" title={`${r.normName}${r.typeName ? ` · ${r.typeName}` : ""}`}>
        {/* Trong hộp chọn thì tên là chữ thường: bấm vào là tích dòng, không rời form đang lập. */}
        {r.catalogId && !select ? (
          <Link to={`/equipment-catalogs/show/${r.catalogId}`} className="font-medium hover:underline">
            {r.normName}
          </Link>
        ) : (
          <span className="font-medium">{r.normName}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground truncate py-2 text-xs" title={r.gradeLevels ? undefined : "Mọi lớp của cấp học"}>
        {r.gradeLevels ? r.gradeLevels.replaceAll(",", ", ") : "Mọi lớp"}
      </TableCell>
      <TableCell className="text-muted-foreground truncate py-2 text-xs" title={r.quantityText ?? undefined}>
        {r.quantityText ?? (r.minQuantity == null ? "Không ghi" : r.minQuantity)}
      </TableCell>
      <TableCell className="py-2 text-right font-medium tabular-nums">
        <RequiredCell r={r} />
      </TableCell>
      <TableCell className={cn("py-2 text-right tabular-nums", r.current === 0 && "text-muted-foreground/60")}><CurrentCell r={r} /></TableCell>
      <TableCell className="text-muted-foreground py-2 text-right tabular-nums">{r.proposed || ""}</TableCell>
      <TableCell className="py-2"><StatusCell r={r} /></TableCell>
      {adjust ? <TableCell className="py-1.5">{adjust(r)}</TableCell> : null}
    </TableRow>
  );

  const reasonsNote = reasons.length && (filter === "unknown" || filter === "all") ? (
      <div className="bg-warning-subtle text-warning-text flex items-start gap-2 rounded-md px-3 py-2 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          {reasons.map(([reason, n]) => (
            <p key={reason}>
              <span className="font-medium tabular-nums">{n} loại thiết bị</span> chưa tính được: {reason.toLowerCase()}
              {/giáo viên/i.test(reason) ? (
                <>
                  .{" "}
                  {/* Có `select` là bảng đang nằm trong hộp chọn của đề xuất mua sắm: mở tab mới, không rời form. */}
                  <CrossLink to="/staff" resource="staff" newTab={!!select} className="font-medium underline">Khai môn dạy cho giáo viên</CrossLink>
                </>
              ) : "."}
            </p>
          ))}
        </div>
      </div>
    ) : null;
  const emptyNote = (
    <p className="text-muted-foreground rounded-lg border px-4 py-10 text-center text-sm">
      {term.trim()
        ? "Không có thiết bị nào khớp."
        : filter === "short"
          ? "Không còn thiết bị nào thiếu so với định mức tính được."
          : filter === "surplus"
            ? "Không có thiết bị nào nhiều hơn định mức."
            : "Không có thiết bị nào ở mục này."}
    </p>
  );
  const tableHead = (
    <>
      <colgroup>
        {select ? <col className="w-10" /> : null}
        <col className="w-12" />
        <col className={adjust ? "w-28" : "w-36"} />
        <col />
        <col className={adjust ? "w-20" : "w-24"} />
        <col className={adjust ? "w-24" : "w-36"} />
        <col className="w-20" />
        <col className="w-20" />
        {/* Đề xuất: tiêu đề ngắn ("Đề xuất" + ⓘ), số nhỏ — cùng cỡ cột số bên cạnh; phần dư cho cột Thiết bị. */}
        <col className="w-24" />
        <col className={adjust ? "w-28" : "w-36"} />
        {adjust ? <col className="w-52" /> : null}
      </colgroup>
      <TableHeader sticky>
        <TableRow>
          {select ? <TableHead /> : null}
          <TableHead className="text-center">STT</TableHead>
          <TableHead>Mã DM thiết bị</TableHead>
          <TableHead>Thiết bị</TableHead>
          <TableHead>Lớp</TableHead>
          <TableHead>Định mức</TableHead>
          <TableHead className="text-right">Phải có</TableHead>
          <TableHead className="text-right">Đang có</TableHead>
          <TableHead className="text-right">Đề xuất <HelpHint>Đề xuất mua sắm thiết bị</HelpHint></TableHead>
          <TableHead>Tình trạng</TableHead>
          {adjust ? <TableHead>Điều chỉnh</TableHead> : null}
        </TableRow>
      </TableHeader>
    </>
  );

  if (aside) {
    // STT đếm trong từng môn như bảng nhóm; trang hiện tại cắt từ danh sách phẳng rồi gom lại theo môn để vẽ dòng tên môn.
    const indexIn = new Map<number, number>();
    const totalOf = new Map<string, number>();
    for (const g of groups) {
      g.rows.forEach((r, i) => indexIn.set(r.normId, i));
      totalOf.set(g.key, g.rows.length);
    }
    const pageCount = Math.max(1, Math.ceil(flat.length / pageSize));
    const chunks: { key: string; name: string; rows: NormRow[] }[] = [];
    for (const r of flat.slice((page - 1) * pageSize, page * pageSize)) {
      const key = String(r.subjectId ?? "none");
      const last = chunks[chunks.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else chunks.push({ key, name: r.subjectName ?? "Chưa gắn môn", rows: [r] });
    }
    return (
      <FillBox className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        {/* MỘT cột lọc, cùng khuôn cột trái màn Thiết bị: "Tất cả thiết bị", rồi Tình trạng, rồi Môn học — số cạnh môn
            tính trong tình trạng đang chọn. Bấm lại mục đang chọn là bỏ lọc mục đó. */}
        <Card className="flex max-h-[75vh] flex-col gap-0 overflow-hidden py-0 lg:h-full lg:max-h-none">
          <div className="shrink-0 border-b p-2">
            <AsideRow root selected={filter === "all" && !subjectOn} onClick={() => { setFilter("all"); setSubject("all"); }}
              icon={<LayoutGrid />} label="Tất cả thiết bị" count={counts.all} />
          </div>
          <div className="scrollbar-fade min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
            <p className="text-overline text-muted-foreground px-2 pt-1 pb-0.5">Tình trạng</p>
            {FILTERS.filter((f) => f.value !== "all" && (f.value !== "excluded" || counts.excluded > 0)).map((f) => {
              const v = f.value as Exclude<Filter, "all">;
              return (
                <AsideRow key={v} selected={filter === v} onClick={() => setFilter(filter === v ? "all" : v)}
                  icon={FILTER_ICONS[v]} label={f.label} count={counts[v]} disabled={counts[v] === 0} />
              );
            })}
            <p className="text-overline text-muted-foreground px-2 pt-3 pb-0.5">Môn học</p>
            {subjects.map((s) => (
              <AsideRow key={s.key} selected={subjectOn && subject === s.key} onClick={() => setSubject(subject === s.key ? "all" : s.key)}
                icon={<BookOpen />} label={s.name} count={s.n} />
            ))}
          </div>
        </Card>

        <Card className="min-h-0 min-w-0 gap-3 px-4 py-4">
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm thiết bị, mã DM thiết bị…" className="ps-8" />
            </div>
            {actions ? <div className="flex items-center gap-2 sm:ms-auto">{actions}</div> : null}
          </div>
          {reasonsNote}
          {chunks.length === 0 ? emptyNote : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
              <Table className={cn("table-fixed", adjust && "min-w-[73.75rem]")}>
                {tableHead}
                <TableBody>
                  {chunks.map((g) => (
                    <Fragment key={g.key}>
                      {/* Đang xem mọi môn: một dòng tên môn ngăn các nhóm — không thu gọn, chỉ để biết đang ở môn nào. */}
                      {subjectOn ? null : (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={cols} className="px-3 py-1.5">
                            <span className="text-xs font-semibold">{g.name}</span>
                            <span className="text-muted-foreground ms-2 text-xs tabular-nums">{totalOf.get(g.key) ?? g.rows.length} loại thiết bị</span>
                          </TableCell>
                        </TableRow>
                      )}
                      {g.rows.map((r) => row(r, indexIn.get(r.normId) ?? 0))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              </div>
              <div className="shrink-0 border-t px-3 py-2">
                <DataTablePagination currentPage={page} pageCount={pageCount} setCurrentPage={setPage}
                  pageSize={pageSize} setPageSize={setPageSize} total={flat.length} pageSizeLabel="Số thiết bị mỗi trang" />
              </div>
            </div>
          )}
        </Card>
      </FillBox>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm thiết bị, mã DM thiết bị…" className="ps-8" />
        </div>
        {/* Ô chọn thay cho dải sáu nút: sáu nhãn kèm số chiếm gần hết hàng công cụ và xuống dòng ở màn
            hẹp. Số đếm đi cùng nhãn trong từng lựa chọn, ghi chú (nếu có) là dòng nhỏ bên dưới. */}
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo đáp ứng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.filter((f) => f.value !== "excluded" || counts.excluded > 0).map((f) => (
              <SelectItem key={f.value} value={f.value} title={"hint" in f ? f.hint : undefined}>
                {f.label}
                <span className="text-muted-foreground tabular-nums"> ({counts[f.value].toLocaleString("vi-VN", { useGrouping: false })})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {actions ? <div className="flex items-center gap-2 sm:ms-auto">{actions}</div> : null}
      </div>

      {reasonsNote}

      {groups.length === 0 ? emptyNote : (
        <div className={cn("rounded-lg border", adjust || select ? "overflow-x-auto" : "overflow-hidden")}>
          {/* Mỗi thiết bị MỘT dòng, mỗi thứ một cột: mã và lớp áp dụng có cột riêng thay vì nằm thành dòng
              chữ nhỏ dưới tên / dưới định mức — dòng thấp đi một nửa, và mắt lướt dọc từng cột được.
              `table-fixed`: cột Thiết bị lấy phần còn lại và cắt ba chấm (rê chuột thấy đủ tên, loại). Các cột kia
              cộng lại ~54rem, nên khi chọn trong hộp thoại bảng giữ tối thiểu 72rem (cột Thiết bị còn ~17rem) và
              cuộn ngang nếu hộp hẹp hơn — không thì cột Thiết bị bị ép về 0, tiêu đề Lớp đè lên Thiết bị. */}
          <Table className={cn("table-fixed", adjust && "min-w-[73.75rem]", select && !adjust && "min-w-[72rem]")}>
            {tableHead}
            <TableBody>
              {groups.map((g) => {
                const open = isOpen(g.key);
                return (
                  <Fragment key={g.key}>
                    <TableRow className={cn("group/row cursor-pointer select-none", LIFT_ROW, open && "bg-muted")} aria-expanded={open} onClick={() => toggle(g.key)}>
                      <TableCell colSpan={cols} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-90")} />
                          <span className="text-sm font-semibold">{g.name}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">{g.rows.length} loại thiết bị</span>
                          <span className="ms-auto flex items-center gap-3 text-xs tabular-nums">
                            {g.short ? <span className="text-destructive-text font-medium">Thiếu {g.short}</span> : null}
                            {g.met ? <span className="text-success-text font-medium">Đủ {g.met}</span> : null}
                            {g.surplus ? <span className="text-info-text font-medium">trong đó thừa {g.surplus}</span> : null}
                            {g.unknown ? <span className="text-warning-text font-medium">Chưa tính được {g.unknown}</span> : null}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {open ? g.rows.map((r, i) => row(r, i)) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
