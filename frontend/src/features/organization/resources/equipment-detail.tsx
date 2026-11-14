/* eslint-disable @typescript-eslint/no-explicit-any -- bản ghi thiết bị đến từ bộ màn danh mục chung, kiểu `any` như `CatalogExtra.show`. */
import { useQuery } from "@tanstack/react-query";
import {
  BookCheck, ChevronRight, CircleCheck, FileText, History, LayoutList, MapPin, Paperclip, School, UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { AssetCodes } from "@/features/organization/equipment-labels/asset-codes";
import { kyInstance } from "@/shared/api/data";
import { FillBox } from "@/shared/components/layout/fill-box";
import { LoadingText } from "@/shared/components/spinner";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  EQUIPMENT_CONDITION_LABELS, EQUIPMENT_HISTORY_ACTION_LABELS, OFF_BOOK_STATUSES, VOUCHER_ROUTES,
  type EquipmentHistoryRow,
} from "@/domains/equipment/types";
import { EquipmentHistoryPanel } from "./equipment-history";
import { EquipmentPhoto } from "./equipment-photo";
import { useVoucherActions } from "./equipment-row-menu";
import { EquipmentStandardCard, EquipmentStandardMini, EquipmentStandardSummary } from "./equipment-standard";

type FieldItem = { label: string; value: ReactNode };

/** Ba cột thông tin ở tab Tổng quan. Tên, trạng thái, trường, vị trí, người quản lý đã ở thẻ trái / dải ô. */
const GROUPS: { title: string; labels: string[] }[] = [
  { title: "Phân loại", labels: ["Thiết bị", "Môn học", "Dạng thiết bị", "Loại", "Phân loại kế toán", "Số lượng", "Mã cũ"] },
  {
    title: "Nguồn gốc và giá trị",
    labels: ["Nguồn gốc", "Nhà cung cấp", "Số hoá đơn", "Ngày hoá đơn", "Nguồn hình thành", "Hình thức mua sắm",
      "Nguồn kinh phí", "Ngày tiếp nhận", "Ngày mua", "Nguyên giá"],
  },
  { title: "Kỹ thuật, bảo hành", labels: ["Số serial", "Model", "Hãng sản xuất", "Thông số kỹ thuật", "Năm sản xuất / sử dụng", "Hết hạn bảo hành", "Bảo hành sau sửa chữa"] },
];
const HEAD = ["Trạng thái", "Hồ sơ", "Trường", "Phòng", "Người quản lý", "Tình trạng", "Giá trị còn lại"];
/** "Thiết bị" ở đây là mục trong danh mục, không phải tên của cái đang xem. */
const SHOWN_AS: Record<string, string> = { "Thiết bị": "DM thiết bị" };

/** Ô chưa khai: chỉ có "—", "/", khoảng trắng (vd. "— / —"). */
const isEmpty = (v: ReactNode) => v == null || v === "" || (typeof v === "string" && /^[\s—/-]*$/.test(v));

type Tab = "overview" | "history" | "standard" | "files";

/**
 * Hồ sơ một thiết bị (phương án AB-1, trưởng nhóm chọn 13/11/2026), vừa một màn: thẻ trái cố định (ảnh, tên, mã,
 * trạng thái, tình trạng, hồ sơ chuẩn, mã QR, "Nghiệp vụ"), bên phải dải năm ô hay tra và tab Tổng quan / Lịch sử /
 * Chuẩn tối thiểu / Tệp. Tổng quan: ba cột thông tin, ô chưa khai gom một dòng, rồi ba thẻ Hoạt động gần đây /
 * Chuẩn tối thiểu / Tệp đính kèm lấp phần còn lại.
 */
