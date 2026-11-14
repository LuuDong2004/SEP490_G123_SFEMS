import { BookOpen, ChevronRight, CircleAlert, LayoutGrid, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";
import { CrossLink } from "@/shared/components/cross-link";
import { HelpHint } from "@/shared/components/form/help-hint";
import { Spinner } from "@/shared/components/spinner";
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

import { LIFT_ROW } from "@/shared/lib/row-lift";

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
 * tính. Dòng tự chọn / phụ lục không ghi số nằm ngoài phép đếm đó — có ô riêng.
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

function matches(filter: Filter, st: State) {
  if (filter === "all") return true;
  if (filter === "met") return st === "met" || st === "surplus";
  if (filter === "excluded") return st === "optional" || st === "none";
  return st === filter;
}

/** Bỏ dấu, chữ thường. Hạ chữ TRƯỚC khi đổi "đ": làm ngược lại thì "Đ" hoa sót dấu. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");
/** Chỉ còn chữ và số — để "09001" khớp mã "THCS-09-001". */
const compact = (s: string) => s.replace(/[^a-z0-9]/g, "");

const haystack = (r: NormRow) => fold(`${r.normName} ${r.catalogCode ?? ""} ${r.subjectName ?? ""} ${r.typeName ?? ""}`);
/** Cụm có nằm liền trong chữ không; mã so cả khi bỏ dấu gạch / khoảng trắng. */
const hasPhrase = (hay: string, q: string) => hay.includes(q) || (compact(q) !== "" && compact(hay).includes(compact(q)));
/** Chữ có đứng ĐẦU một từ không — "chieu" khớp "máy chiếu", không khớp giữa một từ khác. */
const startsWord = (hay: string, w: string) => hay.split(/[^a-z0-9]+/).some((t) => t.startsWith(w));

/**
 * Lọc theo từ khoá, tìm trong tên, mã, môn và loại thiết bị, gõ có dấu hay không đều như nhau. Ưu tiên
 * khớp NGUYÊN CỤM; không dòng nào khớp cụm thì mới tách từng chữ, mỗi chữ phải đứng đầu một từ.
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
          Còn thiếu {r.shortage}, đã đề xuất {r.proposed} ở các phiếu đang chờ duyệt hoặc chưa nhập về. Xin
          thêm là trùng.
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
            : "Phụ lục không ghi số lượng nên không tính đủ hay thiếu."}
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

/** Các dòng đang hiện (sau lọc và tìm) cùng tên bộ lọc — để màn chứa bảng in đúng thứ người dùng đang xem. */
export type AdequacyView = { rows: NormRow[]; filterLabel: string };

/**
 * Bảng đối chiếu danh mục thiết bị tối thiểu của MỘT trường — nhóm theo môn (bấm để mở), mỗi dòng một
 * thiết bị, cột cuối là nhãn trạng thái. Lý do "chưa tính được" không lặp lại trên từng dòng mà gom
 * thành một dòng nhắc trên đầu (rê chuột vào nhãn vẫn thấy lý do của dòng đó). Mặc định lọc "Còn thiếu".
 *
 * @param select có thì mỗi dòng (có thiết bị trong danh mục) có ô tích — hộp chọn thiết bị của đề xuất mua sắm
 * @param collapsed các môn ĐÓNG sẵn (chỉ mở khi đang tìm) — cho màn chuẩn của trường
 */
export function AdequacyTable({ data, select, collapsed, actions, onView, initialFilter }: {
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
  /** Báo các dòng đang hiện mỗi khi lọc / tìm đổi. */
  onView?: (view: AdequacyView) => void;
  /** Bộ lọc lúc mở — mặc định "Còn thiếu". */
  initialFilter?: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "short");
  const [term, setTerm] = useState("");
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("all");
  const [page, setPage] = useState(1);
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
      if (stateOf(r) !== "unknown") continue;
      const key = r.warning ?? "Thiếu dữ liệu để tính";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const groups = useMemo(() => {
    const found = searchRows((data?.rows ?? []).filter((r) => matches(filter, stateOf(r))), term);
    const map = new Map<string,
      { key: string; name: string; rows: NormRow[]; short: number; met: number; surplus: number; unknown: number }>();
    for (const r of data?.rows ?? []) {
      const st = stateOf(r);
      if (!matches(filter, st)) continue;
      if (found && !found.has(r.normId)) continue;
      const key = String(r.subjectId ?? "none");
      if (!map.has(key)) {
        map.set(key, { key, name: r.subjectName ?? "Chưa gắn môn", rows: [], short: 0, met: 0, surplus: 0, unknown: 0 });
      }
      const g = map.get(key)!;
      g.rows.push(r);
      if (st === "short") g.short++;
      else if (st === "met") g.met++;
      else if (st === "surplus") {
        g.met++;
        g.surplus++;
      } else if (st === "unknown") g.unknown++;
    }
    return [...map.values()];
  }, [data, filter, term]);

  useEffect(() => {
    const label = FILTERS.find((f) => f.value === filter)?.label ?? "";
    const subjectName = groups.find((g) => g.key === subject)?.name;
    onView?.({ rows: groups.flatMap((g) => g.rows), filterLabel: subjectName ? `${label} · ${subjectName}` : label });
    // `onView` là hàm của màn chứa; chỉ tính lại khi dữ liệu hiện đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filter, subject]);

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

  if (!data) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <Spinner size="sm" />
        Đang tải…
      </span>
    );
  }
  if (data.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Chưa có danh mục thiết bị tối thiểu cho cấp học của trường này.
      </p>
    );
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
  const cols = select ? 10 : 9;

  /** Một dòng thiết bị. */
  const row = (r: NormRow, i: number) => (
    <TableRow
      key={r.normId}
      // Hộp chọn: bấm cả dòng là tích / bỏ tích, như hộp chọn thiết bị của phiếu ghi tăng.
      className={cn("group/row", LIFT_ROW, select && r.catalogId && !select.disabled?.(r) ? "cursor-pointer" : undefined)}
      onClick={select && r.catalogId && !select.disabled?.(r) ? () => select.onToggle(r) : undefined}
    >
      {select ? (
        <TableCell className="py-1 text-center" onClick={(e) => e.stopPropagation()}>
          {r.catalogId
            ? (() => {
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
              })()
            : null}
        </TableCell>
      ) : null}
      <TableCell className="text-muted-foreground py-2 text-center tabular-nums">{i + 1}</TableCell>
      <TableCell className="text-muted-foreground truncate py-2 font-mono text-xs">{r.catalogCode ?? "—"}</TableCell>
      <TableCell className="truncate py-2" title={`${r.normName}${r.typeName ? ` · ${r.typeName}` : ""}`}>
        {/* Trong hộp chọn thì tên là chữ thường: bấm vào là tích dòng, không rời form đang lập. */}
        {r.catalogId && !select ? (
          <Link to={`/equipment/show/${r.catalogId}`} className="font-medium hover:underline">
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
        {r.required == null ? <span className="text-muted-foreground font-normal">—</span> : r.required}
      </TableCell>
      <TableCell className={cn("py-2 text-right tabular-nums", r.current === 0 && "text-muted-foreground/60")}>
        {r.current}
      </TableCell>
      <TableCell className="text-muted-foreground py-2 text-right tabular-nums">{r.proposed || ""}</TableCell>
      <TableCell className="py-2"><StatusCell r={r} /></TableCell>
    </TableRow>
  );

  const reasonsNote = reasons.length && (filter === "unknown" || filter === "all") ? (
    <div className="bg-warning-subtle text-warning-text flex items-start gap-2 rounded-md px-3 py-2 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        {reasons.map(([reason, n]) => (
          <p key={reason}>
            <span className="font-medium tabular-nums">{n} thiết bị</span> chưa tính được: {reason.toLowerCase()}
            {/giáo viên/i.test(reason) ? (
              <>
                .{" "}
                {/* Đang nằm trong hộp chọn của đề xuất: mở tab mới, không rời form đang lập. */}
                <CrossLink to="/staff" resource="staff" newTab={!!select} className="font-medium underline">
                  Khai môn dạy cho giáo viên
                </CrossLink>
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
        <col className="w-36" />
        <col />
        <col className="w-24" />
        <col className="w-36" />
        <col className="w-20" />
        <col className="w-20" />
        <col className="w-20" />
        <col className="w-36" />
      </colgroup>
      <TableHeader sticky>
        <TableRow>
          {select ? <TableHead /> : null}
          <TableHead className="text-center">STT</TableHead>
          <TableHead>Mã</TableHead>
          <TableHead>Thiết bị</TableHead>
          <TableHead>Lớp</TableHead>
          <TableHead>Định mức</TableHead>
          <TableHead className="text-right">Phải có</TableHead>
          <TableHead className="text-right">Đang có</TableHead>
          <TableHead className="text-right">
            Đề xuất <HelpHint>Đã đề xuất mua, chưa nhập về</HelpHint>
          </TableHead>
          <TableHead>Tình trạng</TableHead>
        </TableRow>
      </TableHeader>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm thiết bị, mã…" className="ps-8" />
        </div>
        {/* Một ô chọn thay cho dải sáu nút: sáu nhãn kèm số chiếm gần hết hàng công cụ. */}
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo đáp ứng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.filter((f) => f.value !== "excluded" || counts.excluded > 0).map((f) => (
              <SelectItem key={f.value} value={f.value} title={"hint" in f ? f.hint : undefined}>
                {f.label}
                <span className="text-muted-foreground tabular-nums"> ({counts[f.value].toLocaleString("vi-VN")})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjects.length > 1 ? (
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Lọc theo môn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><LayoutGrid className="size-4" /> Mọi môn</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  <BookOpen className="size-4" /> {s.name}
                  <span className="text-muted-foreground tabular-nums"> ({s.n})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {actions ? <div className="flex items-center gap-2 sm:ms-auto">{actions}</div> : null}
      </div>

      {reasonsNote}

      {groups.length === 0 ? emptyNote : (
        <div className="overflow-hidden rounded-lg border">
          {/* Mỗi thiết bị MỘT dòng, mỗi thứ một cột. `table-fixed`: cột Thiết bị lấy phần còn lại và cắt ba
              chấm (rê chuột thấy đủ tên, loại). */}
          <Table className="table-fixed">
            {tableHead}
            <TableBody>
              {groups
                .filter((g) => subject === "all" || g.key === subject)
                .map((g) => {
                  const open = isOpen(g.key);
                  return (
                    <Fragment key={g.key}>
                      <TableRow
                        className={cn("group/row cursor-pointer select-none", LIFT_ROW, open && "bg-muted")}
                        aria-expanded={open}
                        onClick={() => toggle(g.key)}
                      >
                        <TableCell colSpan={cols} className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-90")} />
                            <span className="text-sm font-semibold">{g.name}</span>
                            <span className="text-muted-foreground text-xs tabular-nums">{g.rows.length} thiết bị</span>
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
      {groups.length > 0 && groups.reduce((n, g) => n + g.rows.length, 0) > pageSize ? (
        <DataTablePagination
          currentPage={page}
          pageCount={Math.max(1, Math.ceil(groups.reduce((n, g) => n + g.rows.length, 0) / pageSize))}
          setCurrentPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={groups.reduce((n, g) => n + g.rows.length, 0)}
          pageSizeLabel="Số thiết bị mỗi trang"
        />
      ) : null}
    </div>
  );
}

/** Thẻ chỉ số dùng lại ở màn đáp ứng định mức (dải số đầu trang). */
export { Card };
