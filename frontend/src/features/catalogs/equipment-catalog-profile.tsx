import { useCan, useInvalidate, useList } from "@refinedev/core";
import { BookCheck, BookOpen, FileText, Hash, Info, LayoutList, Package, Pencil, Ruler, School, Shapes, Sparkles, Users } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { SwitchRow } from "@/shared/components/form/switch-row";
import { formatDateTime, formatEditedAt } from "@/shared/lib/format";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { MultiRefSelectField } from "@/shared/components/catalog/multi-ref-select";
import { RefField } from "@/shared/components/catalog/ref-field";
import { SchoolItemDialog } from "@/shared/components/catalog/school-item-dialog";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Button } from "@/shared/ui/button";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { LoadingText } from "@/shared/components/spinner";
import { Checkbox } from "@/shared/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { CATALOG_ORIGIN_LABELS, TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";
import { ASSET_CATEGORY_LABELS, PHYSICAL_TYPE_LABELS } from "@/domains/equipment/types";
import { gradesLabel, quantityLabel, type EquipmentNorm } from "@/domains/equipment-standard/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hồ sơ một thiết bị trong Danh mục thiết bị. SỬA và TẠO cùng một bố cục (cùng nhóm, cùng thứ tự, lưới
 * 4 cột); màn XEM là một trang hồ sơ riêng (`EquipmentCatalogDetail`) — chữ thường, không phải ô bị khoá.
 */

const GRID = "grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4";
const NONE = "__none__";

/** Tên các mục của một danh sách tham chiếu, cái chính đứng đầu: "Tiểu học, THCS". Rỗng thì `undefined`. */
const names = (list?: { name: string }[]) => (list?.length ? list.map((x) => x.name).join(", ") : undefined);

/**
 * Thẻ trải hết bề ngang trang, nhưng Ô NHẬP thì không: trên màn rộng mỗi ô của lưới bốn cột dài gần 400px
 * cho một giá trị vài chữ ("Bộ", "Tiểu học"). Nội dung giới hạn ở `max-w-5xl` — mỗi ô khoảng 240px.
 */