export function EquipmentDetail({ record: r, fields }: { record: any; fields: FieldItem[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const by = new Map(fields.map((f) => [f.label, f]));
  const used = new Set([...HEAD, ...GROUPS.flatMap((g) => g.labels)]);
  const rest = fields.filter((f) => !used.has(f.label));
  const canWrite = r?._can?.write !== false;
  const gone = OFF_BOOK_STATUSES.includes(r?.status);

  const groups = [...GROUPS.map((g) => ({ title: g.title, items: g.labels.map((l) => by.get(l)).filter((f): f is FieldItem => !!f) })),
    ...(rest.length ? [{ title: "Khác", items: rest }] : [])];

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "overview", label: "Tổng quan", icon: <LayoutList /> },
    { key: "history", label: "Lịch sử", icon: <History /> },
    ...(r.catalog?.id ? [{ key: "standard" as const, label: "Chuẩn tối thiểu", icon: <BookCheck /> }] : []),
    { key: "files", label: "Tệp, ảnh", icon: <Paperclip /> },
  ];

  return (
    <FillBox className="grid gap-4 lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <SummaryCard r={r} by={by} canWrite={canWrite} />

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <EquipmentStats r={r} />

        <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
          <div role="tablist" aria-label="Hồ sơ thiết bị" className="flex shrink-0 gap-6 border-b px-5">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors [&_svg]:size-4",
                  tab === t.key ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground border-transparent")}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="scrollbar-fade flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            {tab === "overview" ? (
              <>
                <div className="grid gap-x-8 gap-y-5 lg:grid-cols-3">
                  {groups.map((g) => {
                    if (!g.items.length) return null;
                    return (
                      <section key={g.title} className="min-w-0 space-y-2.5">
                        <h3 className="text-overline text-muted-foreground flex items-center gap-2 after:h-px after:flex-1 after:bg-border">{g.title}</h3>
                        <dl className="grid grid-cols-[minmax(7rem,9.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
                          {g.items.map((f) => (
                            <div key={f.label} className="contents">
                              <dt className="text-muted-foreground text-sm">{SHOWN_AS[f.label] ?? f.label}:</dt>
                              {/* Ô chưa khai đứng đúng chỗ của nó, chữ nhạt; bấm vào là sang trang Sửa để bổ sung. */}
                              {isEmpty(f.value) ? (
                                <dd className="text-sm">
                                  {canWrite && !gone ? (
                                    <Link to={`/equipment/edit/${r.id}`} title="Bổ sung"
                                      className="text-muted-foreground/70 hover:text-primary italic hover:underline">Chưa khai</Link>
                                  ) : <span className="text-muted-foreground/70 italic">Chưa khai</span>}
                                </dd>
                              ) : <dd className="min-w-0 text-sm font-medium break-words">{f.value}</dd>}
                            </div>
                          ))}
                        </dl>
                      </section>
                    );
                  })}
                </div>
                {r.note ? <p className="mt-4 text-sm"><span className="text-muted-foreground">Ghi chú: </span>{r.note}</p> : null}

                {/* Ba thẻ lấp phần còn lại của khung — không để một khoảng trắng dưới thông tin. */}
                <div className="mt-5 grid min-h-[13rem] flex-1 gap-4 border-t pt-5 lg:grid-cols-3">
                  <MiniCard icon={<History />} title="Hoạt động gần đây"
                    action={<button type="button" onClick={() => setTab("history")} className="text-primary text-sm font-medium hover:underline">Xem tất cả</button>}>
                    <RecentHistory equipmentId={r.id} />
                  </MiniCard>
                  <MiniCard icon={<BookCheck />} title="Chuẩn tối thiểu">
                    {r.catalog?.id ? <EquipmentStandardMini equipmentId={r.id} /> : (
                      <p className="text-muted-foreground text-sm">Thiết bị ngoài danh mục, không tính đủ hay thiếu.</p>
                    )}
                  </MiniCard>
                  <MiniCard icon={<Paperclip />} title="Tệp đính kèm"
                    action={<button type="button" onClick={() => setTab("files")} className="text-primary text-sm font-medium hover:underline">Mở</button>}>
                    <p className="text-muted-foreground text-sm">
                      Ảnh thiết bị, hồ sơ kỹ thuật, phiếu bảo hành{r.intakeDocument?.lineId ? ", hoá đơn của phiếu ghi tăng" : ""}.
                      {canWrite && !gone ? <> Thêm hoặc xoá khi bấm <Link to={`/equipment/edit/${r.id}`} className="text-primary font-medium hover:underline">Sửa</Link>.</> : null}
                    </p>
                  </MiniCard>
                </div>
              </>
            ) : null}

            {tab === "history" ? <EquipmentHistoryPanel equipmentId={r.id} bare /> : null}

            {tab === "standard" && r.catalog?.id ? <EquipmentStandardCard equipmentId={r.id} catalogId={r.catalog.id} /> : null}

            {tab === "files" ? (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {r.intakeDocument?.lineId ? (
                  <AttachmentsPanel
                    resource="equipment_intake_lines"
                    title="Hoá đơn / chứng từ nhập"
                    recordId={r.intakeDocument.lineId}
                    canWrite={false}
                    compact
                    description={`Hoá đơn, hợp đồng từ phiếu ghi tăng ${r.intake?.code ?? ""}. Thêm hoặc xoá ở phiếu ghi tăng.`}
                  />
                ) : null}
                <AttachmentsPanel
                  resource="equipment"
                  recordId={r.id}
                  canWrite={false}
                  compact
                  className={r.intakeDocument?.lineId ? undefined : "lg:col-span-2"}
                  description={canWrite ? "Ảnh thiết bị, hồ sơ kỹ thuật, phiếu bảo hành. Thêm hoặc xoá tệp ở trang Sửa." : "Ảnh thiết bị, hồ sơ kỹ thuật, phiếu bảo hành."}
                />
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </FillBox>
  );
}

/** Thẻ trái: ảnh (bấm để thêm / đổi), tên, mã + nút mã QR, chip trạng thái, "Nghiệp vụ". Giờ tạo / sửa xem ở tab Lịch sử. */
function SummaryCard({ r, by, canWrite }: { r: any; by: Map<string, FieldItem>; canWrite: boolean }) {
  const kind = r.assetCategory === "SUPPLY" || r.assetCategory === "CHEMICAL" ? "bulk" as const : "serial" as const;
  const { actions, why, href } = useVoucherActions([{ equipmentId: r.id, kind, status: r.status, school: r.school }]);
  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
      <div className="scrollbar-fade min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <div className="h-36 [&>button]:aspect-auto [&>button]:h-full">
            <EquipmentPhoto recordId={r.id} canWrite={canWrite} editable={canWrite} compact />
          </div>
          <h2 className="mt-3 text-lg leading-snug font-bold tracking-tight break-words">{r.name}</h2>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 font-mono text-xs">
            <span className="truncate">{r.code}</span>
            {r.code ? <AssetCodes id={r.id} code={r.code} name={r.name} iconOnly /> : null}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {by.get("Trạng thái")?.value}
            <Badge variant={r.condition === "HONG" ? "destructive" : r.condition === "KEM" ? "warning" : "info"}>
              Tình trạng: {EQUIPMENT_CONDITION_LABELS[r.condition] ?? "Chưa đánh giá"}
            </Badge>
            {r.profileComplete === false ? (
              <Badge variant="warning" title={(r.missingProfile ?? []).length ? `Thiếu: ${r.missingProfile.join(", ")}` : undefined}>Hồ sơ chưa chuẩn</Badge>
            ) : <Badge variant="success">Hồ sơ chuẩn</Badge>}
          </div>
        </div>

        {actions.length ? (
          <div className="mt-3 px-2 pb-2">
            <div className="text-overline text-muted-foreground px-2 py-1">Nghiệp vụ</div>
            {actions.map((a) => {
              const reason = why(a);
              const row = (
                <>
                  <span className="text-primary [&_svg]:size-4">{a.icon}</span>
                  <span className="flex-1">{a.label}</span>
                  <ChevronRight className="text-muted-foreground size-4" />
                </>
              );
              return reason ? (
                <div key={a.key} title={reason} className="text-muted-foreground flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2 py-2 text-sm opacity-50">{row}</div>
              ) : (
                <Link key={a.key} to={href(a)} className="hover:bg-accent flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium">{row}</Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Dải năm ô đầu hồ sơ: Trường / Vị trí / Người quản lý / Phiếu ghi tăng / Chuẩn tối thiểu — dùng chung cho màn xem và màn
 * sửa (`EquipmentFormBody`). Vị trí, người quản lý đổi qua phiếu; hồ sơ chưa xếp chỗ / chưa giao thì màn sửa truyền ô
 * chọn vào `roomSlot` / `managerSlot` để khai lần đầu.
 */
export function EquipmentStats({ r, roomSlot, managerSlot }: { r: any; roomSlot?: ReactNode; managerSlot?: ReactNode }) {
  const canWrite = r?._can?.write !== false;
  const gone = OFF_BOOK_STATUSES.includes(r?.status);
  const moveTo = r?.status === "IN_STOCK"
    ? `/equipment-allocations/create?equipment.id=${r.id}`
    : `/equipment-allocations/create?kind=RELOCATE&equipment.id=${r?.id}`;
  return (
    <dl className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat icon={<School />} label="Trường">{r.school?.name ?? "—"}</Stat>
      <Stat icon={<MapPin />} label="Vị trí"
        action={r.room && canWrite && !gone ? <Link to={moveTo} className="text-primary font-medium hover:underline">Đổi</Link> : null}>
        {r.room?.name ?? roomSlot ?? <span className="text-muted-foreground font-normal">Chưa xếp chỗ</span>}
      </Stat>
      <Stat icon={<UserRound />} label="Người quản lý">
        {r.manager?.name ?? managerSlot ?? <span className="text-muted-foreground font-normal">Chưa giao</span>}
      </Stat>
      <Stat icon={<FileText />} label="Phiếu ghi tăng">
        {r.intake ? (
          <Link to={`/equipment-intakes/show/${r.intake.id}`} className="text-primary font-mono text-[0.8125rem] hover:underline">
            {r.intake.code ?? "Phiếu nháp"}
          </Link>
        ) : <span className="text-muted-foreground font-normal">Khai đầu kỳ</span>}
      </Stat>
      <Stat icon={<CircleCheck />} label="Chuẩn tối thiểu">
        {r.catalog?.id ? <EquipmentStandardSummary equipmentId={r.id} /> : <span className="text-muted-foreground font-normal">Ngoài danh mục</span>}
      </Stat>
    </dl>
  );
}

/** Một ô của dải năm ô: biểu tượng + nhãn có dấu hai chấm (+ nút nhỏ bên phải), giá trị một dòng. */
function Stat({ icon, label, action, children }: { icon: ReactNode; label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card shadow-e1 min-w-0 rounded-xl border px-3.5 py-2.5">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs [&_svg]:size-3.5">
        {icon}<span className="truncate">{label}:</span>
        {action ? <span className="ms-auto text-xs">{action}</span> : null}
      </dt>
      <dd className="mt-0.5 min-w-0 truncate text-sm font-semibold has-[button]:overflow-visible has-[button]:font-normal">{children}</dd>
    </div>
  );
}

function MiniCard({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold [&_svg]:text-muted-foreground [&_svg]:size-4">{icon}{title}</h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Ba mục lịch sử mới nhất — cùng khoá truy vấn với tab Lịch sử nên không gọi máy chủ hai lần. */
function RecentHistory({ equipmentId }: { equipmentId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["equipment_history", equipmentId],
    queryFn: ({ signal }) => kyInstance.get(`equipment/${equipmentId}/history`, { signal }).json<EquipmentHistoryRow[]>(),
  });
  if (isLoading) return <LoadingText />;
  const rows = (Array.isArray(data) ? data : []).slice(0, 3);
  if (!rows.length) return <p className="text-muted-foreground text-sm">Chưa có thay đổi nào được ghi lại.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((h) => {
        const route = h.voucherResource ? VOUCHER_ROUTES[h.voucherResource] : undefined;
        return (
          <li key={h.id} className="flex gap-2.5 text-sm">
            <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
            <div className="min-w-0">
              <div className="font-medium">{EQUIPMENT_HISTORY_ACTION_LABELS[h.action] ?? h.action}</div>
              <div className="text-muted-foreground truncate text-xs">
                {formatDate(h.createdAt)}
                {h.voucherCode ? (
                  <> · {route && h.voucherId ? (
                    <Link to={`${route}/show/${h.voucherId}`} className="text-primary font-mono hover:underline">{h.voucherCode}</Link>
                  ) : <span className="font-mono">{h.voucherCode}</span>}</>
                ) : h.fromValue || h.toValue ? <> · {h.fromValue ?? "—"} → {h.toValue ?? "—"}</> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Dưới form Sửa: nơi thêm / xoá tệp đính kèm và ảnh thiết bị. */
export function EquipmentEditBelow({ record: r }: { record: any }) {
  return (
    <AttachmentsPanel
      resource="equipment"
      recordId={r.id}
      canWrite={r?._can?.write !== false}
      description="Ảnh thiết bị (ảnh đầu tiên là ảnh đại diện), hồ sơ kỹ thuật, phiếu bảo hành. Tối đa 10 MB mỗi tệp."
      note="Tệp được lưu ngay khi tải lên, không cần bấm Lưu thay đổi."
      compact
    />
  );
}
