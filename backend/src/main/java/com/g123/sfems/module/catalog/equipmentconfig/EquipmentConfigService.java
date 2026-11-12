package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.AttributeDataType;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfigAttribute;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmenttype.EquipmentTypeService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Bộ thông số kỹ thuật. Quy tắc riêng:
 *
 * <ul>
 *   <li>mã thông số không trùng nhau trong một bộ;</li>
 *   <li>thông số kiểu "chọn từ danh sách" phải có ít nhất một lựa chọn;</li>
 *   <li>hai bộ mặc định đang hoạt động không được trùng loại thiết bị, nếu không "bộ chọn sẵn cho
 *       thiết bị mới" có hai đáp án. Bộ không giới hạn loại (phạm vi rỗng) coi như trùng với mọi bộ.</li>
 * </ul>
 */
@Service
public class EquipmentConfigService extends CatalogService<EquipmentConfig, EquipmentConfigRequest, EquipmentConfigPatchRequest> {

    private final EquipmentConfigRepository repository;
    private final EquipmentTypeService equipmentTypes;
    private final SchoolYearService schoolYears;

    public EquipmentConfigService(EquipmentConfigRepository repository, RowLevelSecurity rowLevel,
            EquipmentTypeService equipmentTypes, SchoolYearService schoolYears) {
        super(repository, rowLevel, EquipmentConfig.class, EquipmentConfig::new, "Bộ thông số kỹ thuật");
        this.repository = repository;
        this.equipmentTypes = equipmentTypes;
        this.schoolYears = schoolYears;
    }

    @Override
    protected void applyCreate(EquipmentConfig item, EquipmentConfigRequest request) {
        item.setDescription(blankToNull(request.description()));
        item.setDefaultConfig(request.defaultConfig());
        item.setDocumentNo(blankToNull(request.documentNo()));
        item.setDocumentName(blankToNull(request.documentName()));
        item.setIssueDate(request.issueDate());
        item.setStartSchoolYear(yearOf(request.startSchoolYear()));
        item.setEndSchoolYear(yearOf(request.endSchoolYear()));
        if (request.scopeTypes() != null) {
            syncScopeTypes(item, request.scopeTypes());
        }
        if (request.attributes() != null) {
            syncAttributes(item, request.attributes());
        }
        requireRules(item);
    }

    @Override
    protected void applyUpdate(EquipmentConfig item, EquipmentConfigPatchRequest request) {
        if (request.description() != null) {
            item.setDescription(blankToNull(request.description()));
        }
        if (request.defaultConfig() != null) {
            item.setDefaultConfig(request.defaultConfig());
        }
        if (request.documentNo() != null) {
            item.setDocumentNo(blankToNull(request.documentNo()));
        }
        if (request.documentName() != null) {
            item.setDocumentName(blankToNull(request.documentName()));
        }
        if (request.issueDate() != null) {
            item.setIssueDate(request.issueDate());
        }
        if (request.startSchoolYear() != null) {
            item.setStartSchoolYear(yearOf(request.startSchoolYear()));
        }
        if (request.endSchoolYear() != null) {
            item.setEndSchoolYear(yearOf(request.endSchoolYear()));
        }
        if (request.scopeTypes() != null) {
            syncScopeTypes(item, request.scopeTypes());
        }
        if (request.attributes() != null) {
            syncAttributes(item, request.attributes());
        }
        requireRules(item);
    }

    private SchoolYear yearOf(IdRef ref) {
        return ref == null || ref.id() == null ? null : schoolYears.get(ref.id());
    }

    private void syncScopeTypes(EquipmentConfig item, List<IdRef> refs) {
        Set<Long> ids = refs.stream()
                .filter(ref -> ref != null && ref.id() != null)
                .map(IdRef::id)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        item.getScopeTypes().removeIf(type -> !ids.contains(type.getId()));
        Set<Long> have = item.getScopeTypes().stream().map(EquipmentType::getId).collect(Collectors.toSet());
        for (Long id : ids) {
            if (!have.contains(id)) {
                item.getScopeTypes().add(equipmentTypes.get(id));
            }
        }
    }

    private void syncAttributes(EquipmentConfig item, List<ConfigAttributeInput> inputs) {
        Set<String> codes = new HashSet<>();
        for (ConfigAttributeInput input : inputs) {
            if (!codes.add(input.code().trim().toLowerCase(Locale.ROOT))) {
                throw new FieldValidationException("attributes", "Mã thông số " + input.code().trim() + " bị trùng");
            }
        }

        Map<Long, EquipmentConfigAttribute> existingById = new HashMap<>();
        Map<String, EquipmentConfigAttribute> existingByCode = new HashMap<>();
        for (EquipmentConfigAttribute attribute : item.getAttributes()) {
            existingById.put(attribute.getId(), attribute);
            existingByCode.put(attribute.getCode().toLowerCase(Locale.ROOT), attribute);
        }

        List<EquipmentConfigAttribute> keep = new ArrayList<>();
        int order = 1;
        for (ConfigAttributeInput input : inputs) {
            // Không gửi id mà trùng mã thông số cũ thì vẫn là sửa thông số đó, không thêm dòng trùng mã.
            EquipmentConfigAttribute attribute = input.id() != null
                    ? existingById.get(input.id())
                    : existingByCode.get(input.code().trim().toLowerCase(Locale.ROOT));
            if (attribute == null) {
                attribute = new EquipmentConfigAttribute(item);
                item.getAttributes().add(attribute);
            }
            attribute.setCode(input.code().trim());
            attribute.setName(input.name().trim());
            attribute.setDataType(input.dataType());
            attribute.setMeasureUnit(blankToNull(input.measureUnit()));
            attribute.setRequired(input.required());
            attribute.setOptionList(attribute.getDataType() == AttributeDataType.ENUM ? input.options() : List.of());
            if (attribute.getDataType() == AttributeDataType.ENUM && attribute.getOptionList().isEmpty()) {
                throw new FieldValidationException("attributes",
                        "Thông số " + attribute.getName() + " cần ít nhất một lựa chọn");
            }
            attribute.setSortOrder(order++);
            keep.add(attribute);
        }
        // Sửa trên chính tập Hibernate đang theo dõi, không gán tập mới (orphanRemoval cần điều này).
        item.getAttributes().retainAll(keep);
    }

    private void requireRules(EquipmentConfig item) {
        SchoolYear start = item.getStartSchoolYear();
        SchoolYear end = item.getEndSchoolYear();
        if (start != null && end != null && end.getStartDate().isBefore(start.getStartDate())) {
            throw new FieldValidationException("endSchoolYear", "Năm học kết thúc phải từ năm học bắt đầu trở đi");
        }
        if (!Boolean.TRUE.equals(item.getDefaultConfig()) || !Boolean.TRUE.equals(item.getActive())) {
            return;
        }
        Set<Long> mine = item.getScopeTypes().stream().map(EquipmentType::getId).collect(Collectors.toSet());
        for (EquipmentConfig other : repository.findActiveDefaults()) {
            if (other.getId() == null || Objects.equals(other.getId(), item.getId())) {
                continue;
            }
            Set<Long> theirs = other.getScopeTypes().stream().map(EquipmentType::getId).collect(Collectors.toSet());
            boolean overlap = mine.isEmpty() || theirs.isEmpty() || theirs.stream().anyMatch(mine::contains);
            if (overlap) {
                throw new FieldValidationException("defaultConfig",
                        "Bộ " + other.getCode() + " đã là bộ mặc định cho cùng loại thiết bị");
            }
        }
    }
}