function Panel({ children, bare }: { children: ReactNode; /** Trong hộp thoại: không khung, không lề — hộp thoại đã là khung. */ bare?: boolean }) {
  if (bare) return <div className="space-y-6">{children}</div>;
  return (
    <div className="bg-card rounded-lg border p-5 sm:p-6">
      <div className="max-w-5xl space-y-6">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ XEM

type Fact = { label: string; value: ReactNode };
const filled = (f: Fact) => f.value !== null && f.value !== undefined && f.value !== "";

/**
 * Một ô của dải sáu ô — CÙNG KHUÔN với dải ô của hồ sơ thiết bị (`features/organization/resources/equipment-detail`
 * `Stat`): thẻ trắng nổi nhẹ, biểu tượng + nhãn có dấu hai chấm, giá trị đậm. Giá trị dài xuống dòng, không cắt.
 */
function Stat({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="bg-card shadow-e1 min-w-0 rounded-xl border px-3.5 py-2.5">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs [&_svg]:size-3.5">
        {icon}<span className="truncate">{label}:</span>
      </dt>
      <dd className="mt-0.5 text-sm font-semibold break-words">
        {children || <span className="text-muted-foreground font-normal">Chưa khai</span>}
      </dd>
    </div>
  );
}

/** Một cột thông tin của tab Tổng quan: tiêu đề nhỏ có vạch, mỗi dòng "Nhãn: giá trị". Ô chưa khai không hiện. */
function Column({ title, items }: { title: string; items: Fact[] }) {
  const shown = items.filter(filled);
  if (shown.length === 0) return null;
  return (
    <section className="min-w-0 space-y-2.5">
      <h3 className="text-overline text-muted-foreground flex items-center gap-2 after:h-px after:flex-1 after:bg-border">{title}</h3>
      <dl className="grid grid-cols-[minmax(7rem,9.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
        {shown.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground text-sm">{f.label}:</dt>
            <dd className="min-w-0 text-sm font-medium break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Thẻ nhỏ dưới ba cột thông tin — cùng khuôn `MiniCard` của hồ sơ thiết bị. */
function MiniCard({ icon, title, action, className, children }: {
  icon: ReactNode; title: string; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col rounded-xl border p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold [&_svg]:text-muted-foreground [&_svg]:size-4">{icon}{title}</h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

type Tab = "overview" | "norms";

/**
 * Màn XEM một thiết bị trong danh mục — CÙNG BỐ CỤC với hồ sơ thiết bị (phương án AB-1): thẻ trái (biểu tượng, tên,
 * mã, chip, căn cứ), bên phải dải sáu ô hay hỏi, rồi thẻ có tab Tổng quan / Định mức theo thông tư. Tổng quan: ba cột
 * "Nhãn: giá trị" (ô chưa khai không hiện), rồi thẻ Mô tả và thẻ Định mức gọn. Không vẽ lại form với ô bị khoá.
 */
export function EquipmentCatalogDetail({ record: r }: { record: any }) {
  const canEditOwn = useCanEditSchoolItem(r);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const invalidate = useInvalidate();
  const norms = useNorms(r.id);
  const audience = [r.usedByTeacher ? "Giáo viên" : null, r.usedByStudent ? "Học sinh" : null].filter(Boolean).join(", ");
  const tabs: { key: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { key: "overview", label: "Tổng quan", icon: <LayoutList /> },
    ...(norms.mayRead ? [{ key: "norms" as const, label: "Định mức theo thông tư", icon: <BookCheck />, count: norms.rows.length }] : []),
  ];
  return (
    // Kín chiều cao cửa sổ như hồ sơ thiết bị: không để khoảng trắng dưới thẻ, nội dung dài thì cuộn bên trong.
    <FillBox className="grid gap-4 lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      {/* Thẻ trái: nó LÀ gì. */}
      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
        <div className="scrollbar-fade min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="bg-muted/60 text-primary flex h-36 items-center justify-center rounded-xl border [&_svg]:size-10">
            <Package />
          </div>
          <div>
            <h2 className="text-lg leading-snug font-bold tracking-tight break-words">{r.name}</h2>
            <div className="text-muted-foreground mt-0.5 font-mono text-xs">{r.code}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={r.active ? "success" : "neutral"}>{r.active ? "Đang hoạt động" : "Ngừng hoạt động"}</Badge>
            {r.minimumRequired ? <Badge variant="info">Danh mục tối thiểu</Badge> : null}
            {r.ownerSchool ? <Badge variant="warning">Ngoài danh mục · {r.ownerSchool.name}</Badge> : null}
            {r.selfMade ? <Badge variant="neutral">Thiết bị tự làm</Badge> : null}
          </div>
          {/* Thiết bị ngoài danh mục của chính trường: trường sửa được (máy chủ kiểm trường sở hữu). Thiết bị của
              Sở thì sửa ở nút Sửa đầu trang, chỉ Sở có quyền. */}
          {canEditOwn ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Sửa
            </Button>
          ) : null}
        </div>
        {r.legalBasis ? (
          <div className="shrink-0 border-t px-4 py-3">
            <div className="text-overline text-muted-foreground mb-1">Căn cứ</div>
            <p className="text-sm break-words">{r.legalBasis}</p>
          </div>
        ) : null}
      </Card>

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <dl className="grid shrink-0 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat icon={<Shapes />} label="Loại thiết bị">{r.equipmentType?.name}</Stat>
          <Stat icon={<Ruler />} label="Đơn vị tính">{r.unit?.name}</Stat>
          <Stat icon={<School />} label="Cấp học">{names(r.educationLevels) ?? r.educationLevel?.name}</Stat>
          <Stat icon={<BookOpen />} label="Môn học">{names(r.subjects) ?? r.subject?.name}</Stat>
          <Stat icon={<Users />} label="Khối lớp">{names(r.grades) ?? r.grade?.name}</Stat>
          <Stat icon={<Hash />} label="Cách quản lý">{TRACKING_TYPE_LABELS[r.trackingType]}</Stat>
        </dl>

        <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
          <div role="tablist" aria-label="Thiết bị trong danh mục" className="flex shrink-0 gap-6 border-b px-5">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors [&_svg]:size-4",
                  tab === t.key ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground border-transparent")}>
                {t.icon}
                {t.label}
                {t.count ? <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">{t.count}</span> : null}
              </button>
            ))}
          </div>

          <div className="scrollbar-fade flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            {tab === "overview" ? (
              <>
                <div className="grid gap-x-8 gap-y-5 lg:grid-cols-3">
                  <Column title="Phân loại" items={[
                    { label: "Thuộc nhóm", value: r.parent?.name ?? "Nhóm gốc" },
                    { label: "Nguồn", value: r.ownerSchool ? "Trường tự thêm" : "Danh mục của Sở" },
                    { label: "Nguồn gốc", value: r.ownerSchool ? CATALOG_ORIGIN_LABELS[r.origin] : null },
                    { label: "Mã loại TB chuẩn", value: r.teachingCode },
                  ]} />
                  <Column title="Quản lý và hạch toán" items={[
                    { label: "Dạng thiết bị", value: PHYSICAL_TYPE_LABELS[r.physicalOrDigital] },
                    { label: "Phân loại kế toán", value: ASSET_CATEGORY_LABELS[r.assetCategory] },
                    { label: "Mã thống kê", value: r.statisticalCode },
                    { label: "Số năm sử dụng", value: r.usefulLifeYears },
                  ]} />
                  <Column title="Theo thông tư" items={[
                    { label: "DM tối thiểu", value: r.minimumRequired ? "Có" : "Không" },
                    { label: "Đối tượng", value: audience },
                    { label: "Tạo lúc", value: r.createdAt ? formatDateTime(r.createdAt) : null },
                    { label: "Sửa lần cuối", value: formatEditedAt(r) },
                  ]} />
                </div>

                {/* Hai thẻ lấp phần còn lại của khung — không để một khoảng trắng dưới thông tin. */}
                <div className="mt-5 grid min-h-[13rem] flex-1 gap-4 border-t pt-5 lg:grid-cols-3">
                  <MiniCard icon={<FileText />} title="Mô tả, yêu cầu kỹ thuật" className="lg:col-span-2">
                    {r.description ? (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-line">{r.description}</p>
                    ) : <p className="text-muted-foreground text-sm">Chưa có mô tả.</p>}
                    {r.note ? (
                      <p className="mt-3 border-t pt-3 text-sm break-words whitespace-pre-line">
                        <span className="text-muted-foreground">Ghi chú: </span>{r.note}
                      </p>
                    ) : null}
                  </MiniCard>
                  <MiniCard icon={<BookCheck />} title="Định mức theo thông tư"
                    action={norms.rows.length ? (
                      <button type="button" onClick={() => setTab("norms")} className="text-primary text-sm font-medium hover:underline">Xem tất cả</button>
                    ) : null}>
                    <NormsSummary rows={norms.rows} mayRead={norms.mayRead} loading={norms.loading} />
                  </MiniCard>
                </div>
              </>
            ) : null}

            {tab === "norms" ? <NormsTable rows={norms.rows} loading={norms.loading} /> : null}
          </div>
        </Card>
      </div>

      {canEditOwn ? (
        <SchoolItemDialog open={editing} onOpenChange={setEditing} record={r}
          onCreated={() => {
            setEditing(false);
            invalidate({ resource: "equipment_catalogs", invalidates: ["detail", "list"], id: r.id });
          }} />
      ) : null}
    </FillBox>
  );
}

/** Các dòng phụ lục thông tư đòi thiết bị này — chỉ bộ đang áp dụng (bộ nháp / hết hiệu lực chép cùng dòng). */
function useNorms(catalogId: number) {
  const mayRead = useCan({ resource: "equipment_norms", action: "list" }).data?.can ?? false;
  const { result, query } = useList<EquipmentNorm>({
    resource: "equipment_norms",
    filters: [
      { field: "catalog.id", operator: "eq", value: catalogId },
      { field: "standardStatus", operator: "eq", value: "ACTIVE" },
    ],
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: mayRead },
  });
  return { mayRead, loading: mayRead && query.isLoading, rows: result?.data ?? [] };
}

/**
 * Thẻ Định mức gọn ở Tổng quan: định mức của dòng đầu (số lượng tô vàng đồng như "Phải có" của chuẩn tối thiểu),
 * lớp, đối tượng; nhiều dòng thì nói còn bao nhiêu dòng nữa.
 */
function NormsSummary({ rows, mayRead, loading }: { rows: EquipmentNorm[]; mayRead: boolean; loading: boolean }) {
  if (!mayRead) return <p className="text-muted-foreground text-sm">Không có quyền xem định mức.</p>;
  if (loading) return <LoadingText />;
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Không thuộc định mức của bộ tiêu chuẩn nào đang áp dụng.</p>;
  const n = rows[0];
  const box = "rounded-lg py-2.5 text-center";
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className={cn(box, "bg-gold-subtle")}>
          <div className="text-gold-text text-lg font-bold tabular-nums">{quantityLabel(n)}</div>
          <div className="text-muted-foreground text-xs">Định mức</div>
        </div>
        <div className={cn(box, "bg-info-subtle")}>
          <div className="text-info-text text-lg font-bold">{gradesLabel(n.gradeLevels) || "—"}</div>
          <div className="text-muted-foreground text-xs">Lớp</div>
        </div>
        <div className={cn(box, "bg-surface-subtle")}>
          <div className="text-lg font-bold">{[n.forTeacher ? "GV" : null, n.forStudent ? "HS" : null].filter(Boolean).join(" · ") || "—"}</div>
          <div className="text-muted-foreground text-xs">Đối tượng</div>
        </div>
      </div>
      <p className="text-muted-foreground mt-auto text-xs">
        {n.standard?.name}{n.subject?.name ? ` · ${n.subject.name}` : ""}{n.sectionName ? ` / ${n.sectionName}` : ""}
        {rows.length > 1 ? ` · và ${rows.length - 1} dòng phụ lục khác` : ""}
      </p>
    </div>
  );
}

