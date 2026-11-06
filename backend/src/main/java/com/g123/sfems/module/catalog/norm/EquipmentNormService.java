package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.equipmenttype.EquipmentTypeService;
import com.g123.sfems.module.catalog.grade.GradeService;
import com.g123.sfems.module.catalog.roomtype.RoomTypeService;
import com.g123.sfems.module.catalog.standard.EquipmentStandardService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.math.BigDecimal;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EquipmentNormService extends CatalogService<
        EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {
    private final EquipmentStandardService standards;
    private final EquipmentCatalogService catalogs;
    private final EquipmentTypeService types;
    private final SubjectService subjects;
    private final GradeService grades;
    private final RoomTypeService rooms;
    private final UnitService units;

    public EquipmentNormService(EquipmentNormRepository repository, RowLevelSecurity rowLevel,
            EquipmentStandardService standards, EquipmentCatalogService catalogs,
            EquipmentTypeService types, SubjectService subjects, GradeService grades,
            RoomTypeService rooms, UnitService units) {
        super(repository, rowLevel, EquipmentNorm.class, EquipmentNorm::new, "Dòng định mức");
        this.standards = standards;
        this.catalogs = catalogs;
        this.types = types;
        this.subjects = subjects;
        this.grades = grades;
        this.rooms = rooms;
        this.units = units;
    }

    @Override
    protected void applyCreate(EquipmentNorm item, EquipmentNormRequest request) {
        EquipmentStandard standard = ref(request.standard(), standards::get);
        if (standard == null) throw new FieldValidationException("standard", "Chọn bộ tiêu chuẩn");
        EquipmentStandardService.requireDraft(standard);
        item.setStandard(standard);
        item.setCatalog(ref(request.catalog(), catalogs::get));
        item.setEquipmentType(ref(request.equipmentType(), types::get));
        item.setSubject(ref(request.subject(), subjects::get));
        item.setGrade(ref(request.grade(), grades::get));
        item.setRoomType(ref(request.roomType(), rooms::get));
        item.setMinQuantity(request.minQuantity());
        item.setBasisSize(request.basisSize());
        item.setQuantityText(blankToNull(request.quantityText()));
        item.setUnitText(blankToNull(request.unitText()));
        item.setUnit(ref(request.unit(), units::get));
        if (request.normBasis() != null) item.setNormBasis(request.normBasis());
        item.setItemNo(blankToNull(request.itemNo()));
        item.setTopic(blankToNull(request.topic()));
        item.setPurpose(blankToNull(request.purpose()));
        item.setDescription(blankToNull(request.description()));
        item.setForTeacher(Boolean.TRUE.equals(request.forTeacher()));
        item.setForStudent(Boolean.TRUE.equals(request.forStudent()));
        item.setOptional(Boolean.TRUE.equals(request.optional()));
        inheritCatalog(item);
        validate(item);
    }

    @Override
    @Transactional
    public EquipmentNorm update(Long id, EquipmentNormPatchRequest request) {
        EquipmentNorm item = getWritable(id);
        EquipmentStandardService.requireDraft(item.getStandard());
        return super.update(id, request);
    }

    @Override
    protected void applyUpdate(EquipmentNorm item, EquipmentNormPatchRequest request) {
        if (request.standard() != null && !item.getStandard().getId().equals(request.standard().id())) {
            throw new FieldValidationException("standard", "Không chuyển dòng sang bộ tiêu chuẩn khác");
        }
        if (request.catalog() != null) item.setCatalog(ref(request.catalog(), catalogs::get));
        if (request.equipmentType() != null) item.setEquipmentType(ref(request.equipmentType(), types::get));
        if (request.subject() != null) item.setSubject(ref(request.subject(), subjects::get));
        if (request.grade() != null) item.setGrade(ref(request.grade(), grades::get));
        if (request.roomType() != null) item.setRoomType(ref(request.roomType(), rooms::get));
        if (request.minQuantity() != null) item.setMinQuantity(request.minQuantity());
        if (request.basisSize() != null) item.setBasisSize(request.basisSize());
        if (request.quantityText() != null) item.setQuantityText(blankToNull(request.quantityText()));
        if (request.unitText() != null) item.setUnitText(blankToNull(request.unitText()));
        if (request.unit() != null) item.setUnit(ref(request.unit(), units::get));
        if (request.normBasis() != null) item.setNormBasis(request.normBasis());
        if (request.itemNo() != null) item.setItemNo(blankToNull(request.itemNo()));
        if (request.topic() != null) item.setTopic(blankToNull(request.topic()));
        if (request.purpose() != null) item.setPurpose(blankToNull(request.purpose()));
        if (request.description() != null) item.setDescription(blankToNull(request.description()));
        if (request.forTeacher() != null) item.setForTeacher(request.forTeacher());
        if (request.forStudent() != null) item.setForStudent(request.forStudent());
        if (request.optional() != null) item.setOptional(request.optional());
        inheritCatalog(item);
        validate(item);
    }

    @Override
    protected void beforeDelete(EquipmentNorm item) {
        EquipmentStandardService.requireDraft(item.getStandard());
    }

    @Override
    protected Specification<EquipmentNorm> extraFilters(ListParams params) {
        return Specification.allOf(List.of(
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "standard"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "catalog"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "subject"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "grade"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "equipmentType")));
    }

    private void inheritCatalog(EquipmentNorm item) {
        if (item.getCatalog() == null) return;
        if (item.getCatalog().getOwnerSchool() != null) {
            throw new FieldValidationException("catalog", "Định mức chỉ dùng thiết bị trong danh mục chung của Sở");
        }
        if (item.getEquipmentType() == null) item.setEquipmentType(item.getCatalog().getEquipmentType());
        if (item.getSubject() == null) item.setSubject(item.getCatalog().getSubject());
        if (item.getUnit() == null) item.setUnit(item.getCatalog().getUnit());
    }

    private static void validate(EquipmentNorm item) {
        if (item.getMinQuantity() != null && item.getMinQuantity().compareTo(BigDecimal.ZERO) < 0) {
            throw new FieldValidationException("minQuantity", "Số lượng tối thiểu không được âm");
        }
        if (item.getBasisSize() != null && item.getBasisSize() < 1) {
            throw new FieldValidationException("basisSize", "Cỡ nhóm phải từ 1 trở lên");
        }
        if (item.getGrade() != null && (item.getGrade().getGradeNumber() == null
                || item.getGrade().getGradeNumber() < 10 || item.getGrade().getGradeNumber() > 12)) {
            throw new FieldValidationException("grade", "Chỉ chọn khối 10, 11 hoặc 12");
        }
        if (item.getCatalog() != null && item.getCatalog().getEducationLevel() != null
                && !"THPT".equalsIgnoreCase(item.getCatalog().getEducationLevel().getCode())) {
            throw new FieldValidationException("catalog", "Thiết bị định mức phải thuộc cấp THPT");
        }
    }

    private static <T> T ref(IdRef ref, Function<Long, T> find) {
        return ref == null || ref.id() == null ? null : find.apply(ref.id());
    }
}
