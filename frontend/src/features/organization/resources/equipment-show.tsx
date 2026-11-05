import { useShow } from "@refinedev/core";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { ASSET_CATEGORY_LABELS, FUNDING_SOURCE_LABELS } from "@/domains/equipment-intake/types";
import {
  ASSET_STATUS_LABELS,
  CONDITION_LABELS,
  PHYSICAL_DIGITAL_LABELS,
  type Equipment,
} from "@/domains/equipment/types";
import { EquipmentHistoryCard } from "@/features/organization/resources/equipment-history";

const GRID = "grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-3";

/** Chi tiết hồ sơ thiết bị (TS-01), kèm lịch sử (TS-04). */
export const EquipmentShow = () => {
  const { query, result } = useShow<Equipment>();
  const record = result;
  const missing = record?.missingProfile ?? [];

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={query.isLoading}>
        <div className="w-full space-y-6">
          {missing.length > 0 ? (
            <div className="border-warning-text/40 bg-warning-subtle text-warning-text rounded-md border px-4 py-3 text-sm">
              Hồ sơ còn thiếu: {missing.join(", ")}.
            </div>
          ) : null}

          <FormPanel contentClassName="@container space-y-6">
            <FormSection title="Nhận diện" compact>
              <div className={GRID}>
                <ReadField label="Mã tài sản">
                  <span className="font-mono">{record?.code}</span>
                </ReadField>
                <ReadField label="Tên thiết bị" className="@3xl:col-span-2">{record?.name}</ReadField>
                <ReadField label="Danh mục">{record?.catalog?.name}</ReadField>
                <ReadField label="Loại">
                  {record ? PHYSICAL_DIGITAL_LABELS[record.physicalOrDigital] : null}
                </ReadField>
                <ReadField label="Phân loại tài sản">
                  {record?.assetCategory ? ASSET_CATEGORY_LABELS[record.assetCategory] : null}
                </ReadField>
                <ReadField label="Mã cũ">{record?.legacyCode}</ReadField>
                <ReadField label="Số serial">{record?.serialNumber}</ReadField>
                <ReadField label="Model">{record?.model}</ReadField>
                <ReadField label="Hãng sản xuất">{record?.manufacturer}</ReadField>
              </div>
            </FormSection>

            <FormSection title="Trạng thái và vị trí" compact>
              <div className={GRID}>
                <ReadField label="Trạng thái">
                  {record ? (
                    <Badge variant={ASSET_STATUS_VARIANTS[record.status] ?? "secondary"}>
                      {ASSET_STATUS_LABELS[record.status]}
                    </Badge>
                  ) : null}
                </ReadField>
                <ReadField label="Tình trạng">
                  {record?.condition ? CONDITION_LABELS[record.condition] : null}
                </ReadField>
                <ReadField label="Vị trí">
                  {record?.room ? record.room.name : record ? "Kho" : null}
                </ReadField>
                <ReadField label="Số lượng">{record?.quantity}{record?.unit ? ` ${record.unit.name}` : ""}</ReadField>
                <ReadField label="Ngày tiếp nhận">{record?.receivedDate ? formatDate(record.receivedDate) : null}</ReadField>
                <ReadField label="Hết bảo hành">{record?.warrantyExpiry ? formatDate(record.warrantyExpiry) : null}</ReadField>
              </div>
            </FormSection>

            <FormSection title="Nguồn gốc và giá trị" compact>
              <div className={GRID}>
                <ReadField label="Nguồn hình thành">{record?.originSource?.name}</ReadField>
                <ReadField label="Phương thức hình thành">{record?.acquisitionMethod?.name}</ReadField>
                <ReadField label="Nguồn kinh phí">
                  {record?.fundingSource ? FUNDING_SOURCE_LABELS[record.fundingSource] : null}
                </ReadField>
                <ReadField label="Năm sản xuất">{record?.productionYear}</ReadField>
                <ReadField label="Năm đưa vào sử dụng">{record?.usageStartYear}</ReadField>
                <ReadField label="Ngày mua">{record?.purchaseDate ? formatDate(record.purchaseDate) : null}</ReadField>
                <ReadField label="Nguyên giá">
                  {record?.originalValue != null ? record.originalValue.toLocaleString("vi-VN") : null}
                </ReadField>
                <ReadField label="Giá trị còn lại">
                  {record?.remainingValue != null ? record.remainingValue.toLocaleString("vi-VN") : null}
                </ReadField>
                <ReadField label="Ghi chú" className="@3xl:col-span-3">{record?.note}</ReadField>
              </div>
            </FormSection>

            {record ? (
              <p className="text-muted-foreground text-xs">
                Cập nhật lần cuối {formatDateTime(record.updatedAt ?? record.createdAt)}
              </p>
            ) : null}
          </FormPanel>

          {record ? <EquipmentHistoryCard equipmentId={record.id} /> : null}
        </div>
      </LoadingOverlay>
    </ShowView>
  );
};
