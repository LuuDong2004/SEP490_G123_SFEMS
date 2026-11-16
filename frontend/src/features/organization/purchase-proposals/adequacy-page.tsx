import { CircleAlert, CircleCheck, ClipboardCheck, Clock, FileSpreadsheet, Loader2, Search, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { getAuthorities, getPerspective } from "@/shared/api/session";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { HelpHint } from "@/shared/components/form/help-hint";
import { TableEmpty } from "@/features/organization/resources/table-empty";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type {
  AdequacySummary,
  CatalogBalance,
  CatalogSchool,
  ProcurementSummary,
  SchoolAdequacy,
  SchoolStandardRow,
} from "@/domains/procurement/types";
import { AdequacyTable } from "@/features/organization/purchase-proposals/adequacy-table";

const RESOURCE = "purchase_proposals";
const money = new Intl.NumberFormat("vi-VN");
const ALL = "__all__";
const HEAD = "text-overline text-muted-foreground";

/**
 * Mức đáp ứng định mức của MỘT trường (NC-01) — bảng đối chiếu danh mục thiết bị tối thiểu với số đang có
 * và số đã đề xuất. Trường chỉ thấy trường mình; Sở và quản trị chọn trường để xem.
 */
function useAdequacy(schoolId: number | null | undefined) {
  return useQuery({
    queryKey: [RESOURCE, "adequacy", schoolId],
    enabled: schoolId != null,
    queryFn: ({ signal }) =>
      kyInstance
        .get(`${RESOURCE}/adequacy`, { signal, searchParams: { schoolId: String(schoolId) } })
        .json<SchoolAdequacy>(),
  });
}

function Figure({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className={cn("shrink-0 [&>svg]:size-5", tone ?? "text-primary")}>{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className="text-xl leading-tight font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Dải chỉ số của một trường: số thiết bị đã đủ / còn thiếu / chưa tính được và tổng số còn thiếu. */
function SchoolFigures({ data }: { data: SchoolAdequacy | undefined }) {
  const total = data ? data.met + data.unknown + data.rows.filter((r) => r.required != null && r.shortage !== 0).length : 0;
  return (
    <Card className="gap-0 py-0">
      <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <Figure icon={<ClipboardCheck />} label="Thiết bị trong định mức" value={data ? data.norms : "…"} hint="dòng tính được số phải có" />
        <Figure icon={<CircleCheck />} tone="text-success-text" label="Đã đủ" value={data ? data.met : "…"} hint={total ? `trên ${total} thiết bị` : undefined} />
        <Figure icon={<CircleAlert />} tone="text-destructive-text" label="Còn thiếu" value={data ? data.shortageTotal : "…"} hint="tổng số lượng phải mua thêm" />
        <Figure
          icon={<Clock />}
          tone="text-warning-text"
          label="Chưa tính được"
          value={data ? data.unknown : "…"}
          hint="thiếu số lớp, số học sinh hoặc dữ liệu giáo viên"
        />
      </div>
    </Card>
  );
}

/** Một dòng của bảng tổng hợp: một trường, tỉ lệ đáp ứng và tổng số còn thiếu. */
function summaryCell(row: SchoolStandardRow) {
  const tone = row.percent >= 90 ? "success" : row.percent >= 60 ? "warning" : "destructive";
  return <Badge variant={tone} className="tabular-nums">{row.percent}%</Badge>;
}

/**
 * Tổng hợp đề xuất mua sắm theo năm ngân sách — phần riêng của phân hệ Mua sắm, chỉ có nghĩa với cơ quan
 * quản lý (một trường xem đề xuất của mình ở tab Đề xuất mua sắm).
 *
 * <p>Một thẻ đầu: chọn năm ngân sách và bốn con số (cùng khuôn dải chỉ số ở các màn khác). Bên dưới hai
 * bảng: thiết bị cần mua (phần chính) và theo cơ quan quản lý.
 */
function ProcurementSummaryCard() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear + 1));
  // Mỗi cơ quan lập kế hoạch mua sắm của RIÊNG mình — mặc định xem cơ quan của chính người đăng nhập, chọn
  // được cơ quan khác hoặc "Mọi cơ quan".
  const ownBody = getAuthorities()?.managingBodyId ?? null;
  const [body, setBody] = useState<string>(ownBody != null ? String(ownBody) : ALL);
  const all = useQuery({
    queryKey: ["procurement_plans", "summary", year],
    queryFn: ({ signal }) =>
      kyInstance.get("procurement_plans/summary", { signal, searchParams: { year } }).json<ProcurementSummary>(),
  });
  const one = useQuery({
    queryKey: ["procurement_plans", "summary", year, body],
    enabled: body !== ALL,
    queryFn: ({ signal }) =>
      kyInstance
        .get("procurement_plans/summary", { signal, searchParams: { year, body } })
        .json<ProcurementSummary>(),
  });

  const bodies = all.data?.bodies ?? [];
  const p = body === ALL ? all.data : one.data;
  const bodyName = body === ALL ? "mọi cơ quan" : (bodies.find((b) => String(b.bodyId) === body)?.bodyName ?? p?.bodies[0]?.bodyName);
  const sum = (key: "proposals" | "pending" | "approved" | "planned") =>
    (p?.bodies ?? []).reduce((n, b) => n + b[key], 0);
  // Tên trùng (máy chiếu của danh mục THCS và THPT là hai thiết bị) thì kèm mã để phân biệt.
  const dupNames = new Set((p?.catalogs ?? []).map((c) => c.catalogName).filter((n, i, list) => list.indexOf(n) !== i));

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <span className="text-sm font-medium">Năm ngân sách</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-28" aria-label="Năm ngân sách"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-medium">Cơ quan</span>
          <Select value={body} onValueChange={setBody}>
            <SelectTrigger className="h-8 w-80 max-w-full" aria-label="Cơ quan quản lý">
              <SelectValue placeholder="Vui lòng chọn cơ quan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi cơ quan</SelectItem>
              {/* Cơ quan của người xem luôn có trong danh sách, kể cả khi năm này nó chưa có đề xuất nào. */}
              {ownBody != null && !bodies.some((b) => b.bodyId === ownBody) ? (
                <SelectItem value={String(ownBody)}>Cơ quan của tôi</SelectItem>
              ) : null}
              {bodies.map((b) => (
                <SelectItem key={b.bodyId ?? "none"} value={String(b.bodyId)}>{b.bodyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Figure icon={<Wallet />} label="Tổng dự toán đề xuất" value={p ? `${money.format(p.amount)} đ` : "…"} hint={p ? `${money.format(sum("proposals"))} đề xuất` : undefined} />
          <Figure icon={<CircleCheck />} tone="text-success-text" label="Đã được duyệt" value={p ? `${money.format(p.approvedAmount)} đ` : "…"} hint={p ? `${money.format(sum("approved"))} đề xuất` : undefined} />
          <Figure icon={<Clock />} tone="text-warning-text" label="Đang chờ duyệt" value={p ? money.format(sum("pending")) : "…"} hint="đề xuất" />
          <Figure icon={<ClipboardCheck />} label="Đã vào kế hoạch" value={p ? money.format(sum("planned")) : "…"} hint="đề xuất" />
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <StepTitle title="Thiết bị cần mua" aside={p ? `${money.format(p.catalogs.length)} thiết bị · ${bodyName ?? ""}` : undefined} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(HEAD, "ps-4")}>Thiết bị</TableHead>
                <TableHead className={cn(HEAD, "w-28 text-right")}>Số lượng</TableHead>
                <TableHead className={cn(HEAD, "w-24 text-right")}>Số trường</TableHead>
                <TableHead className={cn(HEAD, "w-36 pe-4 text-right")}>Dự toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!p || p.catalogs.length === 0 ? (
                <TableEmpty colSpan={4} loading={!p} title="Chưa có đề xuất cho năm này." />
              ) : (
                p.catalogs.map((c) => (
                  <TableRow key={c.catalogId} className={cn("group/row", LIFT_ROW)}>
                    <TableCell className="ps-4 whitespace-normal">
                      <span className="font-medium">{c.catalogName}</span>
                      {dupNames.has(c.catalogName) ? (
                        <span className="text-muted-foreground ms-2 font-mono text-xs">{c.catalogCode}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(c.quantity)} <span className="text-muted-foreground">{c.unitName ?? ""}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.schools}</TableCell>
                    <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format(c.amount)} đ</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <StepTitle title="Theo cơ quan quản lý" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(HEAD, "ps-4")}>Cơ quan</TableHead>
                <TableHead className={cn(HEAD, "w-20 text-right")} title="Chờ duyệt / đã duyệt / vào kế hoạch">Đề xuất</TableHead>
                <TableHead className={cn(HEAD, "w-36 pe-4 text-right")}>Dự toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bodies.length === 0 ? (
                <TableEmpty colSpan={3} loading={!all.data} title="Chưa có đề xuất cho năm này." />
              ) : (
                bodies.map((b) => (
                  <TableRow
                    key={b.bodyId ?? 0}
                    className={cn("group/row", LIFT_ROW, "cursor-pointer", String(b.bodyId) === body && "bg-primary/10 hover:bg-primary/10")}
                    onClick={() => setBody(String(b.bodyId))}
                    title="Xem đề xuất của cơ quan này"
                  >
                    <TableCell className="ps-4 whitespace-normal">
                      <span className="block font-medium">{b.bodyName}</span>
                      <span className="text-muted-foreground text-xs">
                        {b.schools} trường · {b.pending} chờ duyệt · {b.approved} đã duyệt · {b.planned} vào kế hoạch
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.proposals}</TableCell>
                    <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format(b.amount)} đ</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

/**
 * Cân đối theo thiết bị trên địa bàn: mỗi thiết bị một dòng, tổng thiếu / tổng thừa và phần điều chuyển
 * được. Bấm một dòng để xem trường nào đang thiếu, trường nào thừa cùng thiết bị đó.
 */
function BalanceTable({ catalogs }: { catalogs: CatalogBalance[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: schools } = useQuery({
    queryKey: [RESOURCE, "adequacy-catalog", openId],
    enabled: openId != null,
    queryFn: ({ signal }) =>
      kyInstance
        .get(`${RESOURCE}/adequacy-catalog`, { signal, searchParams: { catalogId: String(openId) } })
        .json<CatalogSchool[]>(),
  });
  const moving = catalogs.filter((c) => c.transferable > 0);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b px-4 py-3">
        <StepTitle
          title="Cân đối thiết bị giữa các trường"
          aside={catalogs.length > 0 ? `${moving.length} thiết bị điều chuyển được` : undefined}
          hint={
            <HelpHint>
              Thiết bị trường này thừa là thứ trường khác đang thiếu. "Điều chuyển được" là phần nhỏ hơn của
              tổng thiếu và tổng thừa — phần còn lại vẫn phải mua.
            </HelpHint>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(HEAD, "ps-4")}>Thiết bị</TableHead>
            <TableHead className={cn(HEAD, "w-24 text-right")}>Thiếu</TableHead>
            <TableHead className={cn(HEAD, "w-32 text-right")}>Số trường thiếu</TableHead>
            <TableHead className={cn(HEAD, "w-24 text-right")}>Thừa</TableHead>
            <TableHead className={cn(HEAD, "w-32 text-right")}>Số trường thừa</TableHead>
            <TableHead className={cn(HEAD, "w-32 pe-4 text-right")}>Điều chuyển được</TableHead>          </TableRow>
        </TableHeader>
        <TableBody>
          {catalogs.length === 0 ? (
            <TableEmpty colSpan={6} title="Chưa có thiết bị nào khai định mức." />
          ) : (
            catalogs.map((c) => (
              <Fragment key={c.catalogId}>
                <TableRow
                  className={cn("group/row", LIFT_ROW, "cursor-pointer")}
                  onClick={() => setOpenId(openId === c.catalogId ? null : c.catalogId)}
                  title="Xem trường nào thiếu, trường nào thừa thiết bị này"
                >
                  <TableCell className="ps-4 whitespace-normal">
                    <span className="font-medium">{c.name}</span>
                    {c.subjectName ? (
                      <span className="text-muted-foreground ms-2 text-xs">{c.subjectName}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", c.shortage > 0 && "text-destructive-text font-medium")}>
                    {c.shortage || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{c.shortSchools || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.surplus || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{c.surplusSchools || "—"}</TableCell>
                  <TableCell className="text-success-text pe-4 text-right font-medium tabular-nums">
                    {c.transferable || "—"}
                  </TableCell>
                </TableRow>
                {openId === c.catalogId ? (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/40 p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={cn(HEAD, "ps-10")}>Trường</TableHead>
                            <TableHead className={cn(HEAD, "w-28 text-right")}>Phải có</TableHead>
                            <TableHead className={cn(HEAD, "w-28 text-right")}>Đang có</TableHead>
                            <TableHead className={cn(HEAD, "w-24 text-right")}>Thiếu</TableHead>
                            <TableHead className={cn(HEAD, "w-24 pe-4 text-right")}>Thừa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!schools || schools.length === 0 ? (
                            <TableEmpty colSpan={5} loading={!schools} title="Không trường nào khai định mức cho thiết bị này." />
                          ) : (
                            schools
                              .filter((s) => s.shortage > 0 || s.surplus > 0)
                              .map((s) => (
                                <TableRow key={s.schoolId}>
                                  <TableCell className="ps-10 whitespace-normal">
                                    <span className="text-sm font-medium">{s.schoolName}</span>
                                    <span className="text-muted-foreground ms-2 font-mono text-xs">{s.schoolCode}</span>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{s.required ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{s.current}</TableCell>
                                  <TableCell className={cn("text-right tabular-nums", s.shortage > 0 && "text-destructive-text font-medium")}>
                                    {s.shortage || "—"}
                                  </TableCell>
                                  <TableCell className="pe-4 text-right tabular-nums">{s.surplus || "—"}</TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

/** Bảng tổng hợp đáp ứng định mức của mọi trường người xem được thấy — bấm một dòng để mở bảng chi tiết. */
function SummaryTable({ data, onOpen }: { data: AdequacySummary | undefined; onOpen: (row: SchoolStandardRow) => void }) {
  const [term, setTerm] = useState("");
  const q = term.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (r) => !q || r.schoolName.toLowerCase().includes(q) || r.schoolCode.toLowerCase().includes(q),
  );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <StepTitle
          title="Mức đáp ứng định mức theo trường"
          aside={data ? `${data.schools} trường · ${data.percent}% đáp ứng` : undefined}
          hint={<HelpHint>Đáp ứng tính trên số thiết bị của danh mục tối thiểu mà trường đã có đủ. Bấm một dòng để xem từng thiết bị.</HelpHint>}
        />
        <div className="relative w-full sm:w-64 sm:ms-auto">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tìm trường trong bảng…"
            aria-label="Tìm trường trong bảng"
            className="ps-8"
          />
        </div>
        <div className="w-full sm:w-64">
          <AsyncCombobox<{ id: number; name: string }>
            resource="schools"
            value={null}
            onChange={(id) => {
              const found = (data?.rows ?? []).find((r) => r.schoolId === id);
              if (found) onOpen(found);
            }}
            labelOf={(s) => s.name}
            placeholder="Mở bảng của một trường…"
            searchPlaceholder="Gõ tên hoặc mã trường…"
            clearable={false}
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(HEAD, "ps-4")}>Trường</TableHead>
            <TableHead className={cn(HEAD, "w-20 text-right")}>Cấp</TableHead>
            <TableHead className={cn(HEAD, "w-24 text-right")}>Định mức</TableHead>
            <TableHead className={cn(HEAD, "w-20 text-right")}>Đủ</TableHead>
            <TableHead className={cn(HEAD, "w-24 text-right")}>Còn thiếu</TableHead>
            <TableHead className={cn(HEAD, "w-20 text-right")}>Chưa tính</TableHead>
            <TableHead className={cn(HEAD, "w-24 pe-4 text-right")}>Đáp ứng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data || rows.length === 0 ? (
            <TableEmpty colSpan={7} loading={!data} title={q ? "Không có trường nào khớp." : "Chưa có trường nào khai định mức."} />
          ) : (
            rows.map((r) => (
              <TableRow
                key={r.schoolId}
                className={cn("group/row", LIFT_ROW, "cursor-pointer")}
                onClick={() => onOpen(r)}
                title="Xem mức đáp ứng của trường này"
              >
                <TableCell className="ps-4 whitespace-normal">
                  <span className="font-medium">{r.schoolName}</span>
                  <span className="text-muted-foreground ms-2 font-mono text-xs">{r.schoolCode}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-xs">{r.level ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.norms}</TableCell>
                <TableCell className="text-success-text text-right tabular-nums">{r.met}</TableCell>
                <TableCell className={cn("text-right tabular-nums", r.shortageTotal > 0 && "text-destructive-text font-medium")}>
                  {r.shortageTotal || "—"}
                </TableCell>
                <TableCell className="text-warning-text text-right tabular-nums">{r.unknown || "—"}</TableCell>
                <TableCell className="pe-4 text-right">{summaryCell(r)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * Mức đáp ứng định mức và nhu cầu mua sắm (NC-01, phân hệ Mua sắm): một trường thấy bảng đối chiếu của
 * mình; Sở và quản trị thấy bảng tổng hợp mọi trường, bấm một dòng để mở bảng chi tiết, và ở dưới là bảng
 * tổng hợp đề xuất mua sắm theo năm ngân sách.
 *
 * <p>Trường đang xem nằm trên đường dẫn (`?school=`), nên gửi liên kết cho người khác là mở đúng trường đó.
 */
export const EquipmentAdequacy = () => {
  const [params, setParams] = useSearchParams();
  const perspective = getPerspective();
  const requested = params.get("school");
  const schoolId = requested != null ? Number(requested) : null;
  const { data: detail } = useAdequacy(schoolId);
  const { data: summary } = useQuery({
    queryKey: [RESOURCE, "adequacy-summary"],
    enabled: schoolId == null,
    queryFn: ({ signal }) => kyInstance.get(`${RESOURCE}/adequacy-summary`, { signal }).json<AdequacySummary>(),
  });

  const open = (row: SchoolStandardRow) => setParams({ school: String(row.schoolId) }, { replace: true });
  const back = () => setParams({}, { replace: true });

  // Xuất Excel đúng bảng đang xem: một trường thì bảng của trường, đang ở bảng tổng hợp thì bảng tổng hợp.
  const [exporting, setExporting] = useState(false);
  async function exportXlsx() {
    setExporting(true);
    try {
      const path = schoolId != null ? `${RESOURCE}/adequacy.xlsx` : `${RESOURCE}/adequacy-summary.xlsx`;
      const blob = await kyInstance
        .get(path, { searchParams: schoolId != null ? { schoolId: String(schoolId) } : undefined })
        .blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = schoolId != null ? `muc-dap-ung-${schoolId}.xlsx` : "muc-dap-ung-dinh-muc.xlsx";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ListView>
      <ListViewHeader
        actions={
          <Button variant="outline" onClick={exportXlsx} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Xuất Excel
          </Button>
        }
      />
      {/* Một trường: chỉ có bảng chi tiết của chính mình — không có gì để tổng hợp, cũng không chọn được
          trường khác (máy chủ chặn). */}
      {schoolId != null ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {perspective === "school" ? null : (
              <button type="button" onClick={back} className="text-primary text-sm font-medium hover:underline">
                ← Mọi trường
              </button>
            )}
            <span className="text-sm font-medium">{detail?.schoolName ?? "Đang tải…"}</span>
            {detail ? <Badge variant="neutral">{detail.schoolCode}</Badge> : null}
            {detail?.classCount != null || detail?.studentCount != null ? (
              <span className="text-muted-foreground text-sm">
                {detail.classCount != null ? `${detail.classCount} lớp` : null}
                {detail.classCount != null && detail.studentCount != null ? " · " : null}
                {detail.studentCount != null ? `${detail.studentCount} học sinh` : null}
              </span>
            ) : null}
          </div>
          <SchoolFigures data={detail} />
          <AdequacyTable data={detail} initialFilter="short" />
        </div>
      ) : (
        <div className="space-y-4">
          <SummaryTable data={summary} onOpen={open} />
          <BalanceTable catalogs={summary?.catalogs ?? []} />
          {perspective === "school" ? null : <ProcurementSummaryCard />}
        </div>
      )}
    </ListView>
  );
};
