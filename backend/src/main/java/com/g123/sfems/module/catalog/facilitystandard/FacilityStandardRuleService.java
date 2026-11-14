package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityLevels;
import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.roomtype.RoomTypeService;
import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quy tắc chuẩn CSVC (QLTB-646). Phần chung ở {@link CatalogService}; lớp này:
 * <ul>
 *   <li>sinh {@code code} = {@code <mã loại>.<cấp>.<mức>}, {@code name} = tên loại, thứ tự theo khối → loại → cấp →
 *       mức — người dùng không gõ ba thứ đó;</li>
 *   <li>chỉ nhận loại của Sở (không loại ngoài danh mục của trường) và loại có áp cho cấp đã chọn;</li>
 *   <li>mỗi (loại, cấp, mức) một quy tắc, và quy tắc phải có ít nhất một điều kiện.</li>
 * </ul>
 */
@Service
public class FacilityStandardRuleService
        extends CatalogService<FacilityStandardRule, FacilityStandardRuleRequest, FacilityStandardRulePatchRequest> {

    private final FacilityStandardRuleRepository rules;
    private final RoomTypeService roomTypes;
    private final CallerSchoolLevel callerLevel;

    public FacilityStandardRuleService(FacilityStandardRuleRepository repository, RowLevelSecurity rowLevel,
            RoomTypeService roomTypes, CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, FacilityStandardRule.class, FacilityStandardRule::new, "Chuẩn CSVC");
        this.rules = repository;
        this.roomTypes = roomTypes;
        this.callerLevel = callerLevel;
    }

    @Override
    protected String codeTarget() {
        return null;
    }

    @Override
    @Transactional
    public FacilityStandardRule create(FacilityStandardRuleRequest request) {
        RoomType type = resolveType(request.roomType() == null ? null : request.roomType().id(), request.levelCode());
        String level = level(request.levelCode());
        String tier = tier(request.tier());
        String code = codeOf(type, level, tier);
        requireFree(code, null);
        return super.create(request.derived(code, type.getName(), sortOrderOf(type, level, tier)));
    }

    @Override
    @Transactional
    public FacilityStandardRule update(Long id, FacilityStandardRulePatchRequest request) {
        return super.update(id, request.withoutDerived());
    }

    @Override
    protected void applyCreate(FacilityStandardRule item, FacilityStandardRuleRequest request) {
        item.setRoomType(resolveType(request.roomType().id(), request.levelCode()));
        item.setLevelCode(level(request.levelCode()));
        item.setTier(tier(request.tier()));
        item.setMinCount(request.minCount());
        item.setCountPerClass(request.countPerClass());
        item.setMinRoomArea(request.minRoomArea());
        item.setAreaPerStudent(request.areaPerStudent());
        item.setMinTotalArea(request.minTotalArea());
        item.setLegalBasis(blankToNull(request.legalBasis()));
        requireCondition(item);
    }

    @Override
    protected void applyUpdate(FacilityStandardRule item, FacilityStandardRulePatchRequest request) {
        String level = request.levelCode() == null ? item.getLevelCode() : level(request.levelCode());
        RoomType type = request.roomType() == null || request.roomType().id() == null ? item.getRoomType()
                : resolveType(request.roomType().id(), level);
        if (!FacilityLevels.applies(type.getLevels(), level)) {
            throw new FieldValidationException("levelCode", "Loại CSVC này không áp cho cấp " + level);
        }
        String tier = request.tier() == null ? item.getTier() : tier(request.tier());
        String code = codeOf(type, level, tier);
        if (!code.equalsIgnoreCase(item.getCode())) {
            // Kiểm TRƯỚC khi gán — truy vấn kiểm trùng đẩy bản ghi đang sửa xuống DB.
            requireFree(code, item.getId());
        }
        item.setRoomType(type);
        item.setLevelCode(level);
        item.setTier(tier);
        item.setCode(code);
        item.setName(type.getName());
        item.setSortOrder(sortOrderOf(type, level, tier));
        // Form gửi đủ các điều kiện: trống là bỏ điều kiện đó.
        item.setMinCount(request.minCount());
        item.setCountPerClass(request.countPerClass());
        item.setMinRoomArea(request.minRoomArea());
        item.setAreaPerStudent(request.areaPerStudent());
        item.setMinTotalArea(request.minTotalArea());
        item.setLegalBasis(blankToNull(request.legalBasis()));
        requireCondition(item);
    }

    @Override
    protected Specification<FacilityStandardRule> extraFilters(ListParams params) {
        List<Specification<FacilityStandardRule>> specs = new ArrayList<>();
        specs.add(CatalogSpecifications.referenceFilter(params, "roomType"));
        for (ListParams.Criterion c : params.filters()) {
            String value = c.value() == null ? "" : c.value().trim();
            switch (c.field()) {
                case "levelCode" -> specs.add((root, q, cb) -> cb.equal(root.get("levelCode"), value));
                case "tier" -> specs.add((root, q, cb) -> cb.equal(root.get("tier"), value));
                case "group.id" -> {
                    Long id = parseId(value);
                    if (id != null) {
                        specs.add((root, q, cb) -> cb.equal(root.get("roomType").get("group").get("id"), id));
                    }
                }
                default -> {
                }
            }
        }
        // Tài khoản của MỘT trường chỉ thấy chuẩn đúng cấp học của trường mình (trường THCS không có việc gì với chuẩn
        // tiểu học, THPT). Ghép AND, query string không nới được. Sở, UBND, quản trị không bị thu hẹp.
        String level = callerLevel.educationLevelCode();
        if (level != null) {
            specs.add((root, q, cb) -> cb.equal(root.get("levelCode"), level));
        }
        return Specification.allOf(specs);
    }

    // ------------------------------------------------------------------ luật

    /** Loại của Sở, có áp cho cấp đã chọn (cấp lạ thì để {@link #level} báo). */
    private RoomType resolveType(Long id, String levelCode) {
        if (id == null) {
            throw new FieldValidationException("roomType", "Vui lòng chọn loại CSVC");
        }
        RoomType type = roomTypes.get(id);
        if (type.getSchoolId() != null) {
            throw new FieldValidationException("roomType", "Chỉ đặt chuẩn cho loại CSVC của Sở");
        }
        if (levelCode != null && FacilityLevels.ALL.contains(levelCode)
                && !FacilityLevels.applies(type.getLevels(), levelCode)) {
            throw new FieldValidationException("levelCode", "Loại CSVC này không áp cho cấp " + levelCode);
        }
        return type;
    }

    private static String level(String value) {
        if (value == null || !FacilityLevels.ALL.contains(value)) {
            throw new FieldValidationException("levelCode", "Cấp học không hợp lệ");
        }
        return value;
    }

    private static String tier(String value) {
        if (value == null || !FacilityStandardRule.TIERS.contains(value)) {
            throw new FieldValidationException("tier", "Mức không hợp lệ");
        }
        return value;
    }

    private static void requireCondition(FacilityStandardRule item) {
        if (item.getMinCount() == null && item.getCountPerClass() == null && item.getMinRoomArea() == null
                && item.getAreaPerStudent() == null && item.getMinTotalArea() == null) {
            throw new FieldValidationException("minCount", "Nhập ít nhất một điều kiện");
        }
    }

    private void requireFree(String code, Long selfId) {
        rules.findByCodeIgnoreCase(code).filter(existing -> !Objects.equals(existing.getId(), selfId))
                .ifPresent(existing -> {
                    throw new FieldValidationException("tier", "Loại này đã có quy tắc ở cấp và mức đã chọn");
                });
    }

    /** {@code <mã loại>.<cấp>.<mức>}; mã loại quá dài thì dùng id loại để vừa 64 ký tự. */
    static String codeOf(RoomType type, String level, String tier) {
        String suffix = "." + level + "." + tier;
        String head = type.getCode();
        return head.length() + suffix.length() <= 64 ? head + suffix : "T" + type.getId() + suffix;
    }

    /** Khối × 10000 + loại × 10 + cấp × 3 + mức — cùng công thức với changelog 203. */
    static int sortOrderOf(RoomType type, String level, String tier) {
        int group = type.getGroup() == null || type.getGroup().getSortOrder() == null ? 0
                : type.getGroup().getSortOrder();
        int order = type.getSortOrder() == null ? 0 : type.getSortOrder();
        return group * 10000 + order * 10 + FacilityLevels.ALL.indexOf(level) * 3
                + FacilityStandardRule.TIERS.indexOf(tier);
    }

    private static Long parseId(String value) {
        try {
            return value == null || value.isBlank() ? null : Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
