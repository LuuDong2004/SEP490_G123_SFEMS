import { useShow } from "@refinedev/core";
import type { ReactNode } from "react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ASSET_CATEGORY_LABELS, FUNDING_SOURCE_LABELS } from "@/domains/equipment-intake/types";
import { ASSET_STATUS_LABELS, PHYSICAL_DIGITAL_LABELS, type Equipment } from "@/domains/equipment/types";
import { EquipmentAttachmentsCard } from "./equipment-attachments";
import { EquipmentCodesButton } from "./equipment-codes";
import { EquipmentHistoryCard } from "./equipment-history";
import { EquipmentPhoto } from "./equipment-photo";
import { offBook } from "./equipment-items";
import { UsageTiles } from "./usage-tiles";

type Fact = { label: string; value: ReactNode };

const money = (v: number | null | undefined) => (v == null ? null : `${v.toLocaleString("vi-VN")} đ`);
const yearPair = (a: number | null, b: number | null) => (a || b ? `${a ?? "—"} / ${b ?? "—"}` : null);

/** Một lưới các ô "nhãn — giá trị". Ô chưa khai không hiện: một lưới đầy dấu "—" che mất mấy dòng có nghĩa. */
function Facts({ items }: { items: Fact[] }) {
  const shown = items.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
  if (!shown.length) return <p className="text-muted-foreground text-sm">Chưa khai.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground text-xs">{f.label}</dt>
          <dd className="text-sm font-medium break-words">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Hồ sơ một thiết bị (TS-01): thẻ đầu là tên, mã, trạng thái, trường, hồ sơ đã chuẩn chưa, và dải "Sử dụng"
 * (vị trí, tình trạng, trạng thái, giá trị còn lại); dưới là hai nhóm trường "Định danh & phân loại" và "Nguồn
 * gốc & giá trị"; cuối là lịch sử (TS-04).
 *
 * Hồ sơ đã ra khỏi sổ (thanh lý, mất) chỉ còn để tra: không có nút Sửa, chỉ có Xoá.
 */
export const EquipmentShow = () => {
  const { query, result: r } = useShow<Equipment>();
  const missing = r?.missingProfile ?? [];
  const gone = r ? offBook(r) : false;

  return (
    <ShowView>
      <ShowViewHeader canEdit={!gone && r?._can?.write !== false} canDelete={gone} />
      <LoadingOverlay loading={query.isLoading}>
        {r ? (
          <div className="grid w-full gap-4">
            <Card>
              <CardContent className="flex flex-col gap-6 sm:flex-row">
                <EquipmentPhoto equipmentId={r.id} canWrite={false} />
                <div className="flex min-w-0 flex-1 flex-col gap-5">
                <div className="min-w-0 space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">{r.name}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs font-medium">{r.code}</span>
                    <Badge variant={ASSET_STATUS_VARIANTS[r.status] ?? "secondary"}>{ASSET_STATUS_LABELS[r.status]}</Badge>
                    <EquipmentCodesButton equipmentId={r.id} code={r.code} />
                  </div>
                </div>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">Trường</span>
                    <div className="text-sm font-medium">{r.school?.name ?? "—"}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">Hồ sơ</span>
                    {/* Hồ sơ chưa chuẩn thì phiếu nghiệp vụ không nhận tài sản này — nói rõ còn thiếu gì. */}
                    <div className="text-sm">
                      {missing.length ? (
                        <span className="text-warning-text">Còn thiếu: {missing.join(", ")}</span>
                      ) : (
                        <Badge variant="success">Chuẩn</Badge>
                      )}
                    </div>
                  </div>
                  {r.note ? (
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-muted-foreground text-xs">Ghi chú</span>
                      <p className="text-sm">{r.note}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-overline text-muted-foreground">Sử dụng</span>
                  <UsageTiles record={r} />
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Mỗi nhóm một thẻ trải hết bề ngang, bốn cột: hai thẻ nửa màn thì thẻ ngắn để trống nửa dưới. */}
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">Định danh & phân loại</CardTitle>
              </CardHeader>
              <CardContent>
                <Facts
                  items={[
                    { label: "Danh mục thiết bị", value: r.catalog?.name },
                    { label: "Dạng thiết bị", value: PHYSICAL_DIGITAL_LABELS[r.physicalOrDigital] },
                    { label: "Loại tài sản", value: r.assetCategory ? ASSET_CATEGORY_LABELS[r.assetCategory] : null },
                    { label: "Số lượng", value: r.quantity != null ? `${r.quantity}${r.unit ? ` ${r.unit.name}` : ""}` : null },
                    { label: "Số serial", value: r.serialNumber },
                    { label: "Model", value: r.model },
                    { label: "Hãng sản xuất", value: r.manufacturer },
                    { label: "Mã cũ", value: r.legacyCode },
                  ]}
                />
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">Nguồn gốc & giá trị</CardTitle>
              </CardHeader>
              <CardContent>
                <Facts
                  items={[
                    { label: "Nguồn hình thành", value: r.originSource?.name },
                    { label: "Phương thức hình thành", value: r.acquisitionMethod?.name },
                    { label: "Nguồn kinh phí", value: r.fundingSource ? FUNDING_SOURCE_LABELS[r.fundingSource] : null },
                    { label: "Ngày tiếp nhận", value: r.receivedDate ? formatDate(r.receivedDate) : null },
                    { label: "Ngày mua", value: r.purchaseDate ? formatDate(r.purchaseDate) : null },
                    { label: "Năm sản xuất / sử dụng", value: yearPair(r.productionYear, r.usageStartYear) },
                    { label: "Hết hạn bảo hành", value: r.warrantyExpiry ? formatDate(r.warrantyExpiry) : null },
                    { label: "Nguyên giá", value: money(r.originalValue) },
                  ]}
                />
              </CardContent>
            </Card>

            <EquipmentAttachmentsCard equipmentId={r.id} canWrite={!!r._can?.write} />

            <EquipmentHistoryCard equipmentId={r.id} />

            <dl className="text-muted-foreground flex flex-wrap gap-x-8 gap-y-2 px-1 text-xs">
              <div>
                Tạo lúc <span className="text-foreground">{r.createdAt ? formatDateTime(r.createdAt) : "—"}</span>
              </div>
              <div>
                Sửa lần cuối <span className="text-foreground">{r.updatedAt ? formatDateTime(r.updatedAt) : "—"}</span>
              </div>
            </dl>
          </div>
        ) : null}
      </LoadingOverlay>
    </ShowView>
  );
};