/** Tab Định mức: bảng đủ các dòng phụ lục — cùng khuôn bảng tự vẽ của app. */
function NormsTable({ rows, loading }: { rows: EquipmentNorm[]; loading: boolean }) {
  return (
    <div className="bg-card shadow-e1 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bộ tiêu chuẩn</TableHead>
            <TableHead>Môn / nhóm</TableHead>
            <TableHead className="w-40">Định mức</TableHead>
            <TableHead className="w-28">Lớp</TableHead>
            <TableHead className="w-28">Đối tượng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={5} compact loading={loading} title="Không thuộc định mức của bộ tiêu chuẩn nào đang áp dụng" />
          ) : rows.map((n) => (
            <TableRow key={n.id} className={cn("group/row", LIFT_ROW)}>
              <TableCell className="whitespace-normal">{n.standard?.name}</TableCell>
              <TableCell className="whitespace-normal">
                {n.subject?.name ?? "—"}
                {n.sectionName ? <div className="text-muted-foreground text-xs">{n.sectionName}</div> : null}
              </TableCell>
              <TableCell className="text-gold-text font-semibold tabular-nums">
                {quantityLabel(n)}
                {n.optional ? <Badge variant="neutral" className="ms-2">Tự chọn</Badge> : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{gradesLabel(n.gradeLevels)}</TableCell>
              <TableCell>{[n.forTeacher ? "GV" : null, n.forStudent ? "HS" : null].filter(Boolean).join(" · ") || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ------------------------------------------------------------------ SỬA / TẠO

function TextInput({ control, name, label, placeholder, rules, className, transform, readOnly, required, rule, max }: {
  control: Control<any>;
  name: string;
  label: string;
  required?: boolean;
  /** Ô chỉ đọc (giá trị theo thông tư) — vẫn nằm trong form để gửi lại nguyên giá trị. */
  readOnly?: boolean;
  placeholder?: string;
  rules?: any;
  className?: string;
  transform?: (v: string) => string;
  /** Kiểu trường chuẩn — cùng `@Text` của `EquipmentCatalogRequest`. */
  rule?: TextRule;
  max?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? mergeRules(textRules(rule, label, { max }), rules) : rules}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel required={required || undefined}>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder={placeholder} readOnly={readOnly}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
              className={readOnly ? "bg-muted/60 text-muted-foreground" : undefined}
              onChange={(e) => field.onChange(transform ? transform(e.target.value) : e.target.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EnumInput({ control, name, label, options }: { control: Control<any>; name: string; label: string; options: Record<string, string> }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={(v) => field.onChange(v === NONE ? null : v)} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Vui lòng chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {field.value ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
              {Object.entries(options).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
}

/** Cờ có / không, cùng chiều cao ô nhập để hàng không lệch. */
function SwitchInput({ control, name, label, text }: { control: Control<any>; name: string; label: string; text: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <SwitchRow checked={!!field.value} onCheckedChange={field.onChange} title={label} description={text} />
        </FormItem>
      )}
    />
  );
}

export function EquipmentCatalogFormBody({ control, record, suggestedCode, config, inDialog }: {
  control: any;
  inDialog?: boolean;
  record?: any;
  suggestedCode?: string | null;
  config: CatalogConfig;
}) {
  // Cấp học, môn học, khối lớp chọn NHIỀU (mục đầu là cái chính). Môn và khối chỉ lọc theo cấp khi chọn đúng
  // MỘT cấp — chọn hai cấp thì hai danh sách đó hiện đủ.
  const levels = useWatch({ control, name: "educationLevels" }) as { id: number }[] | undefined;
  const byLevel = levels?.length === 1 ? [{ field: "educationLevel.id", operator: "eq" as const, value: levels[0].id }] : undefined;
  // Thiết bị của danh mục tối thiểu: mọi thứ THÔNG TƯ quy định (mã, tên, cấp, môn, đơn vị tính, mô tả kỹ thuật,
  // khối lớp, đối tượng dùng, trạng thái) không sửa tay — máy chủ cũng từ chối. Chỉ thiết lập quản lý sửa được.
  // Đơn vị tính / mô tả đang trống thì vẫn cho bổ sung (dữ liệu nạp thiếu).
  const byCircular = !!record?.minimumRequired && !record?.ownerSchool;
  const unitLocked = byCircular && !!record?.unit;
  const descriptionLocked = byCircular && !!record?.description?.trim();
  const lockedHint = byCircular ? "Theo thông tư" : undefined;
  const creating = !record;
  const { getValues, setValue } = useFormContext();
  /**
   * Chọn loại thiết bị thì điền sẵn ĐƠN VỊ TÍNH hay dùng nhất của loại đó (Tranh ảnh → Tờ, Hoá chất → Lọ…),
   * đọc từ chính các thiết bị đang có trong danh mục — loại không mang đơn vị tính của riêng nó. Đổi loại thì
   * đơn vị ĐỔI THEO, miễn là ô đang trống hoặc đang giữ đúng giá trị lần gợi ý trước; người dùng đã tự chọn
   * một đơn vị khác thì không đè.
   */
  const suggested = useRef<number | null>(null);
  const suggestUnit = async (typeId?: number) => {
    const untouched = () => {
      const current = getValues("unit.id");
      return !current || Number(current) === suggested.current;
    };
    if (!typeId || !untouched()) return;
    try {
      const rows = await kyInstance
        .get("equipment_catalogs", { searchParams: { _start: 0, _end: 200, "equipmentType.id": typeId } })
        .json<{ unit?: { id: number } | null }[]>();
      const count = new Map<number, number>();
      for (const row of rows) if (row.unit?.id) count.set(row.unit.id, (count.get(row.unit.id) ?? 0) + 1);
      const top = [...count.entries()].sort((x, y) => y[1] - x[1])[0];
      if (!untouched()) return;
      // Loại chưa có thiết bị nào thì không có gì để gợi ý — bỏ luôn gợi ý của loại trước.
      suggested.current = top ? top[0] : null;
      setValue("unit.id", top ? top[0] : null, { shouldDirty: true });
    } catch {
      // Gợi ý thôi — không đọc được thì người dùng tự chọn.
    }
  };
  return (
    <Panel bare={inDialog}>
      {/* Một dòng chữ nhỏ, không phải dải nền chạy hết bề ngang: nó là lời nhắc, không phải nội dung. */}
      <p className="text-muted-foreground flex items-start gap-2 text-xs [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0">
        <Info />
        {byCircular
          ? "Thiết bị theo thông tư: nội dung thông tư quy định không sửa tay — đổi bằng bản nháp bộ tiêu chuẩn ở Danh mục thiết bị tối thiểu. Ở đây chỉ đặt cách quản lý và hạch toán."
          : "Thiết bị thêm tay là thiết bị ngoài danh mục tối thiểu (ngoài thông tư). Thiết bị của thông tư sinh ra khi áp dụng một bộ tiêu chuẩn."}
      </p>

      {/* 1. Nó LÀ gì: mã, tên, đơn vị tính, rồi xếp vào đâu (loại, cấp học, môn, khối). */}
      <FormSection title="Thông tin thiết bị" compact>
        <div className={GRID}>
          <FormField
            control={control}
            name="code"
            rules={mergeRules(textRules("CODE", "Mã DM thiết bị"), { required: "Nhập mã DM thiết bị" })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mã DM thiết bị</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder={config.codeExample} readOnly={byCircular} maxLength={maxLengthOf("CODE")}
                    className={byCircular ? "bg-muted/60 text-muted-foreground" : undefined} />
                </FormControl>
                {suggestedCode ? (
                  <FormDescription className="flex items-center gap-1">
                    <Sparkles className="size-3 shrink-0" />
                    Mã tự động, bạn vẫn sửa được.
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <TextInput control={control} name="name" label="Tên thiết bị" required className="sm:col-span-2" placeholder={config.nameExample} readOnly={byCircular}
            rule="NAME" rules={{ required: "Nhập tên thiết bị" }} />
          <RefField control={control} name="equipmentType" resource="equipment_types" label="Loại thiết bị" current={record?.equipmentType}
            onPicked={(type) => void suggestUnit(type?.id)} />
          {unitLocked ? (
            <ReadField label="Đơn vị tính">{record?.unit?.name}</ReadField>
          ) : (
            <RefField control={control} name="unit" resource="units" label="Đơn vị tính" current={record?.unit}
              hint={byCircular ? undefined : "Tự điền theo loại thiết bị, đổi được."} />
          )}
          <MultiRefSelectField control={control} name="educationLevels" resource="education_levels" label="Cấp học" disabledHint={lockedHint}
            hint={byCircular ? undefined : "Chọn được nhiều cấp; để trống là mọi cấp."} />
          <MultiRefSelectField control={control} name="subjects" resource="subjects" label="Môn học" filters={byLevel} disabledHint={lockedHint}
            hint={byCircular ? undefined : "Chọn được nhiều môn; môn đầu tiên vào mã thiết bị."} />
          <MultiRefSelectField control={control} name="grades" resource="grades" label="Khối lớp" filters={byLevel} disabledHint={lockedHint}
            hint={byCircular ? undefined : "Chọn được nhiều khối; để trống là mọi khối."} />
          {/* Mô tả nằm trong lưới, rộng hai cột, cao một dòng và tự giãn — không phải một ô trải hết bề ngang thẻ. */}
          {descriptionLocked ? (
            <ReadField label="Mô tả / yêu cầu kỹ thuật" className="sm:col-span-2 [&>div]:max-h-40 [&>div]:items-start [&>div]:overflow-y-auto [&>div]:rounded-xl [&>div]:py-2 [&>div]:whitespace-pre-line">
              {record?.description}
            </ReadField>
          ) : <FormField
            control={control}
            name="description"
            rules={textRules("LONG_TEXT", "Mô tả / yêu cầu kỹ thuật", { max: 20000 })}
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Mô tả / yêu cầu kỹ thuật</FormLabel>
                <FormControl>
                  <Textarea rows={1} className="field-sizing-content min-h-9" maxLength={maxLengthOf("LONG_TEXT", 20000)} {...field} value={field.value ?? ""} placeholder="Không bắt buộc" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />}
        </div>
      </FormSection>

      {/* 2. Ta QUẢN LÝ nó thế nào. Khai MỘT LẦN ở đây, form tài sản và dòng phiếu ghi tăng điền theo — khai lại
          cho từng tài sản là cách hai cái cùng lô ra hai kiểu hạch toán. */}
      <FormSection title="Quản lý và hạch toán" compact>
        <div className={GRID}>
          <EnumInput control={control} name="trackingType" label="Cách quản lý" options={TRACKING_TYPE_LABELS} />
          <EnumInput control={control} name="assetCategory" label="Phân loại kế toán" options={ASSET_CATEGORY_LABELS} />
          <EnumInput control={control} name="physicalOrDigital" label="Dạng thiết bị" options={PHYSICAL_TYPE_LABELS} />
          <FormField
            control={control}
            name="usefulLifeYears"
            rules={{
              min: { value: 0, message: "Số năm không được âm" },
              max: { value: 100, message: "Số năm tối đa 100" },
              validate: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Số năm sử dụng phải là số nguyên",
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số năm sử dụng</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="VD: 5" value={field.value ?? ""} name={field.name} ref={field.ref}
                    onBlur={field.onBlur} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Đối tượng sử dụng</FormLabel>
            <div className="bg-field flex h-9 items-center gap-4 rounded-md border px-3">
              {(
                [
                  ["usedByTeacher", "Giáo viên"],
                  ["usedByStudent", "Học sinh"],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <label className={cn("flex items-center gap-1.5 text-sm", byCircular && "text-muted-foreground")} title={lockedHint}>
                      <Checkbox checked={!!field.value} disabled={byCircular} onCheckedChange={(v) => field.onChange(v === true)} />
                      {label}
                    </label>
                  )}
                />
              ))}
            </div>
          </FormItem>
          <SwitchInput control={control} name="selfMade" label="Thiết bị tự làm" text="Có" />
          {/* Mục mới luôn đang hoạt động; ngưng dùng là việc của màn Sửa. Thiết bị của thông tư hết hiệu lực khi
              áp dụng bộ mới không còn nó — không tắt tay. */}
          {creating || byCircular ? null : <SwitchInput control={control} name="active" label="Trạng thái" text="Đang hoạt động" />}
        </div>
      </FormSection>

      {/* 3. Thứ ít dùng và thứ hệ thống đặt — chỉ ở màn SỬA. Lúc thêm mới không ai cần nhóm cha, mã loại
          chuẩn hay mã thống kê, và "nguồn", "thuộc danh mục tối thiểu" thì không phải thứ để nhập. */}
      {creating ? null : (
        <FormSection title="Thông tin khác" compact>
          <div className={GRID}>
            <ReadField label="Thuộc danh mục tối thiểu">{byCircular ? "Có — theo thông tư" : "Không — ngoài thông tư"}</ReadField>
            <ReadField label="Nguồn">{record?.ownerSchool ? `Thiết bị riêng của ${record.ownerSchool.name}` : "Danh mục của Sở"}</ReadField>
            {byCircular ? <ReadField label="Thông tư / Quyết định" className="sm:col-span-2">{record?.legalBasis}</ReadField> : null}
            <RefField control={control} name="parent" resource="equipment_catalogs" label="Thuộc nhóm" current={record?.parent} className="sm:col-span-2" />
            <TextInput control={control} name="teachingCode" label="Mã loại thiết bị chuẩn" placeholder="ABC"
              transform={(v) => v.toUpperCase()} rules={{ pattern: { value: /^$|^[A-Z]{3}$/, message: "Gồm đúng 3 chữ in hoa" } }} />
            <TextInput control={control} name="statisticalCode" label="Mã thống kê" rule="CODE" />
          </div>
        </FormSection>
      )}
    </Panel>
  );
}

/**
 * Trường được sửa thiết bị ngoài danh mục của CHÍNH MÌNH khi có quyền ghi tăng hoặc quyền thiết bị (cùng quyền
 * lúc thêm). Ở góc nhìn trường, thiết bị ngoài danh mục đọc được chỉ là của trường mình, nên không cần so trường
 * ở đây — máy chủ vẫn kiểm.
 */
function useCanEditSchoolItem(r: any) {
  const { perspective } = usePerspective();
  const intakes = useCan({ resource: "equipment_intakes", action: "create" }).data?.can ?? false;
  const equipment = useCan({ resource: "equipment", action: "edit" }).data?.can ?? false;
  return !!r?.ownerSchool && perspective === "school" && (intakes || equipment);
}
