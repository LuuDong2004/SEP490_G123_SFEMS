package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.domain.catalog.subject.Subject;
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
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dòng của Danh mục thiết bị dạy học tối thiểu. Quy tắc riêng:
 * <ul>
 *   <li>văn bản nguồn phải là văn bản CỦA CHÍNH bộ tiêu chuẩn đã chọn — kiểm lại sau mỗi lần đổi
 *       bộ hay đổi văn bản;</li>
 *   <li>chọn thiết bị mà để trống loại / môn / đơn vị thì lấy theo thiết bị;</li>
 *   <li>mã để trống thì cấp {@code DM-<cấp học>-NNNN}.</li>
 * </ul>
 */
@Service
public class EquipmentNormService
        extends CatalogService<EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {

    private static final Pattern NUMBERED = Pattern.compile("^DM-[A-Z]+-(\\d+)$");

    private final EquipmentStandardService standards;
    private final EquipmentCatalogService catalogs;
    private final EquipmentTypeService equipmentTypes;
    private final SubjectService subjects;
    private final GradeService grades;
    private final RoomTypeService roomTypes;
    private final UnitService units;
    private final EquipmentNormRepository normRepository;
    private final CallerSchoolLevel callerLevel;

    public EquipmentNormService(
            EquipmentNormRepository repository,
            RowLevelSecurity rowLevel,
            EquipmentStandardService standards,
            EquipmentCatalogService catalogs,
            EquipmentTypeService equipmentTypes,
            SubjectService subjects,
            GradeService grades,
            RoomTypeService roomTypes,
            UnitService units,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, EquipmentNorm.class, EquipmentNorm::new, "Định mức");
        this.standards = standards;
        this.catalogs = catalogs;
        this.equipmentTypes = equipmentTypes;
        this.subjects = subjects;
        this.grades = grades;
        this.roomTypes = roomTypes;
        this.units = units;
        this.normRepository = repository;
        this.callerLevel = callerLevel;
    }

    /** Số dòng của mỗi môn, theo đúng bộ lọc của danh sách — đầu nhóm của màn danh mục tối thiểu. */
    public record SubjectGroup(Long subjectId, String subjectCode, String subjectName, long count, long catalogs) {
    }

    /**
     * Một lựa chọn của ô lọc "Chủ đề": chủ đề dạy học ({@code kind = topic}) hoặc nhóm của phụ lục
     * ({@code kind = section} — với môn ghi chủ đề ở tiêu đề nhóm, như Tiếng Việt "Chủ đề 1: Tập viết").
     */
    public record TopicOption(Long subjectId, String subjectName, String kind, String value, long count) {
    }

    @Override
    @Transactional
    public EquipmentNorm create(EquipmentNormRequest request) {
        if (request.code() == null || request.code().isBlank()) {
            request = request.withCode(nextCode(standards.get(request.standard().id())));
        }
        return super.create(request);
    }

    /**
     * Sửa nhiều dòng trong MỘT giao dịch — tất cả hoặc không gì. Mỗi dòng đi qua {@link #update}, nên
     * luật "chỉ bộ nháp", phạm vi dòng và kiểm hợp lệ vẫn áp dụng y như sửa từng dòng.
     */
    @Transactional
    public int updateAll(List<EquipmentNormBatchRequest.Item> items) {
        for (EquipmentNormBatchRequest.Item item : items) {
            update(item.id(), item.changes());
        }
        return items.size();
    }

    /**
     * THAY các dòng của những môn có trong văn bản vừa đọc ({@code subjectIds}) bằng {@code rows} — một giao dịch,
     * tất cả hoặc không gì; chỉ bộ NHÁP. Môn không có trong văn bản giữ nguyên. Xoá đi qua {@link #delete} (phạm vi
     * dòng, luật nháp), thêm đi qua {@link #create} (kiểm trùng mã, kế thừa từ thiết bị). Trả số dòng đã xoá.
     */
    @Transactional
    public int replaceSubjects(Long standardId, java.util.Collection<Long> subjectIds, List<EquipmentNormRequest> rows) {
        EquipmentStandard standard = standards.get(standardId);
        requireDraft(standard);
        List<Long> old = subjectIds.isEmpty() ? List.of() : entityManager().createQuery("""
                SELECT n.id FROM EquipmentNorm n WHERE n.standard = :s AND n.subject.id IN :subjects""", Long.class)
                .setParameter("s", standard).setParameter("subjects", subjectIds).getResultList();
        for (Long id : old) {
            delete(id);
        }
        // Mã mới trùng mã của dòng vừa xoá (cùng môn, cùng số thứ tự): đẩy lệnh xoá xuống trước khi kiểm trùng.
        entityManager().flush();
        for (EquipmentNormRequest row : rows) {
            create(row);
        }
        return old.size();
    }

    /** Mọi dòng khớp bộ lọc của danh sách, KHÔNG phân trang, theo thứ tự phụ lục — cho xuất Excel. */
    @Transactional(readOnly = true)
    public List<EquipmentNorm> listAll(ListParams params) {
        return normRepository.findAll(listSpecification(params), Sort.by("sortOrder", "id"));
    }

    /**
     * Nhập nhiều dòng vào một bộ NHÁP — tất cả hoặc không gì (một giao dịch). Mỗi dòng đi qua
     * {@link #create}, nên luật "chỉ bộ nháp" và cấp mã / kiểm trùng mã vẫn áp dụng; thứ tự nối tiếp
     * dòng cuối của bộ.
     */
    @Transactional
    public int importRows(Long standardId, List<EquipmentNormRequest> rows) {
        EquipmentStandard standard = standards.get(standardId);
        requireDraft(standard);
        Integer max = entityManager()
                .createQuery("SELECT max(n.sortOrder) FROM EquipmentNorm n WHERE n.standard = :s", Integer.class)
                .setParameter("s", standard)
                .getSingleResult();
        int order = max == null ? 0 : max;
        for (EquipmentNormRequest row : rows) {
            create(row.withSortOrder(++order));
        }
        return rows.size();
    }

    @Transactional(readOnly = true)
    public List<SubjectGroup> groups(ListParams params) {
        CriteriaBuilder cb = entityManager().getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<EquipmentNorm> root = query.from(EquipmentNorm.class);
        Join<EquipmentNorm, Subject> subject = root.join("subject", JoinType.LEFT);
        var predicate = listSpecification(params).toPredicate(root, query, cb);
        // count = số DÒNG phụ lục; catalogs = số THIẾT BỊ khác nhau (một thiết bị có thể ghi ở nhiều chủ đề / lớp).
        query.select(cb.tuple(subject.get("id"), subject.get("code"), subject.get("name"), cb.count(root),
                        cb.countDistinct(root.get("catalog"))))
                .groupBy(subject.get("id"), subject.get("code"), subject.get("name"))
                // Thứ tự môn như trong phụ lục: theo dòng đầu tiên của môn.
                .orderBy(cb.asc(cb.min(root.get("sortOrder"))));
        if (predicate != null) {
            query.where(predicate);
        }
        List<SubjectGroup> result = new ArrayList<>();
        for (Tuple t : entityManager().createQuery(query).getResultList()) {
            result.add(new SubjectGroup(t.get(0, Long.class), t.get(1, String.class), t.get(2, String.class),
                    t.get(3, Long.class), t.get(4, Long.class)));
        }
        return result;
    }

    /** Chủ đề và nhóm của một bộ tiêu chuẩn, theo thứ tự phụ lục — các lựa chọn của ô lọc Chủ đề. */
    @Transactional(readOnly = true)
    public List<TopicOption> topics(Long standardId) {
        List<TopicOption> result = new ArrayList<>();
        for (String[] kind : new String[][] {{"topic", "topic"}, {"section", "sectionName"}}) {
            List<Object[]> rows = entityManager().createQuery("""
                    SELECT s.id, s.name, n.%1$s, count(n), min(n.sortOrder)
                    FROM EquipmentNorm n LEFT JOIN n.subject s
                    WHERE n.standard.id = :standard AND n.%1$s IS NOT NULL AND n.active = true
                    GROUP BY s.id, s.name, n.%1$s""".formatted(kind[1]), Object[].class)
                    .setParameter("standard", standardId)
                    .getResultList();
            rows.sort((a, b) -> Integer.compare(a[4] == null ? 0 : (Integer) a[4], b[4] == null ? 0 : (Integer) b[4]));
            for (Object[] r : rows) {
                result.add(new TopicOption((Long) r[0], (String) r[1], kind[0], (String) r[2], (Long) r[3]));
            }
        }
        return result;
    }

    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "topic", "sectionName");
    }

    @Override
    protected void applyCreate(EquipmentNorm item, EquipmentNormRequest request) {
        item.setStandard(standards.get(request.standard().id()));
        requireDraft(item.getStandard());
        item.setCatalog(ref(request.catalog(), catalogs::get));
        item.setEquipmentType(ref(request.equipmentType(), equipmentTypes::get));
        item.setSubject(ref(request.subject(), subjects::get));
        item.setGrade(ref(request.grade(), grades::get));
        item.setRoomType(ref(request.roomType(), roomTypes::get));
        item.setMinQuantity(request.minQuantity());
        item.setUnit(ref(request.unit(), units::get));
        item.setNormBasis(request.normBasis());
        item.setBasisSize(request.basisSize());
        item.setQuantityText(blankToNull(request.quantityText()));
        item.setUnitText(blankToNull(request.unitText()));
        item.setGradeLevels(blankToNull(request.gradeLevels()));
        item.setItemNo(blankToNull(request.itemNo()));
        item.setSectionName(blankToNull(request.sectionName()));
        item.setTopic(blankToNull(request.topic()));
        item.setPurpose(blankToNull(request.purpose()));
        item.setDescription(blankToNull(request.description()));
        item.setForTeacher(Boolean.TRUE.equals(request.forTeacher()));
        item.setForStudent(Boolean.TRUE.equals(request.forStudent()));
        item.setOptional(Boolean.TRUE.equals(request.optional()));
        item.setSourceDocument(documentOf(item.getStandard(), request.sourceDocument()));
        inheritFromCatalog(item);
    }

    @Override
    protected void applyUpdate(EquipmentNorm item, EquipmentNormPatchRequest request) {
        requireDraft(item.getStandard());
        if (request.standard() != null && request.standard().id() != null) {
            item.setStandard(standards.get(request.standard().id()));
            requireDraft(item.getStandard());
        }
        // Ba trạng thái cho tham chiếu tuỳ chọn: vắng là để nguyên, id null là xoá.
        if (request.catalog() != null) {
            item.setCatalog(ref(request.catalog(), catalogs::get));
        }
        if (request.equipmentType() != null) {
            item.setEquipmentType(ref(request.equipmentType(), equipmentTypes::get));
        }
        if (request.subject() != null) {
            item.setSubject(ref(request.subject(), subjects::get));
        }
        if (request.grade() != null) {
            item.setGrade(ref(request.grade(), grades::get));
        }
        if (request.roomType() != null) {
            item.setRoomType(ref(request.roomType(), roomTypes::get));
        }
        if (request.minQuantity() != null) {
            item.setMinQuantity(request.minQuantity());
        }
        if (request.unit() != null) {
            item.setUnit(ref(request.unit(), units::get));
        }
        if (request.normBasis() != null) {
            item.setNormBasis(request.normBasis());
        }
        if (request.basisSize() != null) {
            item.setBasisSize(request.basisSize() <= 1 ? null : request.basisSize());
        }
        if (request.quantityText() != null) {
            item.setQuantityText(blankToNull(request.quantityText()));
        }
        if (request.unitText() != null) {
            item.setUnitText(blankToNull(request.unitText()));
        }
        if (request.gradeLevels() != null) {
            item.setGradeLevels(blankToNull(request.gradeLevels()));
        }
        if (request.itemNo() != null) {
            item.setItemNo(blankToNull(request.itemNo()));
        }
        if (request.sectionName() != null) {
            item.setSectionName(blankToNull(request.sectionName()));
        }
        if (request.topic() != null) {
            item.setTopic(blankToNull(request.topic()));
        }
        if (request.purpose() != null) {
            item.setPurpose(blankToNull(request.purpose()));
        }
        if (request.description() != null) {
            item.setDescription(blankToNull(request.description()));
        }
        if (request.forTeacher() != null) {
            item.setForTeacher(request.forTeacher());
        }
        if (request.forStudent() != null) {
            item.setForStudent(request.forStudent());
        }
        if (request.optional() != null) {
            item.setOptional(request.optional());
        }
        if (request.sourceDocument() != null) {
            item.setSourceDocument(documentOf(item.getStandard(), request.sourceDocument()));
        } else if (item.getSourceDocument() != null
                && !item.getSourceDocument().getStandard().getId().equals(item.getStandard().getId())) {
            // Đổi bộ mà không chọn lại văn bản: văn bản cũ thuộc bộ khác, bỏ đi.
            item.setSourceDocument(null);
        }
        inheritFromCatalog(item);
    }

    /** Tài khoản của một trường chỉ thấy dòng định mức thuộc bộ tiêu chuẩn của CẤP HỌC trường mình. */
    private Specification<EquipmentNorm> levelScope() {
        Long levelId = callerLevel.educationLevelId();
        return levelId == null ? Specification.unrestricted()
                : (root, q, cb) -> cb.equal(root.get("standard").get("educationLevel").get("id"), levelId);
    }

    /**
     * Lọc: {@code standard.id}, {@code catalog.id}, {@code equipmentType.id}, {@code subject.id};
     * {@code gradeLevel=7} — dòng dùng cho lớp 7 (kể cả dòng không ghi lớp, tức mọi lớp);
     * {@code target=teacher|student} — đối tượng sử dụng; {@code normBasis=PER_CLASS}…
     */
    @Override
    protected Specification<EquipmentNorm> extraFilters(ListParams params) {
        List<Specification<EquipmentNorm>> specs = new ArrayList<>(List.of(
                levelScope(),
                CatalogSpecifications.referenceFilter(params, "standard"),
                CatalogSpecifications.referenceFilter(params, "catalog"),
                CatalogSpecifications.referenceFilter(params, "equipmentType"),
                CatalogSpecifications.referenceFilter(params, "subject")));
        for (ListParams.Criterion c : params.filters()) {
            if (c.value() == null || c.value().isBlank()) {
                continue;
            }
            switch (c.field()) {
                case "gradeLevel" -> {
                    String grade = c.value().replaceAll("\\D", "");
                    if (!grade.isEmpty()) {
                        specs.add((root, q, cb) -> cb.or(cb.isNull(root.get("gradeLevels")),
                                cb.like(cb.concat(cb.concat(",", root.get("gradeLevels")), ","),
                                        "%," + grade + ",%")));
                    }
                }
                case "target" -> {
                    String field = switch (c.value()) {
                        case "teacher" -> "forTeacher";
                        case "student" -> "forStudent";
                        default -> null;
                    };
                    if (field != null) {
                        specs.add((root, q, cb) -> cb.isTrue(root.get(field)));
                    }
                }
                // Ô lọc Chủ đề: đúng chủ đề / đúng nhóm của phụ lục (giá trị lấy từ /topics).
                case "topic", "sectionName" -> specs.add((root, q, cb) -> cb.equal(root.get(c.field()), c.value()));
                // standardStatus=ACTIVE: chỉ dòng của bộ đang áp dụng (hồ sơ thiết bị — không lặp theo các phiên bản).
                case "standardStatus" -> specs.add((root, q, cb) -> cb.equal(
                        root.get("standard").get("status").as(String.class), c.value().toUpperCase()));
                case "normBasis" -> specs.add((root, q, cb) -> cb.equal(root.get("normBasis").as(String.class),
                        c.value().toUpperCase()));
                default -> {
                }
            }
        }
        return Specification.allOf(specs);
    }

    /** Loại, môn, đơn vị để trống thì theo thiết bị đã chọn — một thiết bị chỉ khai một lần. */
    private static void inheritFromCatalog(EquipmentNorm item) {
        EquipmentCatalog catalog = item.getCatalog();
        if (catalog == null) {
            return;
        }
        if (item.getEquipmentType() == null) {
            item.setEquipmentType(catalog.getEquipmentType());
        }
        if (item.getSubject() == null) {
            item.setSubject(catalog.getSubject());
        }
        if (item.getUnit() == null) {
            item.setUnit(catalog.getUnit());
        }
    }

    @Override
    protected void beforeDelete(EquipmentNorm item) {
        requireDraft(item.getStandard());
    }

    /** Mã dòng chỉ cần duy nhất TRONG một bộ: bộ mới chép nguyên mã của bộ cũ. */
    @Override
    protected Optional<EquipmentNorm> findSameCode(EquipmentNorm item, String code) {
        if (item == null || item.getStandard() == null) {
            return super.findSameCode(item, code);
        }
        return entityManager().createQuery(
                "SELECT n FROM EquipmentNorm n WHERE n.standard = :s AND lower(n.code) = lower(:c)", EquipmentNorm.class)
                .setParameter("s", item.getStandard()).setParameter("c", code)
                .getResultList().stream().findFirst();
    }

    /**
     * Thiết bị đi theo BỘ, bộ đi theo văn bản: chỉ bộ NHÁP mới thêm / sửa / xoá thiết bị được. Bộ đang
     * áp dụng (hay đã hết hiệu lực) là căn cứ của dữ liệu đã có — đổi thiết bị là lập bộ mới theo văn
     * bản mới (`POST /equipment_standards/{id}/revise`), sửa trong bản nháp rồi áp dụng.
     */
    private static void requireDraft(EquipmentStandard standard) {
        if (standard != null && standard.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("standard", standard.getStatus() == StandardStatus.ACTIVE
                    ? "Bộ đang áp dụng theo văn bản căn cứ — muốn thay đổi thiết bị, lập bộ mới theo văn bản mới."
                    : "Bộ đã hết hiệu lực — chỉ xem, không sửa.");
        }
    }

    /** {@code DM-THCS-0712}: số lớn nhất đang có của cấp + 1. */
    private String nextCode(EquipmentStandard standard) {
        String level = standard.getEducationLevel() == null ? "KHAC" : standard.getEducationLevel().getCode();
        String prefix = "DM-" + level + "-";
        int max = 0;
        for (String code : entityManager()
                .createQuery("SELECT n.code FROM EquipmentNorm n WHERE n.code LIKE :p", String.class)
                .setParameter("p", prefix + "%")
                .getResultList()) {
            Matcher m = NUMBERED.matcher(code);
            if (m.matches()) {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            }
        }
        return prefix + String.format("%04d", max + 1);
    }

    private static <R> R ref(IdRef ref, Function<Long, R> loader) {
        return ref == null || ref.id() == null ? null : loader.apply(ref.id());
    }

    private static EquipmentStandardDocument documentOf(EquipmentStandard standard, IdRef ref) {
        if (ref == null || ref.id() == null) {
            return null;
        }
        return standard.getDocuments().stream()
                .filter(d -> ref.id().equals(d.getId()))
                .findFirst()
                .orElseThrow(() -> new FieldValidationException(
                        "sourceDocument", "Văn bản này không thuộc bộ tiêu chuẩn đã chọn"));
    }
}
