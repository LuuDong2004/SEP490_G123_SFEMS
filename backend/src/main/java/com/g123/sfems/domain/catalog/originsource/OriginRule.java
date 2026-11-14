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
 * Bảy NGUỒN HÌNH THÀNH và những gì mỗi nguồn kéo theo — chỗ DUY NHẤT nói nguồn hình thành nào đi với
 * nguồn kinh phí nào, có bắt buộc nguồn kinh phí không, có hình thức mua sắm không.
 *
 * <p>Danh mục {@code origin_sources} vẫn là bảng (tài sản và phiếu trỏ tới nó bằng khoá ngoại), nhưng
 * là danh mục CỐ ĐỊNH: bảy dòng mang đúng bảy {@link #name() mã} dưới đây, do changelog {@code 109} (và
 * {@code 251} cho "Mua sắm ngoài kế hoạch") đặt, không thêm - sửa - xoá được qua màn hình. Luật rẽ nhánh theo từng giá trị nên nó phải nằm
 * trong code; màn hình đọc luật qua {@code GET /api/origin_sources/rules} chứ không chép lại, để hai
 * bên không lệch nhau.
 */
public enum OriginRule {
    /**
     * Mua theo KẾ HOẠCH MUA SẮM của Sở / UBND: phiếu phải đi từ một đề xuất của trường nằm trong kế hoạch (kiểm lúc
     * trình — {@code EquipmentIntakeService.requirePlanLink}). Trường tự mua ngoài kế hoạch ghi {@link #MUA_NGOAI_KH}.
     */
    MUA_SAM("Kế hoạch mua sắm", FundingRequired.ALWAYS, false, true,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER),
    /**
     * Trường tự mua KHÔNG nằm trong kế hoạch mua sắm (mua gấp, mua lẻ bằng kinh phí tự chủ — trưởng nhóm 14/11/2026):
     * vẫn là hàng mua — hoá đơn, đơn giá, hình thức mua sắm như {@link #MUA_SAM} — nhưng không phải chọn kế hoạch.
     */
    MUA_NGOAI_KH("Mua sắm ngoài kế hoạch", FundingRequired.ALWAYS, false, true,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER),
    /** Nhận theo quyết định điều chuyển (Sở mua tập trung rồi giao về, đơn vị khác chuyển sang): tiền ngân sách. */
    PHAN_BO("Được điều chuyển", FundingRequired.ALWAYS, false, false,
            STATE_BUDGET),
    TANG_TAI_TRO("Được tặng, tài trợ", FundingRequired.ALWAYS, false, false,
            SPONSORSHIP),
    /** Thấy khi kiểm kê mà sổ không có: thường không còn biết tiền từ đâu — không bắt buộc, không lọc. */
    KIEM_KE_THUA("Kiểm kê thừa", FundingRequired.NEVER, false, false,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER),
    /** Giáo viên, học sinh tự làm: chỉ khi có mua vật tư thì mới có nguồn kinh phí để khai. */
    TU_LAM("Đơn vị tự làm", FundingRequired.WHEN_COST, false, false,
            TUITION, REVENUE, DEVELOPMENT_FUND, OTHER),
    KHAC("Khác", FundingRequired.ALWAYS, true, false,
            STATE_BUDGET, TUITION, REVENUE, DEVELOPMENT_FUND, SPONSORSHIP, OTHER);

    /** Khi nào một dòng ghi tăng PHẢI có nguồn kinh phí. */
    public enum FundingRequired {
        ALWAYS,
        /** Chỉ khi dòng có chi phí (đơn giá lớn hơn 0). */
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

    /** Tên của nguồn hình thành — cũng là tên dòng tương ứng trong {@code origin_sources}. */
    public String label() {
        return label;
    }

    public FundingRequired fundingRequired() {
        return fundingRequired;
    }

    /** Phải ghi rõ ("Khác" là nguồn gì) thì báo cáo mới đọc được. */
    public boolean noteRequired() {
        return noteRequired;
    }

    /** Có khai hình thức mua sắm không — chỉ hàng MUA mới có đấu thầu, chỉ định thầu, mua trực tiếp. */
    public boolean acquisitionMethod() {
        return acquisitionMethod;
    }

    /** Hàng MUA (theo hay ngoài kế hoạch): đòi nhà cung cấp, số / ngày hoá đơn, đơn giá lớn hơn 0. */
    public boolean purchase() {
        return this == MUA_SAM || this == MUA_NGOAI_KH;
    }

    /** Các nguồn kinh phí chọn được, theo thứ tự hiển thị. */
    public List<FundingSource> fundingSources() {
        return fundingSources;
    }

    /**
     * Nguồn kinh phí này có đi được với nguồn hình thành này không. "Chưa xác định nguồn" luôn hợp lệ
     * ở nơi nguồn kinh phí không bắt buộc tuyệt đối — đó chính là giá trị được điền khi để trống.
     */
    public boolean allows(FundingSource funding) {
        return fundingSources.contains(funding)
                || (funding == UNDETERMINED && fundingRequired != FundingRequired.ALWAYS);
    }

    /** Dòng có đơn giá này thì có phải khai nguồn kinh phí không. */
    public boolean requiresFunding(BigDecimal unitPrice) {
        return switch (fundingRequired) {
            case ALWAYS -> true;
            case WHEN_COST -> unitPrice != null && unitPrice.signum() > 0;
            case NEVER -> false;
        };
    }

    /** Luật của một dòng danh mục, theo mã; rỗng nếu mã không thuộc bảy nguồn cố định. */
    public static Optional<OriginRule> of(OriginSource origin) {
        if (origin == null || origin.getCode() == null) {
            return Optional.empty();
        }
        return Arrays.stream(values()).filter(r -> r.name().equals(origin.getCode())).findFirst();
    }
}
