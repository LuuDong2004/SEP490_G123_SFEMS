package com.g123.sfems.module.catalog.originsource;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Arrays;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/origin_sources} — mã quyền {@code origin_sources:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/origin_sources")
public class OriginSourceController extends CatalogController<OriginSource, CatalogRequest, CatalogPatchRequest> {

    public OriginSourceController(OriginSourceService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "origin_sources";
    }

    /** Luật của một nguồn hình thành, cho màn hình: {@code code} khớp {@code systemKey} của dòng danh mục (314). */
    public record Rule(String code, String name, List<FundingSource> fundingSources,
            OriginRule.FundingRequired fundingRequired, boolean noteRequired, boolean acquisitionMethod,
            java.util.Set<String> excludedAcquisitionMethods) {
    }

    /**
     * Nguồn hình thành nào đi với nguồn kinh phí nào — màn hình đọc ở đây thay vì chép lại bảng luật,
     * để ô chọn và câu từ chối của máy chủ không bao giờ lệch nhau.
     */
    @GetMapping("/rules")
    @PreAuthorize("hasAuthority('origin_sources:read')")
    public List<Rule> rules() {
        return Arrays.stream(OriginRule.values())
                .map(r -> new Rule(r.name(), r.label(), r.fundingSources(), r.fundingRequired(), r.noteRequired(),
                        r.acquisitionMethod(), r.excludedAcquisitionMethods()))
                .toList();
    }
}
