package com.g123.sfems.module.school.inventory;

import com.g123.sfems.shared.data.RecordAccess;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm của đợt kiểm kê ({@code resource = inventory_campaigns}) — công văn, kế hoạch kiểm kê của Sở gửi các
 * trường. Trường thấy đợt thì tải được tệp; chỉ cơ quan đã phát động thêm / xoá tệp.
 */
@Component
public class InventoryCampaignAttachmentAccess implements RecordAccess {

    private final InventoryCampaignService service;

    public InventoryCampaignAttachmentAccess(InventoryCampaignService service) {
        this.service = service;
    }

    @Override
    public String resource() {
        return "inventory_campaigns";
    }

    @Override
    public Set<String> allowedExtensions() {
        return Set.of("pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg");
    }

    @Override
    public void checkReadable(Long id) {
        service.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        service.getWritable(id);
    }
}
