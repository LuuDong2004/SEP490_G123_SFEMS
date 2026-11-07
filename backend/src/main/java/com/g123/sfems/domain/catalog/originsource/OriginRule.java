package com.g123.sfems.domain.catalog.originsource;

import static com.g123.sfems.domain.catalog.enums.FundingSource.DEVELOPMENT_FUND;
import static com.g123.sfems.domain.catalog.enums.FundingSource.OTHER;
import static com.g123.sfems.domain.catalog.enums.FundingSource.REVENUE;
import static com.g123.sfems.domain.catalog.enums.FundingSource.SPONSORSHIP;
import static com.g123.sfems.domain.catalog.enums.FundingSource.STATE_BUDGET;
import static com.g123.sfems.domain.catalog.enums.FundingSource.TUITION;
import static com.g123.sfems.domain.catalog.enums.FundingSource.UNDETERMINED;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Sáu nguồn hình thành và luật đi kèm từng nguồn: chọn được nguồn kinh phí nào, có bắt buộc nguồn
 * kinh phí không, có khai hình thức mua sắm không.
 *
 * <p>Bảng {@code origin_sources} giữ đúng sáu dòng có mã trùng tên hằng dưới đây và không thêm, sửa,
 * xoá được qua màn hình. Luật rẽ nhánh theo từng giá trị nên đặt trong code; màn hình đọc luật qua
 * {@code GET /api/origin_sources/rules} để ô chọn và lời từ chối của máy chủ luôn khớp nhau.
 */
public enum OriginRule {
    /**
     * Trường bỏ tiền mua, kể cả tiền nhà tài trợ đưa rồi trường tự mua (khác "Được tặng, tài trợ" là
     * nhận thẳng hiện vật). Chỉ nguồn này có hình thức mua sắm.
     */
    MUA_SAM("Mua sắm", FundingRequired.ALWAYS, false, true,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER),
    /** Sở mua rồi phân bổ về trường: tiền ngân sách. */
    PHAN_BO("Được Sở phân bổ", FundingRequired.ALWAYS, false, false,
            STATE_BUDGET),
    TANG_TAI_TRO("Được tặng, tài trợ", FundingRequired.ALWAYS, false, false,
            SPONSORSHIP),
    /** Thấy khi kiểm kê mà sổ không có: thường không còn biết tiền từ đâu, nên không bắt buộc. */
    KIEM_KE_THUA("Kiểm kê thừa", FundingRequired.NEVER, false, false,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER),
    /** Giáo viên, học sinh tự làm: chỉ khi có mua vật tư mới có nguồn kinh phí để khai. */
    TU_LAM("Đơn vị tự làm", FundingRequired.WHEN_COST, false, false,
            TUITION, REVENUE, DEVELOPMENT_FUND, OTHER),
    /** Phải ghi rõ là nguồn gì thì báo cáo mới đọc được. */
    KHAC("Khác", FundingRequired.ALWAYS, true, false,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER);

    /** Khi nào tài sản ghi tăng phải có nguồn kinh phí. */
    public enum FundingRequired {
        ALWAYS,
        /** Chỉ khi có chi phí (đơn giá lớn hơn 0). */
        WHEN_COST,
        NEVER
    }

    private final String label;
    private final FundingRequired fundingRequired;
    private final boolean noteRequired;
    private final boolean acquisitionMethod;
    private final List<FundingSource> fundingSources;

    OriginRule(String label, FundingRequired fundingRequired, boolean noteRequired, boolean acquisitionMethod,
            FundingSource... fundingSources) {
        this.label = label;
        this.fundingRequired = fundingRequired;
        this.noteRequired = noteRequired;
        this.acquisitionMethod = acquisitionMethod;
        this.fundingSources = List.of(fundingSources);
    }

    /** Tên nguồn hình thành, trùng tên dòng tương ứng trong {@code origin_sources}. */
    public String label() {
        return label;
    }

    public FundingRequired fundingRequired() {
        return fundingRequired;
    }

    /** Phải ghi rõ nguồn cụ thể. */
    public boolean noteRequired() {
        return noteRequired;
    }

    /** Có khai hình thức mua sắm (đấu thầu, chỉ định thầu, mua trực tiếp…) không. */
    public boolean acquisitionMethod() {
        return acquisitionMethod;
    }

    /** Các nguồn kinh phí chọn được, theo thứ tự hiển thị. */
    public List<FundingSource> fundingSources() {
        return fundingSources;
    }

    /**
     * Nguồn kinh phí này có đi được với nguồn hình thành này không. "Chưa xác định nguồn" hợp lệ khi
     * nguồn kinh phí không bắt buộc tuyệt đối: đó là giá trị được ghi khi người lập để trống.
     */
    public boolean allows(FundingSource funding) {
        return fundingSources.contains(funding)
                || (funding == UNDETERMINED && fundingRequired != FundingRequired.ALWAYS);
    }

    /** Tài sản có đơn giá này thì có phải khai nguồn kinh phí không. */
    public boolean requiresFunding(BigDecimal unitPrice) {
        return switch (fundingRequired) {
            case ALWAYS -> true;
            case WHEN_COST -> unitPrice != null && unitPrice.signum() > 0;
            case NEVER -> false;
        };
    }

    /** Luật của một dòng danh mục, theo mã; rỗng nếu mã không thuộc sáu nguồn cố định. */
    public static Optional<OriginRule> of(OriginSource origin) {
        if (origin == null || origin.getCode() == null) {
            return Optional.empty();
        }
        return Arrays.stream(values()).filter(rule -> rule.name().equals(origin.getCode())).findFirst();
    }
}
