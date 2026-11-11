package com.g123.sfems.module.catalog.enumcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.enums.LabeledEnum;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.enums.UsagePurpose;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Các danh mục cố định, chỉ đọc (DM-01). Không có mã quyền riêng: đây là nhãn của các giá trị mà mọi
 * màn nghiệp vụ đều hiển thị, chỉ cần đăng nhập như mọi {@code /api}.
 */
@RestController
@RequestMapping("/api/enum_catalogs")
public class EnumCatalogController {

    /** Tên trên đường dẫn → enum. Chỉ những enum khai ở đây mới đọc được. */
    private static final Map<String, Class<? extends LabeledEnum>> CATALOGS = Map.of(
            "asset_categories", AssetCategory.class,
            "usage_purposes", UsagePurpose.class,
            "funding_sources", FundingSource.class,
            "staff_positions", StaffPosition.class);

    public record Item(int sortOrder, String code, String label) {
    }

    @GetMapping("/{name}")
    public List<Item> list(@PathVariable String name) {
        Class<? extends LabeledEnum> type = CATALOGS.get(name);
        if (type == null) {
            throw new ResourceNotFoundException("EnumCatalog", name);
        }
        LabeledEnum[] values = type.getEnumConstants();
        return IntStream.range(0, values.length)
                .mapToObj(i -> new Item(i + 1, values[i].code(), values[i].label()))
                .toList();
    }
}
