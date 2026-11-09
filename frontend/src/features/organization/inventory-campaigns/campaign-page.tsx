import { useResourceParams } from "@refinedev/core";

import { CampaignFormDialog } from "@/features/organization/inventory-campaigns/campaign-form-dialog";
import { CampaignList } from "@/features/organization/inventory-campaigns/campaign-list";

/**
 * Màn đợt kiểm kê cho ba đường dẫn list / create / edit: danh sách luôn nằm dưới, hộp thoại phát động
 * hoặc sửa mở đè lên theo đường dẫn hiện tại.
 */
export function CampaignPage() {
  const { action, id } = useResourceParams();
  return (
    <>
      <CampaignList />
      {action === "create" || action === "edit" ? (
        <CampaignFormDialog key={`${action}-${id ?? ""}`} action={action} id={id} />
      ) : null}
    </>
  );
}
