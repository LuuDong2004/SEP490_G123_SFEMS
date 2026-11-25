package com.g123.sfems.module.catalog.equipmentcatalog;

import jakarta.persistence.criteria.Subquery;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.equipmentcatalog.CatalogOrigin;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.equipmenttype.EquipmentTypeService;
import com.g123.sfems.module.catalog.grade.GradeService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.web.ListParams;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import org.hibernate.Hibernate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.g123.sfems.domain.catalog.enums.AssetCategory;

/**
 * Nhóm thiết bị. Quy tắc riêng: cây không được có vòng — nhóm cha không thể là
 * chính nó hay một nhóm con cháu của nó.
 */
@Service
public class EquipmentCatalogService extends CatalogService<
        EquipmentCatalog, EquipmentCatalogRequest, EquipmentCatalogPatchRequest> {

    /** Chặn trên cho vòng dò tổ tiên — cây thật chỉ vài tầng. */
    private static final int MAX_DEPTH = 32;

    private final EquipmentTypeService equipmentTypes;
    private final SubjectService subjects;
    private final EducationLevelService educationLevels;
    private final GradeService grades;
    private final UnitService units;
    /** Kho của lớp cha là kiểu chung; truy vấn cây cần đúng kho của nhóm thiết bị. */
    private final EquipmentCatalogRepository catalogTree;
    private final SchoolService schools;
    private final VisibleSchools visibleSchools;
    private final CallerSchoolLevel callerLevel;

    public EquipmentCatalogService(
            EquipmentCatalogRepository repository,
            RowLevelSecurity rowLevel,
            EquipmentTypeService equipmentTypes,
            SubjectService subjects,
            EducationLevelService educationLevels,
            GradeService grades,
            UnitService units,
            SchoolService schools,
            VisibleSchools visibleSchools,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, EquipmentCatalog.class, EquipmentCatalog::new,
                "Nhóm thiết bị");
        this.equipmentTypes = equipmentTypes;
        this.subjects = subjects;
        this.educationLevels = educationLevels;
        this.grades = grades;
        this.units = units;
        this.catalogTree = repository;
        this.schools = schools;
        this.visibleSchools = visibleSchools;
        this.callerLevel = callerLevel;
    }

    /**
     * Trường thêm một thiết bị NGOÀI danh mục của Sở, ngay lúc ghi tăng. Mã do hệ thống cấp
     * ({@code NDM-<mã trường>-<số>}), thiết bị thuộc riêng trường đó.
     *
     * <p>Trùng tên với một thiết bị trong danh mục của Sở thì từ chối và nêu tên — thứ Sở đã có thì
     * chọn cái của Sở, để báo cáo theo từng thiết bị cộng được. Trùng tên một thiết bị ngoài danh
     * mục trường đã thêm cũng từ chối: chọn lại cái cũ.
     */
    @Transactional
    public EquipmentCatalog createForSchool(SchoolItemRequest request, Long schoolId) {
        if (schoolId == null) {
            throw new FieldValidationException("school",
                    "Chỉ tài khoản của một trường mới thêm được thiết bị ngoài danh mục");
        }
        School school = schools.get(schoolId);
        String name = request.name().trim();
        rejectSameName(name, school, null, "chọn thiết bị đó");

        EquipmentCatalog item = new EquipmentCatalog();
        item.setCode(nextSchoolCode(school));
        item.setActive(true);
        item.setOwnerSchool(school);
        applySchoolItem(item, request, name);
        return catalogTree.persist(item);
    }

    /**
     * Trường sửa thiết bị ngoài danh mục CỦA CHÍNH MÌNH — cùng các ô như lúc thêm (form gửi lại đủ). Thiết bị của
     * Sở hay của trường khác thì như không có (404): trường không ghi được danh mục, chỉ ghi đồ của mình. Đổi cách
     * quản lý (từng cái / số lượng) khi đã có tài sản thì từ chối — tài sản đã cấp mã theo cách cũ.
     */
    @Transactional
    public EquipmentCatalog updateForSchool(Long id, SchoolItemRequest request, Long schoolId) {
        EquipmentCatalog item = get(id);
        if (schoolId == null || item.getOwnerSchool() == null || !schoolId.equals(item.getOwnerSchool().getId())) {
            throw new ResourceNotFoundException("EquipmentCatalog", id);
        }
        String name = request.name().trim();
        rejectSameName(name, item.getOwnerSchool(), id, "đặt tên khác");
        TrackingType wanted = request.trackingType() == null ? item.getTrackingType() : request.trackingType();
        if (wanted != item.getTrackingType() && assetCount(id) > 0) {
            throw new FieldValidationException("trackingType",
                    "Đã có thiết bị thuộc mục này trong hệ thống nên không đổi được cách quản lý");
        }
        item.getExtraSubjects().clear();
        applySchoolItem(item, request, name);
        return item;
    }

    /** Kết quả so tên: thiết bị TRÙNG (cùng bộ từ — chặn) và tối đa ba thiết bị GẦN GIỐNG (chỉ gợi ý). */
    public record NameMatches(EquipmentCatalog same, List<EquipmentCatalog> similar) {
        static final NameMatches NONE = new NameMatches(null, List.of());
    }

    /**
     * Ô kiểm tên của hộp "Thêm thiết bị ngoài danh mục" — cùng luật với lúc lưu ({@link #rejectSameName}), nên điều
     * màn hình báo và điều máy chủ chặn không lệch nhau. {@code excludeId}: thiết bị đang sửa.
     */
    @Transactional(readOnly = true)
    public NameMatches checkSchoolItemName(String name, Long schoolId, Long excludeId) {
        if (schoolId == null) {
            return NameMatches.NONE;
        }
        NameMatches found = nameMatches(name, schools.get(schoolId), excludeId);
        if (found.same() != null) {
            loadForResponse(found.same());
        }
        found.similar().forEach(this::loadForResponse);
        return found;
    }

    /** Lúc lưu: trùng bộ từ với một thiết bị trường chọn được (của Sở hoặc của chính trường) thì từ chối và nêu tên. */
    private void rejectSameName(String name, School school, Long excludeId, String advice) {
        EquipmentCatalog existing = nameMatches(name, school, excludeId).same();
        if (existing != null) {
            throw new ConflictException((existing.getOwnerSchool() == null
                    ? "Danh mục của Sở đã có thiết bị \"%s\" (mã %s) — %s"
                    : "Trường đã thêm thiết bị ngoài danh mục \"%s\" (mã %s) — %s")
                    .formatted(existing.getName(), existing.getCode(), advice));
        }
    }

    /**
     * So tên theo từ ({@link CatalogNames}) với các thiết bị ĐANG DÙNG mà trường này chọn được: của Sở đúng cấp học
     * của trường (cấp thêm của thiết bị, hoặc không gắn cấp — cùng phạm vi với ô chọn {@link #levelScope()} và
     * {@link #requireLevelFits}), cộng thiết bị ngoài danh mục của chính trường. Trước đây so cả ba cấp — trường Tiểu
     * học thêm "Ampe kế một chiều" (chỉ có ở THCS) bị bảo "chọn thiết bị đó" mà không chọn được — và so cả chuỗi,
     * nên "Al bột" lọt qua "Al (Bột)".
     *
     * <p>CSDL lọc sơ những tên chứa ít nhất một từ của tên mới (bỏ dấu, như ô tìm — {@link ListParams#foldedLike});
     * độ giống tính ở đây. Trùng ở cả Sở lẫn trường thì báo cái của Sở trước.
     */
    private NameMatches nameMatches(String name, School school, Long excludeId) {
        Set<String> words = CatalogNames.words(name);
        if (words.isEmpty() || school == null) {
            return NameMatches.NONE;
        }
        Long level = school.getEducationLevel() == null ? null : school.getEducationLevel().getId();
        List<String> terms = CatalogNames.searchWords(words);
        StringBuilder jpql = new StringBuilder(
                "select c from EquipmentCatalog c left join c.ownerSchool os where c.active = true"
                        + " and (os.id = :school or (os is null");
        if (level != null) {
            jpql.append(" and (c.educationLevel is null or c.educationLevel.id = :level"
                    + " or exists (select 1 from EquipmentCatalog o join o.extraLevels l where o.id = c.id and l.id = :level))");
        }
        jpql.append("))");
        if (excludeId != null) {
            jpql.append(" and c.id <> :exclude");
        }
        jpql.append(" and (");
        for (int i = 0; i < terms.size(); i++) {
            jpql.append(i == 0 ? "" : " or ")
                    .append("cast(function('translate', lower(c.name), :accented, :plain) as String) like :w").append(i);
        }
        jpql.append(") order by c.id");
        var query = entityManager().createQuery(jpql.toString(), EquipmentCatalog.class)
                .setParameter("school", school.getId())
                .setParameter("accented", ListParams.VN_ACCENTED)
                .setParameter("plain", ListParams.VN_PLAIN);
        if (level != null) {
            query.setParameter("level", level);
        }
        if (excludeId != null) {
            query.setParameter("exclude", excludeId);
        }
        for (int i = 0; i < terms.size(); i++) {
            query.setParameter("w" + i, "%" + terms.get(i) + "%");
        }
        List<EquipmentCatalog> candidates = query.setMaxResults(500).getResultList();

        EquipmentCatalog same = candidates.stream()
                .filter(c -> words.equals(CatalogNames.words(c.getName())))
                .min(java.util.Comparator.comparing((EquipmentCatalog c) -> c.getOwnerSchool() != null)
                        .thenComparing(EquipmentCatalog::getId))
                .orElse(null);
        List<EquipmentCatalog> similar = candidates.stream()
                .filter(c -> c != same)
                .map(c -> java.util.Map.entry(c, CatalogNames.similarity(words, CatalogNames.words(c.getName()))))
                .filter(e -> e.getValue() >= CatalogNames.SIMILAR)
                .sorted(java.util.Map.Entry.<EquipmentCatalog, Double>comparingByValue().reversed())
                .limit(3)
                .map(java.util.Map.Entry::getKey)
                .toList();
        return new NameMatches(same, similar);
    }

    /** Các ô của thiết bị ngoài danh mục — chung cho thêm và sửa. */
    private void applySchoolItem(EquipmentCatalog item, SchoolItemRequest request, String name) {
        item.setName(name);
        item.setNote(blankToNull(request.note()));
        item.setModel(blankToNull(request.model()));
        item.setEquipmentType(equipmentTypes.get(request.equipmentType().id()));
        // Nhiều môn: môn đầu là môn chính (cột `subject_id` — mã dạy học, lọc, báo cáo), các môn sau vào
        // bảng nối. Không chọn môn nào thì thiết bị dùng chung.
        List<Long> subjectIds = request.subjects() == null ? List.of()
                : request.subjects().stream().filter(r -> r != null && r.id() != null).map(IdRef::id).distinct().toList();
        if (subjectIds.isEmpty()) {
            item.setSubject(ref(request.subject(), subjects::get));
        } else {
            item.setSubject(subjects.get(subjectIds.get(0)));
            subjectIds.stream().skip(1).forEach(id -> item.getExtraSubjects().add(subjects.get(id)));
        }
        item.setUnit(units.get(request.unit().id()));
        item.setAssetCategory(request.assetCategory());
        if (request.trackingType() != null) {
            item.setTrackingType(request.trackingType());
        }
        item.setPhysicalOrDigital(request.physicalOrDigital() == null
                ? PhysicalDigitalType.PHYSICAL : request.physicalOrDigital());
        item.setOrigin(request.origin());
        item.setSelfMade(request.origin() == CatalogOrigin.SELF_MADE);
        requireTrackingFitsCategory(item);
    }

    /** Số tài sản đang mang thiết bị này. */
    private long assetCount(Long catalogId) {
        return entityManager().createQuery("SELECT count(e) FROM Equipment e WHERE e.catalog.id = :id", Long.class)
                .setParameter("id", catalogId).getSingleResult();
    }

    /**
     * Đọc MỘT thiết bị theo id, cùng phạm vi với danh sách: thiết bị ngoài danh mục của trường chỉ ai thấy trường
     * đó mới đọc được (Sở mọi trường, UBND trường mình quản lý, trường chính nó) — người khác nhận 404 như không
     * có. Danh mục của Sở thì ai có quyền đọc cũng đọc được.
     */
    public EquipmentCatalog getVisible(Long id) {
        EquipmentCatalog item = get(id);
        Set<Long> visible = visibleSchools.current();
        if (item.getOwnerSchool() != null && visible != null && !visible.contains(item.getOwnerSchool().getId())) {
            throw new ResourceNotFoundException("EquipmentCatalog", id);
        }
        return item;
    }

    /** {@code NDM-<mã trường>-001}, số kế tiếp chưa ai dùng — mã duy nhất trên cả bảng. */
    private String nextSchoolCode(School school) {
        String tag = school.getShortCode() == null ? ""
                : school.getShortCode().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        String prefix = "NDM-" + (tag.isEmpty() ? "S" + school.getId() : tag) + "-";
        long n = catalogTree.countByOwnerSchool_Id(school.getId()) + 1;
        while (catalogTree.findByCodeIgnoreCase(prefix + "%03d".formatted(n)).isPresent()) {
            n++;
        }
        return prefix + "%03d".formatted(n);
    }

    @Override
    protected void applyCreate(EquipmentCatalog item, EquipmentCatalogRequest request) {
        item.setTeachingCode(blankToNull(request.teachingCode()));
        item.setParent(ref(request.parent(), this::get));
        item.setEquipmentType(ref(request.equipmentType(), equipmentTypes::get));
        item.setSubject(ref(request.subject(), subjects::get));
        item.setEducationLevel(ref(request.educationLevel(), educationLevels::get));
        item.setGrade(ref(request.grade(), grades::get));
        item.setUnit(ref(request.unit(), units::get));
        item.setModel(blankToNull(request.model()));
        item.setManufacturer(blankToNull(request.manufacturer()));
        item.setTrackingType(request.trackingType());
        item.setAssetCategory(request.assetCategory());
        item.setPhysicalOrDigital(request.physicalOrDigital());
        // Thêm tay vào danh mục luôn là thiết bị NGOÀI thông tư. Cờ "thuộc danh mục tối thiểu" không gõ tay
        // được: nó do việc áp dụng một bộ tiêu chuẩn đặt (`EquipmentStandardService.apply`).
        item.setMinimumRequired(Boolean.FALSE);
        item.setStatisticalCode(blankToNull(request.statisticalCode()));
        item.setLegalBasis(blankToNull(request.legalBasis()));
        item.setDescription(blankToNull(request.description()));
        item.setUsedByTeacher(request.usedByTeacher());
        item.setUsedByStudent(request.usedByStudent());
        item.setSelfMade(request.selfMade());
        applyMany(item, request.educationLevels(), request.subjects(), request.grades());
        requireTrackingFitsCategory(item);
    }

    /**
     * Cấp học, môn học, khối lớp chọn NHIỀU: mục đầu là cái CHÍNH (cột chính — tiền tố mã thiết bị, phần MH
     * của mã tài sản, bộ lọc và báo cáo đọc nó), các mục sau vào bảng nối. Danh sách {@code null} là không
     * đụng tới; danh sách rỗng là bỏ hết.
     */
    private void applyMany(EquipmentCatalog item, List<IdRef> levels, List<IdRef> subjectRefs, List<IdRef> gradeRefs) {
        if (levels != null) {
            List<Long> ids = ids(levels);
            item.setEducationLevel(ids.isEmpty() ? null : educationLevels.get(ids.get(0)));
            item.getExtraLevels().clear();
            ids.stream().skip(1).forEach(id -> item.getExtraLevels().add(educationLevels.get(id)));
        }
        if (subjectRefs != null) {
            List<Long> ids = ids(subjectRefs);
            item.setSubject(ids.isEmpty() ? null : subjects.get(ids.get(0)));
            item.getExtraSubjects().clear();
            ids.stream().skip(1).forEach(id -> item.getExtraSubjects().add(subjects.get(id)));
        }
        if (gradeRefs != null) {
            List<Long> ids = ids(gradeRefs);
            item.setGrade(ids.isEmpty() ? null : grades.get(ids.get(0)));
            item.getExtraGrades().clear();
            ids.stream().skip(1).forEach(id -> item.getExtraGrades().add(grades.get(id)));
        }
    }

    private static List<Long> ids(List<IdRef> refs) {
        return refs.stream().filter(r -> r != null && r.id() != null).map(IdRef::id).distinct().toList();
    }

    /**
     * Thiết bị của danh mục tối thiểu: mọi thứ THÔNG TƯ quy định không sửa tay — mã, tên, cấp học, môn, đơn vị
     * tính, mô tả kỹ thuật, khối lớp, đối tượng dùng (GV / HS), căn cứ, trạng thái (hết hiệu lực khi áp dụng bộ
     * mới không còn nó). Chỉ Bộ đổi được nội dung đó, bằng văn bản mới: lập bản nháp bộ tiêu chuẩn, đọc văn bản,
     * áp dụng. Sửa tay được là THIẾT LẬP QUẢN LÝ thông tư không nói tới: cách quản lý, phân loại kế toán mặc định,
     * số năm sử dụng, dạng thiết bị, loại thiết bị, mã thống kê, nhóm, tự làm.
     *
     * <p>Đơn vị tính và mô tả đang TRỐNG thì được bổ sung (dữ liệu nạp thiếu, không phải đổi thông tư). Gửi lại
     * đúng giá trị đang có thì được — form sửa gửi nguyên bản ghi.
     */
    @Override
    @Transactional
    public EquipmentCatalog update(Long id, EquipmentCatalogPatchRequest request) {
        EquipmentCatalog item = get(id);
        if (Boolean.TRUE.equals(item.getMinimumRequired()) && item.getOwnerSchool() == null) {
            requireUnchanged("name", "Tên", request.name() != null && !request.name().trim().equals(item.getName()));
            requireUnchanged("code", "Mã DM thiết bị", request.code() != null && !request.code().trim().equalsIgnoreCase(item.getCode()));
            requireUnchanged("educationLevel", "Cấp học", request.educationLevel() != null
                    && !Objects.equals(request.educationLevel().id(), idOf(item.getEducationLevel())));
            requireUnchanged("subject", "Môn học", request.subject() != null
                    && !Objects.equals(request.subject().id(), idOf(item.getSubject())));
            requireUnchanged("unit", "Đơn vị tính", item.getUnit() != null && request.unit() != null
                    && !Objects.equals(request.unit().id(), item.getUnit().getId()));
            requireUnchanged("description", "Mô tả kỹ thuật", trimmed(item.getDescription()) != null
                    && request.description() != null
                    && !Objects.equals(trimmed(request.description()), trimmed(item.getDescription())));
            requireUnchanged("legalBasis", "Căn cứ", request.legalBasis() != null
                    && !Objects.equals(trimmed(request.legalBasis()), trimmed(item.getLegalBasis())));
            requireUnchanged("grades", "Khối lớp", gradesChanged(item, request));
            requireUnchanged("usedByTeacher", "Đối tượng sử dụng", request.usedByTeacher() != null
                    && request.usedByTeacher() != Boolean.TRUE.equals(item.getUsedByTeacher()));
            requireUnchanged("usedByStudent", "Đối tượng sử dụng", request.usedByStudent() != null
                    && request.usedByStudent() != Boolean.TRUE.equals(item.getUsedByStudent()));
            requireUnchanged("active", "Trạng thái", request.active() != null
                    && !request.active().equals(Boolean.TRUE.equals(item.getActive())));
        }
        return super.update(id, request);
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Khối lớp gửi lên khác tập đang có (khối chính + khối thêm) — so như tập, không kể thứ tự. */
    private static boolean gradesChanged(EquipmentCatalog item, EquipmentCatalogPatchRequest request) {
        Set<Long> current = new HashSet<>();
        if (item.getGrade() != null) {
            current.add(item.getGrade().getId());
        }
        item.getExtraGrades().forEach(g -> current.add(g.getId()));
        if (request.grades() != null) {
            return !current.equals(new HashSet<>(ids(request.grades())));
        }
        return request.grade() != null && !(request.grade().id() == null ? current.isEmpty()
                : current.size() == 1 && current.contains(request.grade().id()));
    }

    private static Long idOf(BaseEntity entity) {
        return entity == null ? null : entity.getId();
    }

    /** Mã môn trong mã thiết bị: mã dạy học của môn, không có thì mã môn; không gắn môn là {@code 00} (Dùng chung). */
    private static String subjectCode(Subject subject) {
        if (subject == null) {
            return "00";
        }
        String teaching = subject.getTeachingCode();
        return teaching != null && !teaching.isBlank() ? teaching.trim() : subject.getCode();
    }

    private static void requireUnchanged(String field, String label, boolean changed) {
        if (changed) {
            throw new FieldValidationException(field, label + " của thiết bị thuộc danh mục tối thiểu theo thông tư, không sửa "
                    + "tay được. Có văn bản mới thì lập bản nháp bộ tiêu chuẩn, sửa ở đó rồi áp dụng.");
        }
    }

    @Override
    protected String codeTakenMessage(String code) {
        return "Mã DM thiết bị %s đã có".formatted(code);
    }

    /** Thiết bị của danh mục tối thiểu không xoá tay: nó ra khỏi danh mục khi bộ tiêu chuẩn mới không còn nó. */
    /**
     * Một tầng cha và ba tập "thêm" (cấp học, môn, khối lớp) — LAZY trên thực thể, mà phản hồi danh mục
     * đọc. SUBSELECT nên một trang danh sách là ba câu cho cả trang, không phải ba câu mỗi dòng.
     */
    @Override
    protected void loadForResponse(EquipmentCatalog item) {
        Hibernate.initialize(item.getParent());
        Hibernate.initialize(item.getExtraSubjects());
        Hibernate.initialize(item.getExtraLevels());
        Hibernate.initialize(item.getExtraGrades());
    }

    @Override
    protected void beforeDelete(EquipmentCatalog item) {
        if (Boolean.TRUE.equals(item.getMinimumRequired()) && item.getOwnerSchool() == null) {
            throw new FieldValidationException("minimumRequired", "\"%s\" thuộc danh mục thiết bị tối thiểu theo thông tư, không xoá được."
                    .formatted(item.getName()));
        }
    }

    /**
     * Thiết bị CHUẨN cho một dòng của bộ tiêu chuẩn sắp áp dụng: cùng cấp học + môn + tên đã có thì dùng lại,
     * chưa có thì tạo. Đây là lối DUY NHẤT sinh ra thiết bị thuộc danh mục tối thiểu — không có đường thêm
     * tay. Mã là {@code <cấp>-<mã môn>-<số>} — mã môn học, không phải chữ viết tắt: {@code THCS-27-241}
     * nối tiếp {@code THCS-27-240} của Khoa học tự nhiên; không gắn môn thì {@code 00} (Dùng chung). Cùng mã môn
     * với phần MH của mã định danh tài sản.
     */
    @Transactional
    public EquipmentCatalog ensureForStandard(EducationLevel level, Subject subject, String name, EquipmentType type,
            Unit unit, String description, boolean forTeacher, boolean forStudent, String legalBasis) {
        Long subjectId = idOf(subject);
        List<EquipmentCatalog> same = entityManager().createQuery("""
                select c from EquipmentCatalog c
                where c.ownerSchool is null and c.educationLevel = :level and lower(c.name) = lower(:name)
                  and ((:subjectId is null and c.subject is null) or c.subject.id = :subjectId)
                order by c.id""", EquipmentCatalog.class)
                .setParameter("level", level).setParameter("name", name.trim()).setParameter("subjectId", subjectId)
                .setMaxResults(1).getResultList();
        if (!same.isEmpty()) {
            return same.get(0);
        }
        String prefix = level.getCode() + "-" + subjectCode(subject);
        Number max = (Number) entityManager().createNativeQuery("""
                SELECT COALESCE(MAX(CAST(substring(code from '-([0-9]+)$') AS INTEGER)), 0) FROM equipment_catalogs
                WHERE code ~ ('^' || :prefix || '-[0-9]+$')""")
                .setParameter("prefix", prefix).getSingleResult();
        EquipmentCatalog item = new EquipmentCatalog();
        item.setCode(prefix + "-%03d".formatted(max.intValue() + 1));
        item.setName(name.trim());
        item.setActive(true);
        item.setEducationLevel(level);
        item.setSubject(subject);
        item.setEquipmentType(type);
        item.setUnit(unit);
        item.setDescription(blankToNull(description));
        item.setUsedByTeacher(forTeacher);
        item.setUsedByStudent(forStudent);
        item.setPhysicalOrDigital(PhysicalDigitalType.PHYSICAL);
        item.setMinimumRequired(Boolean.TRUE);
        item.setLegalBasis(blankToNull(legalBasis));
        EquipmentCatalog saved = catalogTree.persist(item);
        // Dòng kế tiếp của cùng bộ phải thấy mã vừa cấp khi tính số kế tiếp.
        entityManager().flush();
        return saved;
    }

    /**
     * Danh mục tối thiểu là cấp cao nhất (trưởng nhóm 17/11/2026): sửa một dòng ở đó là sửa luôn thiết bị chuẩn của nó —
     * tên, môn, loại, đơn vị, mô tả, đối tượng sử dụng. Mã giữ nguyên (mã đã in trên tem, dùng trong mã tài sản).
     */
    @Transactional
    public void syncFromStandard(EquipmentCatalog item, String name, Subject subject, EquipmentType type, Unit unit,
            String description, boolean forTeacher, boolean forStudent) {
        if (item == null || item.getOwnerSchool() != null) {
            return;
        }
        item.setName(name.trim());
        item.setSubject(subject);
        if (type != null) {
            item.setEquipmentType(type);
        }
        if (unit != null) {
            item.setUnit(unit);
        }
        item.setDescription(blankToNull(description));
        item.setUsedByTeacher(forTeacher);
        item.setUsedByStudent(forStudent);
        item.setMinimumRequired(Boolean.TRUE);
    }

    /**
     * Dòng cuối cùng của một thiết bị chuẩn vừa bị xoá khỏi danh mục tối thiểu: chưa nơi nào dùng thiết bị (tài sản,
     * phiếu, tồn kho, điều chỉnh chuẩn…) thì xoá luôn thiết bị; đã dùng thì giữ (dữ liệu của trường không vỡ), chỉ bỏ cờ
     * "thuộc danh mục tối thiểu". Bảng tham chiếu đọc từ khoá ngoại của CSDL — thêm bảng mới không phải sửa ở đây.
     */
    @Transactional
    public void releaseFromStandard(Long id) {
        if (id == null) {
            return;
        }
        EquipmentCatalog item = entityManager().find(EquipmentCatalog.class, id);
        if (item == null || item.getOwnerSchool() != null) {
            return;
        }
        entityManager().flush();
        if (referencedOutside(id, Set.of())) {
            item.setMinimumRequired(Boolean.FALSE);
        } else {
            entityManager().remove(item);
        }
    }

    /**
     * Thiết bị {@code id} có bản ghi nào trỏ tới không (tài sản, phiếu, đề xuất, điều chỉnh của trường…) — đọc khoá ngoại
     * tới {@code equipment_catalogs} của CSDL, trừ khoá xoá dây chuyền và các bảng trong {@code ignoredTables}. Thêm
     * bảng mới không phải sửa ở đây.
     */
    @Transactional(readOnly = true)
    public boolean referencedOutside(Long id, Set<String> ignoredTables) {
        if (id == null) {
            return false;
        }
        List<Object[]> refs = entityManager().createNativeQuery("""
                SELECT c.conrelid::regclass::text, a.attname::text
                FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                WHERE c.confrelid = 'equipment_catalogs'::regclass AND c.confdeltype <> 'c'""").getResultList();
        for (Object[] r : refs) {
            String table = (String) r[0];
            String column = (String) r[1];
            if (!table.matches("[a-z_]+") || !column.matches("[a-z_]+") || ignoredTables.contains(table)) {
                continue;
            }
            Object hit = entityManager().createNativeQuery(
                    "SELECT EXISTS (SELECT 1 FROM " + table + " WHERE " + column + " = ?1)")
                    .setParameter(1, id).getSingleResult();
            if (Boolean.TRUE.equals(hit)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void applyUpdate(EquipmentCatalog item, EquipmentCatalogPatchRequest request) {
        if (request.teachingCode() != null) {
            item.setTeachingCode(blankToNull(request.teachingCode()));
        }
        // Ba trạng thái cho tham chiếu: vắng là để nguyên, id null là xoá.
        if (request.parent() != null) {
            EquipmentCatalog parent = ref(request.parent(), this::get);
            requireNoCycle(item, parent);
            item.setParent(parent);
        }
        if (request.equipmentType() != null) {
            item.setEquipmentType(ref(request.equipmentType(), equipmentTypes::get));
        }
        if (request.subject() != null) {
            item.setSubject(ref(request.subject(), subjects::get));
        }
        if (request.educationLevel() != null) {
            item.setEducationLevel(ref(request.educationLevel(), educationLevels::get));
        }
        if (request.grade() != null) {
            item.setGrade(ref(request.grade(), grades::get));
        }
        if (request.unit() != null) {
            item.setUnit(ref(request.unit(), units::get));
        }
        if (request.model() != null) {
            item.setModel(blankToNull(request.model()));
        }
        if (request.manufacturer() != null) {
            item.setManufacturer(blankToNull(request.manufacturer()));
        }
        if (request.trackingType() != null) {
            item.setTrackingType(request.trackingType());
        }
        if (request.assetCategory() != null) {
            item.setAssetCategory(request.assetCategory());
        }
        requireTrackingFitsCategory(item);
        if (request.physicalOrDigital() != null) {
            item.setPhysicalOrDigital(request.physicalOrDigital());
        }
        if (request.statisticalCode() != null) {
            item.setStatisticalCode(blankToNull(request.statisticalCode()));
        }
        if (request.legalBasis() != null) {
            item.setLegalBasis(blankToNull(request.legalBasis()));
        }
        if (request.description() != null) {
            item.setDescription(blankToNull(request.description()));
        }
        if (request.usedByTeacher() != null) {
            item.setUsedByTeacher(request.usedByTeacher());
        }
        if (request.usedByStudent() != null) {
            item.setUsedByStudent(request.usedByStudent());
        }
        if (request.selfMade() != null) {
            item.setSelfMade(request.selfMade());
        }
        // Thiết bị của thông tư giữ cấp học và môn theo thông tư — hai danh sách đó bỏ qua; khối lớp vẫn sửa được.
        boolean byCircular = Boolean.TRUE.equals(item.getMinimumRequired()) && item.getOwnerSchool() == null;
        applyMany(item, byCircular ? null : request.educationLevels(), byCircular ? null : request.subjects(), request.grades());
    }

    /**
     * Lọc: {@code parent.id}, {@code equipmentType.id}, {@code subject.id}, {@code educationLevel.id},
     * {@code ownerSchool.id}, {@code ownership=official|school}.
     *
     * <p>Luôn kèm phạm vi thiết bị ngoài danh mục: danh mục của Sở thì ai cũng thấy, thiết bị riêng
     * của trường thì chỉ những ai thấy trường đó (Sở mọi trường, UBND trường mình quản lý, trường
     * chính nó). Ghép bằng AND như mọi bộ lọc ở đây nên không query string nào nới rộng được.
     */
    @Override
    protected Specification<EquipmentCatalog> extraFilters(ListParams params) {
        return Specification.allOf(List.of(
                ownerScope(),
                levelScope(),
                ownershipFilter(params),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "ownerSchool"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "parent"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "equipmentType"),
                primaryOrExtraFilter(params, "subject", "extraSubjects"),
                primaryOrExtraFilter(params, "educationLevel", "extraLevels"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "unit"),
                trackingFilter(params),
                minimumFilter(params),
                codesFilter(params)));
    }

    /**
     * {@code codes=THCS-27-022,THCS-18-005}: nhiều mã một lần, không phân biệt hoa thường, bỏ khoảng trắng hai đầu —
     * nhập Excel của phiếu ghi tăng khớp cả tệp trong MỘT lần gọi (trước đây mỗi dòng một lần, 200 dòng dính 429).
     */
    private static Specification<EquipmentCatalog> codesFilter(ListParams params) {
        List<Specification<EquipmentCatalog>> specs = params.filters().stream()
                .filter(c -> c.field().equals("codes") && c.value() != null)
                .map(c -> {
                    List<String> codes = java.util.Arrays.stream(c.value().split(","))
                            .map(v -> v.trim().toUpperCase(java.util.Locale.ROOT))
                            .filter(v -> !v.isEmpty())
                            .distinct()
                            .limit(1_000)
                            .toList();
                    return (Specification<EquipmentCatalog>) (root, q, cb) -> codes.isEmpty()
                            ? cb.disjunction()
                            : cb.upper(root.get("code")).in(codes);
                })
                .toList();
        return Specification.allOf(specs);
    }

    /**
     * Tài khoản của MỘT trường chỉ thấy thiết bị danh mục đúng cấp học của trường mình — cộng thiết bị
     * không gắn cấp nào (dùng chung) và đồ ngoài danh mục của chính trường. Danh mục có hơn 1.700 thiết
     * bị của ba cấp; một trường THCS chọn nhầm "THPT-HH-002" là ghi tăng một tài sản không bao giờ khớp
     * định mức của mình. Chặn ở DANH SÁCH (ghép AND, không query string nào nới được), nên mọi ô chọn
     * và màn danh mục phía trường đều theo — không màn nào phải tự nhớ lọc.
     *
     * <p>Không áp cho Sở, quản trị (họ làm việc với nhiều cấp), và không áp cho đọc theo id: tài
     * sản cũ gắn thiết bị cấp khác vẫn mở được hồ sơ của nó.
     */
    private Specification<EquipmentCatalog> levelScope() {
        Long levelId = callerLevel.educationLevelId();
        if (levelId == null) {
            return Specification.unrestricted();
        }
        return (root, q, cb) -> cb.or(
                cb.isNull(root.get("educationLevel")),
                cb.equal(root.get("educationLevel").get("id"), levelId),
                hasExtra(root, q, cb, "extraLevels", levelId),
                cb.isNotNull(root.get("ownerSchool")));
    }

    /** {@code EXISTS}: thiết bị có mục {@code id} trong một bảng nối "thêm" — không join, nên không nhân dòng. */
    private static Predicate hasExtra(Root<EquipmentCatalog> root, CriteriaQuery<?> q, CriteriaBuilder cb, String collection, Long id) {
        Subquery<Long> sub = q.subquery(Long.class);
        Root<EquipmentCatalog> other = sub.from(EquipmentCatalog.class);
        sub.select(other.get("id")).where(cb.equal(other.get("id"), root.get("id")), cb.equal(other.join(collection).get("id"), id));
        return cb.exists(sub);
    }

    /**
     * Lọc {@code <field>.id=<id>}: khớp cái CHÍNH hoặc một cái thêm — thiết bị dùng cho cả Tiểu học lẫn THCS
     * phải hiện khi lọc theo cấp nào trong hai. {@code none} (chưa gắn) và danh sách nhiều id vẫn do bộ lọc
     * tham chiếu chung xử lý.
     */
    private static Specification<EquipmentCatalog> primaryOrExtraFilter(ListParams params, String field, String collection) {
        Specification<EquipmentCatalog> primary = CatalogSpecifications.referenceFilter(params, field);
        Long id = params.filters().stream()
                .filter(c -> c.field().equals(field + ".id") && c.value() != null && c.value().matches("\\d+"))
                .map(c -> Long.valueOf(c.value())).findFirst().orElse(null);
        if (id == null) {
            return primary;
        }
        return primary.or((root, q, cb) -> hasExtra(root, q, cb, collection, id));
    }

    /**
     * Thiết bị danh mục phải cùng cấp học với trường ghi tăng nó. Vế GHI của {@link #levelScope()}: ô
     * chọn đã không mời thiết bị khác cấp, còn đây chặn một payload tự dựng. Thiết bị không gắn cấp và
     * đồ ngoài danh mục của trường thì cấp nào cũng dùng được; trường chưa khai cấp học thì không kiểm.
     */
    public void requireLevelFits(EquipmentCatalog catalog, School school, int lineNo) {
        requireOwnedBy(catalog, school, lineNo);
        if (catalog.getEducationLevel() == null || catalog.getOwnerSchool() != null
                || school == null || school.getEducationLevel() == null) {
            return;
        }
        Long schoolLevel = school.getEducationLevel().getId();
        if (!catalog.getEducationLevel().getId().equals(schoolLevel)
                && catalog.getExtraLevels().stream().noneMatch(l -> l.getId().equals(schoolLevel))) {
            throw new FieldValidationException("lines",
                    "Dòng %d: \"%s\" (%s) thuộc danh mục cấp %s, không dùng cho trường cấp %s"
                            .formatted(lineNo, catalog.getName(), catalog.getCode(),
                                    catalog.getEducationLevel().getName(), school.getEducationLevel().getName()));
        }
    }

    /**
     * Thiết bị ngoài danh mục chỉ TRƯỜNG SỞ HỮU dùng được — trên phiếu ghi tăng, đề xuất mua sắm, tài sản thừa khi
     * kiểm kê, hồ sơ thiết bị. Ô chọn đã không mời đồ của trường khác; đây chặn một payload tự dựng mang id của nó
     * (trước đây trường A ghi tăng được bằng mục NDM của trường B). {@code lineNo} 0 là không thuộc dòng nào.
     */
    public void requireOwnedBy(EquipmentCatalog catalog, School school, int lineNo) {
        if (catalog.getOwnerSchool() == null) {
            return;
        }
        if (school == null || !catalog.getOwnerSchool().getId().equals(school.getId())) {
            String where = lineNo > 0 ? "Dòng %d: ".formatted(lineNo) : "";
            throw new FieldValidationException(lineNo > 0 ? "lines" : "catalog",
                    "%s\"%s\" (%s) là thiết bị ngoài danh mục của trường khác — chọn thiết bị của trường mình"
                            .formatted(where, catalog.getName(), catalog.getCode()));
        }
    }

    /**
     * {@code ids[]=} (ô chọn nạp nhãn theo id) cùng phạm vi với {@link #getVisible}: thiết bị ngoài danh mục của
     * trường khác không trả về — trước đây lặp id là đọc được đồ tự thêm của mọi trường.
     */
    @Override
    public List<EquipmentCatalog> getMany(List<Long> ids) {
        Set<Long> visible = visibleSchools.current();
        return super.getMany(ids).stream()
                .filter(c -> c.getOwnerSchool() == null || visible == null
                        || visible.contains(c.getOwnerSchool().getId()))
                .toList();
    }

    private Specification<EquipmentCatalog> ownerScope() {
        Set<Long> visible = visibleSchools.current();
        if (visible == null) {
            return Specification.unrestricted();
        }
        return (root, q, cb) -> visible.isEmpty()
                ? cb.isNull(root.get("ownerSchool"))
                : cb.or(cb.isNull(root.get("ownerSchool")), root.get("ownerSchool").get("id").in(visible));
    }

    /** {@code ownership=official}: chỉ danh mục của Sở; {@code school}: chỉ thiết bị ngoài danh mục. */
    private static Specification<EquipmentCatalog> ownershipFilter(ListParams params) {
        List<Specification<EquipmentCatalog>> specs = params.filters().stream()
                .filter(c -> c.field().equals("ownership") && c.value() != null)
                .map(c -> (Specification<EquipmentCatalog>) (root, q, cb) -> switch (c.value()) {
                    case "official" -> cb.isNull(root.get("ownerSchool"));
                    case "school" -> cb.isNotNull(root.get("ownerSchool"));
                    default -> cb.conjunction();
                })
                .toList();
        return Specification.allOf(specs);
    }

    /** {@code minimumRequired=true|false}: thiết bị thuộc / không thuộc Danh mục thiết bị dạy học tối thiểu. */
    private static Specification<EquipmentCatalog> minimumFilter(ListParams params) {
        List<Specification<EquipmentCatalog>> specs = params.filters().stream()
                .filter(c -> c.field().equals("minimumRequired") && c.value() != null
                        && (c.value().equals("true") || c.value().equals("false")))
                .map(c -> (Specification<EquipmentCatalog>) (root, q, cb) ->
                        cb.equal(root.get("minimumRequired"), Boolean.valueOf(c.value())))
                .toList();
        return Specification.allOf(specs);
    }

    /** {@code trackingType=bulk}: chỉ lấy nhóm quản lý theo lô (vật tư tiêu hao). */
    private static Specification<EquipmentCatalog> trackingFilter(ListParams params) {
        List<Specification<EquipmentCatalog>> specs = params.filters().stream()
                .filter(c -> c.field().equals("trackingType") && c.value() != null)
                .map(c -> {
                    TrackingType type;
                    try {
                        type = TrackingType.from(c.value());
                    } catch (IllegalArgumentException e) {
                        type = null;
                    }
                    TrackingType wanted = type;
                    return (Specification<EquipmentCatalog>) (root, q, cb) ->
                            wanted == null ? cb.disjunction() : cb.equal(root.get("trackingType"), wanted);
                })
                .toList();
        return Specification.allOf(specs);
    }

    /** Id của nhóm và mọi nhóm con cháu — màn thiết bị lọc theo một nhánh của cây. */
    public List<Long> subtreeIds(Long id) {
        return catalogTree.subtreeIds(id);
    }

    /**
     * Chỉ VẬT TƯ TIÊU HAO (vật tư, hoá chất) được quản lý theo số lượng. Mọi thứ khác — kể cả
     * bàn ghế, bản đồ, tranh không có số serial — là tài sản từng cái, mỗi cái một mã chuẩn và
     * một hồ sơ: 40 cái bàn là 40 mã, không phải một con số trong kho.
     */
    private static void requireTrackingFitsCategory(EquipmentCatalog item) {
        if (item.getTrackingType() == TrackingType.BULK
                && item.getAssetCategory() != AssetCategory.SUPPLY
                && item.getAssetCategory() != AssetCategory.CHEMICAL) {
            throw new FieldValidationException("trackingType",
                    "Chỉ vật tư, hoá chất mới quản lý theo lô; thiết bị khác quản lý từng cái, mỗi cái một mã");
        }
    }

    private static void requireNoCycle(EquipmentCatalog item, EquipmentCatalog parent) {
        EquipmentCatalog node = parent;
        for (int depth = 0; node != null && depth < MAX_DEPTH; depth++) {
            if (node.getId().equals(item.getId())) {
                throw new FieldValidationException(
                        "parent", "Không thể đặt một nhóm vào dưới chính nó hay nhóm con của nó");
            }
            node = node.getParent();
        }
    }

    private static <R> R ref(IdRef ref, Function<Long, R> loader) {
        return ref == null || ref.id() == null ? null : loader.apply(ref.id());
    }
}
