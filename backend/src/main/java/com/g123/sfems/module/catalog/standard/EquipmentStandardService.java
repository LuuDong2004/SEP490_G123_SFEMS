package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.DocumentRole;
import com.g123.sfems.domain.catalog.standard.RevisionKind;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bộ tiêu chuẩn thiết bị. Phần chung ở {@link CatalogService}; lớp này giữ:
 *
 * <ul>
 *   <li>năm học kết thúc không được trước năm học bắt đầu</li>
 *   <li>bộ không thay thế chính nó</li>
 *   <li>đồng bộ danh sách văn bản căn cứ theo id — sửa văn bản cũ tại chỗ để
 *       các dòng định mức trỏ vào nó không mất liên kết</li>
 * </ul>
 */
@Service
public class EquipmentStandardService extends CatalogService<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    private final EducationLevelService educationLevels;
    private final SchoolYearService schoolYears;
    private final CallerSchoolLevel callerLevel;
    private final EquipmentCatalogService catalogs;
    private final StandardChanges changes;

    public EquipmentStandardService(
            EquipmentStandardRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            SchoolYearService schoolYears,
            CallerSchoolLevel callerLevel,
            EquipmentCatalogService catalogs,
            StandardChanges changes) {
        super(repository, rowLevel, EquipmentStandard.class, EquipmentStandard::new,
                "Bộ tiêu chuẩn");
        this.catalogs = catalogs;
        this.changes = changes;
        this.educationLevels = educationLevels;
        this.schoolYears = schoolYears;
        this.callerLevel = callerLevel;
    }

    /**
     * Sửa bộ. Bộ ĐANG ÁP DỤNG là căn cứ các trường đang tính đủ / thiếu, và nội dung của nó lấy từ văn bản của
     * Bộ: chỉ còn sửa được thứ SỞ quyết — năm học áp dụng và ghi chú (tệp văn bản đính kèm đi lối riêng). Mã,
     * tên, phiên bản, cấp học, bộ được thay, danh sách văn bản và mọi ô của từng văn bản khoá — nhập sai thì Lập
     * bộ mới. Bộ HẾT HIỆU LỰC chỉ để xem lại. Kiểm TRƯỚC khi lớp cha gán mã.
     */
    @Override
    @Transactional
    public EquipmentStandard update(Long id, EquipmentStandardPatchRequest request) {
        EquipmentStandard current = get(id);
        if (current.getStatus() == StandardStatus.RETIRED) {
            throw new FieldValidationException("status", "Bộ đã hết hiệu lực — chỉ còn để xem lại, không sửa được.");
        }
        if (current.getStatus() == StandardStatus.ACTIVE) {
            requireUnchangedRoot(current, request);
        } else if (current.getPreviousStandard() != null) {
            requireRevisionDraftLocks(current, request);
        }
        // Văn bản của lần sửa là căn cứ của cả bản nháp — không xoá được; lập nhầm thì xoá bản nháp.
        Long revision = current.getRevisionDocumentId();
        if (revision != null && request.documents() != null
                && request.documents().stream().noneMatch(d -> revision.equals(d.id()))) {
            throw new FieldValidationException("documents",
                    "Văn bản của lần sửa này không xoá được — lập nhầm thì xoá bản nháp và lập lại.");
        }
        return super.update(id, request);
    }

    private static void requireUnchangedRoot(EquipmentStandard current, EquipmentStandardPatchRequest request) {
        String locked = " của bộ đang áp dụng không đổi được — cần đổi thì Lập bộ mới.";
        if (request.code() != null && !request.code().trim().equals(current.getCode())) {
            throw new FieldValidationException("code", "Mã" + locked);
        }
        if (request.name() != null && !sameText(request.name(), current.getName())) {
            throw new FieldValidationException("name", "Tên bộ" + locked);
        }
        if (request.standardVersion() != null && !sameText(request.standardVersion(), current.getStandardVersion())) {
            throw new FieldValidationException("standardVersion", "Phiên bản" + locked);
        }
        if (request.endSchoolYear() != null && !sameId(request.endSchoolYear(), current.getEndSchoolYear() == null
                ? null : current.getEndSchoolYear().getId())) {
            throw new FieldValidationException("endSchoolYear",
                    "Năm học kết thúc của bộ đang áp dụng tự đặt khi áp dụng bộ mới thay nó.");
        }
        if (request.educationLevel() != null && !sameId(request.educationLevel(), current.getEducationLevel() == null
                ? null : current.getEducationLevel().getId())) {
            throw new FieldValidationException("educationLevel", "Cấp học" + locked);
        }
        if (request.previousStandard() != null && !sameId(request.previousStandard(), current.getPreviousStandard() == null
                ? null : current.getPreviousStandard().getId())) {
            throw new FieldValidationException("previousStandard", "Bộ được thay thế" + locked);
        }
        if (request.documents() == null) {
            return;
        }
        Map<Long, EquipmentStandardDocument> existing = new HashMap<>();
        for (EquipmentStandardDocument doc : current.getDocuments()) {
            existing.put(doc.getId(), doc);
        }
        java.util.Set<Long> seen = new java.util.HashSet<>();
        for (int i = 0; i < request.documents().size(); i++) {
            StandardDocumentInput input = request.documents().get(i);
            EquipmentStandardDocument doc = input.id() == null ? null : existing.get(input.id());
            if (doc == null) {
                throw new FieldValidationException("documents", "Không thêm văn bản vào bộ đang áp dụng — Lập bộ mới theo văn bản mới.");
            }
            seen.add(doc.getId());
            if (input.documentNo() == null || !input.documentNo().trim().equals(doc.getDocumentNo())) {
                throw new FieldValidationException("documents." + i + ".documentNo", "Số hiệu" + locked);
            }
            if (input.documentRole() != doc.getDocumentRole()) {
                throw new FieldValidationException("documents." + i + ".documentRole", "Vai trò" + locked);
            }
            String at = "documents." + i + ".";
            if (!sameText(input.documentName(), doc.getDocumentName())) {
                throw new FieldValidationException(at + "documentName", "Trích yếu" + locked);
            }
            if (!sameText(input.issuingAuthority(), doc.getIssuingAuthority())) {
                throw new FieldValidationException(at + "issuingAuthority", "Cơ quan ban hành" + locked);
            }
            if (!java.util.Objects.equals(input.issueDate(), doc.getIssueDate())) {
                throw new FieldValidationException(at + "issueDate", "Ngày ban hành" + locked);
            }
            if (!java.util.Objects.equals(input.effectiveDate(), doc.getEffectiveDate())) {
                throw new FieldValidationException(at + "effectiveDate", "Ngày hiệu lực" + locked);
            }
            if (!sameText(input.url(), doc.getUrl())) {
                throw new FieldValidationException(at + "url", "Đường dẫn" + locked);
            }
        }
        if (seen.size() != existing.size()) {
            throw new FieldValidationException("documents", "Không xoá văn bản của bộ đang áp dụng — Lập bộ mới theo văn bản mới.");
        }
    }

    /**
     * Bộ NHÁP lập từ "Lập bộ mới" (có bộ được thay): những gì hệ thống đã đặt lúc lập thì khoá — mã, cấp học, phiên
     * bản, bộ được thay, năm học kết thúc (tự đặt khi bộ sau thay bộ này) — và các văn bản căn cứ chép từ bộ cũ
     * (không sửa, không xoá). Sửa được: tên bộ, năm học bắt đầu, ghi chú, văn bản của lần sửa (giữ vai trò) và văn
     * bản hướng dẫn / tham khảo thêm vào (không thêm văn bản căn cứ chính).
     */
    private static void requireRevisionDraftLocks(EquipmentStandard current, EquipmentStandardPatchRequest request) {
        String locked = " do hệ thống đặt khi lập bộ — không sửa.";
        if (request.code() != null && !request.code().trim().equals(current.getCode())) {
            throw new FieldValidationException("code", "Mã bộ" + locked);
        }
        if (request.standardVersion() != null && !sameText(request.standardVersion(), current.getStandardVersion())) {
            throw new FieldValidationException("standardVersion", "Phiên bản" + locked);
        }
        if (request.educationLevel() != null && !sameId(request.educationLevel(), current.getEducationLevel() == null
                ? null : current.getEducationLevel().getId())) {
            throw new FieldValidationException("educationLevel", "Cấp học" + locked);
        }
        if (request.previousStandard() != null && !sameId(request.previousStandard(), current.getPreviousStandard().getId())) {
            throw new FieldValidationException("previousStandard", "Bộ được thay thế" + locked);
        }
        if (request.endSchoolYear() != null && request.endSchoolYear().id() != null) {
            throw new FieldValidationException("endSchoolYear", "Năm học kết thúc tự đặt khi có bộ mới thay bộ này.");
        }
        if (request.startSchoolYear() != null && !sameId(request.startSchoolYear(), current.getStartSchoolYear() == null
                ? null : current.getStartSchoolYear().getId())) {
            throw new FieldValidationException("startSchoolYear", "Năm học áp dụng tự ghi lúc bấm Áp dụng.");
        }
        if (request.name() != null && !sameText(request.name(), current.getName())) {
            throw new FieldValidationException("name", "Tên bộ" + locked);
        }
        if (request.documents() == null) {
            return;
        }
        // Văn bản chép từ bộ cũ: văn bản của bản nháp có số hiệu trùng một văn bản của bộ được thay (so trên bản nháp
        // hiện tại, để bản nháp cũ đã lỡ xoá một văn bản vẫn lưu được).
        java.util.Set<String> previousNos = new java.util.HashSet<>();
        for (EquipmentStandardDocument d : current.getPreviousStandard().getDocuments()) {
            previousNos.add(d.getDocumentNo().trim().toLowerCase(java.util.Locale.ROOT));
        }
        Map<String, EquipmentStandardDocument> inherited = new HashMap<>();
        for (EquipmentStandardDocument d : current.getDocuments()) {
            String no = d.getDocumentNo().trim().toLowerCase(java.util.Locale.ROOT);
            if (previousNos.contains(no) && !d.getId().equals(current.getRevisionDocumentId())) {
                inherited.put(no, d);
            }
        }
        Long revision = current.getRevisionDocumentId();
        DocumentRole revisionRole = current.getDocuments().stream().filter(d -> d.getId().equals(revision))
                .map(EquipmentStandardDocument::getDocumentRole).findFirst().orElse(null);
        java.util.Set<String> kept = new java.util.HashSet<>();
        for (int i = 0; i < request.documents().size(); i++) {
            StandardDocumentInput input = request.documents().get(i);
            String at = "documents." + i + ".";
            String key = input.documentNo() == null ? "" : input.documentNo().trim().toLowerCase(java.util.Locale.ROOT);
            EquipmentStandardDocument old = inherited.get(key);
            if (old != null && (revision == null || !revision.equals(input.id()))) {
                kept.add(key);
                String fixed = " của văn bản chép từ bộ cũ không sửa được.";
                if (input.documentRole() != old.getDocumentRole()) {
                    throw new FieldValidationException(at + "documentRole", "Vai trò" + fixed);
                }
                if (!sameText(input.documentName(), old.getDocumentName())) {
                    throw new FieldValidationException(at + "documentName", "Trích yếu" + fixed);
                }
                if (!sameText(input.issuingAuthority(), old.getIssuingAuthority())) {
                    throw new FieldValidationException(at + "issuingAuthority", "Cơ quan ban hành" + fixed);
                }
                if (!java.util.Objects.equals(input.issueDate(), old.getIssueDate())
                        || !java.util.Objects.equals(input.effectiveDate(), old.getEffectiveDate())) {
                    throw new FieldValidationException(at + "issueDate", "Ngày" + fixed);
                }
                if (!sameText(input.url(), old.getUrl())) {
                    throw new FieldValidationException(at + "url", "Đường dẫn" + fixed);
                }
                continue;
            }
            if (revision != null && revision.equals(input.id())) {
                if (revisionRole != null && input.documentRole() != revisionRole) {
                    throw new FieldValidationException(at + "documentRole", "Vai trò của văn bản lần sửa không đổi được.");
                }
                continue;
            }
            if (input.documentRole() == DocumentRole.MAIN) {
                throw new FieldValidationException(at + "documentRole",
                        "Bộ chỉ có MỘT văn bản căn cứ chính — văn bản thêm vào chỉ là hướng dẫn hoặc tham khảo.");
            }
        }
        if (kept.size() != inherited.size()) {
            throw new FieldValidationException("documents", "Không xoá văn bản chép từ bộ cũ.");
        }
    }

    /** Hai chuỗi như nhau sau khi bỏ khoảng trắng hai đầu; trống và {@code null} là một. */
    private static boolean sameText(String a, String b) {
        String x = a == null || a.isBlank() ? null : a.trim();
        String y = b == null || b.isBlank() ? null : b.trim();
        return java.util.Objects.equals(x, y);
    }

    private static boolean sameId(IdRef ref, Long id) {
        return java.util.Objects.equals(ref.id(), id);
    }

    /**
     * Luật của bộ và văn bản căn cứ, kiểm cả lúc thêm lẫn sửa: cấp học và phiên bản bắt buộc; đúng MỘT văn bản
     * căn cứ chính; mỗi văn bản có vai trò, trích yếu, ngày ban hành (không sau hôm nay), ngày hiệu lực (không
     * trước ngày ban hành — văn bản hợp nhất / tham khảo không có ngày hiệu lực riêng nên được trống); số hiệu
     * không trùng trong bộ.
     */
    private static void requireComplete(EquipmentStandard item, List<StandardDocumentInput> documents) {
        if (item.getEducationLevel() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học");
        }
        if (item.getStandardVersion() == null || item.getStandardVersion().isBlank()) {
            throw new FieldValidationException("standardVersion", "Nhập phiên bản");
        }
        if (documents == null) {
            return;
        }
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        java.util.Set<String> numbers = new java.util.HashSet<>();
        int main = 0;
        for (int i = 0; i < documents.size(); i++) {
            StandardDocumentInput d = documents.get(i);
            String at = "documents." + i + ".";
            if (d.documentRole() == null) {
                throw new FieldValidationException(at + "documentRole", "Chọn vai trò");
            }
            if (d.documentRole() == DocumentRole.MAIN) {
                main++;
            }
            if (!numbers.add(d.documentNo().trim().toLowerCase(java.util.Locale.ROOT))) {
                throw new FieldValidationException(at + "documentNo", "Số hiệu trùng với văn bản khác trong bộ");
            }
            if (d.documentName() == null || d.documentName().isBlank()) {
                throw new FieldValidationException(at + "documentName", "Nhập trích yếu");
            }
            if (d.issueDate() == null) {
                throw new FieldValidationException(at + "issueDate", "Nhập ngày ban hành");
            }
            if (d.issueDate().isAfter(today)) {
                throw new FieldValidationException(at + "issueDate", "Ngày ban hành không được sau hôm nay");
            }
            if (d.effectiveDate() == null && d.documentRole() != DocumentRole.REFERENCE) {
                throw new FieldValidationException(at + "effectiveDate", "Nhập ngày hiệu lực");
            }
            if (d.effectiveDate() != null && d.effectiveDate().isBefore(d.issueDate())) {
                throw new FieldValidationException(at + "effectiveDate", "Ngày hiệu lực không được trước ngày ban hành");
            }
        }
        if (main != 1) {
            throw new FieldValidationException("documents",
                    main == 0 ? "Bộ phải có một văn bản căn cứ chính" : "Bộ chỉ có MỘT văn bản căn cứ chính");
        }
    }

    /** Bộ mới tạo tay luôn là NHÁP: áp dụng là một hành động riêng ({@link #apply}). */
    @Override
    protected void applyCreate(EquipmentStandard item, EquipmentStandardRequest request) {
        item.setStatus(StandardStatus.DRAFT);
        item.setStandardVersion(blankToNull(request.standardVersion()));
        if (present(request.educationLevel())) {
            item.setEducationLevel(educationLevels.get(request.educationLevel().id()));
        }
        if (present(request.startSchoolYear())) {
            item.setStartSchoolYear(schoolYears.get(request.startSchoolYear().id()));
        }
        if (present(request.endSchoolYear())) {
            item.setEndSchoolYear(schoolYears.get(request.endSchoolYear().id()));
        }
        if (present(request.previousStandard())) {
            item.setPreviousStandard(get(request.previousStandard().id()));
        }
        requireYearRange(item);
        requireComplete(item, request.documents());
        if (request.documents() != null) {
            syncDocuments(item, request.documents());
        }
    }

    @Override
    protected void applyUpdate(EquipmentStandard item, EquipmentStandardPatchRequest request) {
        if (request.standardVersion() != null) {
            item.setStandardVersion(blankToNull(request.standardVersion()));
        }
        // Ba trạng thái: vắng mặt là để nguyên, id null là xoá, id n là gán.
        if (request.educationLevel() != null) {
            item.setEducationLevel(request.educationLevel().id() == null
                    ? null : educationLevels.get(request.educationLevel().id()));
        }
        if (request.startSchoolYear() != null) {
            item.setStartSchoolYear(yearOf(request.startSchoolYear()));
        }
        if (request.endSchoolYear() != null) {
            item.setEndSchoolYear(yearOf(request.endSchoolYear()));
        }
        if (request.previousStandard() != null) {
            Long previousId = request.previousStandard().id();
            if (previousId != null && previousId.equals(item.getId())) {
                throw new FieldValidationException(
                        "previousStandard", "Bộ tiêu chuẩn không thể thay thế chính nó");
            }
            item.setPreviousStandard(previousId == null ? null : get(previousId));
        }
        requireYearRange(item);
        requireComplete(item, request.documents());
        if (request.documents() != null) {
            syncDocuments(item, request.documents());
        }
        // Bản nháp lập từ "Lập bộ mới": phiên bản đi theo số thông tư của các văn bản — sửa số hiệu thì đổi theo.
        if (item.getStatus() == StandardStatus.DRAFT && item.getPreviousStandard() != null && request.documents() != null) {
            item.setStandardVersion(versionOf(item.getDocuments()));
        }
        // Cờ "Đang hoạt động" của form không đổi được trạng thái: chỉ Áp dụng / Lập bộ mới đổi nó.
        item.setActive(item.getStatus() == StandardStatus.ACTIVE);
    }

    /** Bộ đã áp dụng (đang hay đã hết hiệu lực) là lịch sử — không xoá; bộ nháp xoá cùng thiết bị của nó. */
    @Override
    protected void beforeDelete(EquipmentStandard item) {
        if (item.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("status",
                    "Bộ đã áp dụng không xoá được — đó là căn cứ của dữ liệu đã có. Chỉ bộ nháp xoá được.");
        }
        entityManager().createQuery("DELETE FROM EquipmentNorm n WHERE n.standard = :s")
                .setParameter("s", item).executeUpdate();
    }

    /**
     * Lập bộ mới cho NHIỀU thông tư cùng một văn bản — Sở chọn thông tư nào điều chỉnh (chỉ 37, hay 38 và 39, hay cả
     * ba). Mỗi bộ được chọn phải đang áp dụng và chưa có bản nháp; thiếu một điều kiện thì không lập bộ nào (một giao
     * dịch). Mỗi bản nháp sửa và áp dụng riêng.
     */
    @Transactional
    public List<EquipmentStandard> reviseMany(List<Long> ids, StandardReviseRequest request) {
        List<Long> distinct = ids == null ? List.of() : ids.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            throw new FieldValidationException("standardIds", "Chọn thông tư cần điều chỉnh");
        }
        List<String> busy = new ArrayList<>();
        for (Long id : distinct) {
            EquipmentStandard source = get(id);
            if (source.getStatus() != StandardStatus.ACTIVE) {
                throw new FieldValidationException("standardIds", "Chỉ điều chỉnh được bộ đang áp dụng.");
            }
            boolean hasDraft = !entityManager().createQuery(
                    "SELECT s.id FROM EquipmentStandard s WHERE s.previousStandard = :p AND s.status = :d", Long.class)
                    .setParameter("p", source).setParameter("d", StandardStatus.DRAFT).getResultList().isEmpty();
            if (hasDraft) {
                busy.add(source.getEducationLevel() == null ? source.getCode() : source.getEducationLevel().getName());
            }
        }
        if (!busy.isEmpty()) {
            throw new FieldValidationException("standardIds", String.join(", ", busy)
                    + " đang có bản nháp chưa áp dụng — áp dụng hoặc xoá bản nháp đó trước.");
        }
        List<EquipmentStandard> drafts = new ArrayList<>();
        for (Long id : distinct) {
            drafts.add(revise(id, request));
        }
        return drafts;
    }

    /**
     * Lập bộ mới: chép bộ {@code id} (văn bản căn cứ và TOÀN BỘ dòng thiết bị) thành một bộ NHÁP, trỏ
     * {@code previousStandard} về bộ cũ. Sửa thiết bị trong bản nháp rồi {@link #apply} — bộ cũ không bị đụng tới cho
     * tới lúc đó.
     *
     * <p>Một lần sửa phải có CĂN CỨ. Danh mục mỗi cấp chỉ có một thông tư gốc; Bộ chỉ sửa nó bằng thông tư sửa đổi, bổ
     * sung ({@code AMENDMENT} — bắt buộc khai văn bản: số hiệu, trích yếu, ngày ban hành, ngày hiệu lực) hoặc đính chính
     * ({@code CORRECTION} — bắt buộc lý do; có quyết định đính chính thì khai kèm). Văn bản khai thành một dòng trong
     * căn cứ của bản nháp; năm học bắt đầu gợi ý theo ngày hiệu lực.
     */
    @Transactional
    public EquipmentStandard revise(Long id, StandardReviseRequest request) {
        RevisionKind kind = request.kind();
        if (kind == null) {
            throw new FieldValidationException("kind", "Chọn sửa đổi, bổ sung hay đính chính");
        }
        StandardReviseRequest.Document doc = request.document();
        boolean hasDoc = doc != null && doc.documentNo() != null && !doc.documentNo().isBlank();
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        if (kind == RevisionKind.CORRECTION && reason == null) {
            throw new FieldValidationException("reason", "Nhập lý do đính chính");
        }
        // Cả sửa đổi lẫn đính chính đều phải có văn bản (trưởng nhóm 16/11/2026): đính chính khai số, ngày ban hành
        // của văn bản đính chính, kèm lý do bằng chữ.
        requireRevisionDocument(doc, kind == RevisionKind.AMENDMENT);
        String standardVersion = request.standardVersion();
        EquipmentStandard source = get(id);
        if (source.getStatus() == StandardStatus.DRAFT) {
            throw new FieldValidationException("status", "Đây đã là bộ nháp — sửa thẳng trên bộ này.");
        }
        if (source.getStatus() == StandardStatus.RETIRED) {
            throw new FieldValidationException("status", "Bộ đã hết hiệu lực — lập bộ mới từ bộ đang áp dụng.");
        }
        boolean hasDraft = !entityManager().createQuery(
                "SELECT s.id FROM EquipmentStandard s WHERE s.previousStandard = :p AND s.status = :d", Long.class)
                .setParameter("p", source).setParameter("d", StandardStatus.DRAFT)
                .getResultList().isEmpty();
        if (hasDraft) {
            throw new FieldValidationException("status", "Bộ này đã có một bản nháp đang soạn — mở bản nháp đó.");
        }

        EquipmentStandard draft = new EquipmentStandard();
        draft.setCode(nextRevisionCode(source.getCode()));
        draft.setName(source.getName());
        draft.setSortOrder(source.getSortOrder());
        draft.setNote(source.getNote());
        draft.setEducationLevel(source.getEducationLevel());
        draft.setPreviousStandard(source);
        draft.setStatus(StandardStatus.DRAFT);
        int order = 1;
        for (EquipmentStandardDocument d : source.getDocuments()) {
            EquipmentStandardDocument copy = new EquipmentStandardDocument(draft);
            copy.setDocumentRole(d.getDocumentRole());
            copy.setDocumentNo(d.getDocumentNo());
            copy.setDocumentName(d.getDocumentName());
            copy.setIssuingAuthority(d.getIssuingAuthority());
            copy.setIssueDate(d.getIssueDate());
            copy.setEffectiveDate(d.getEffectiveDate());
            copy.setUrl(d.getUrl());
            copy.setSortOrder(order++);
            draft.getDocuments().add(copy);
        }
        EquipmentStandardDocument revision = null;
        if (hasDoc) {
            String no = doc.documentNo().trim();
            if (source.getDocuments().stream().anyMatch(d -> no.equalsIgnoreCase(d.getDocumentNo()))) {
                throw new FieldValidationException("document.documentNo", "Văn bản này đã có trong căn cứ của bộ");
            }
            revision = new EquipmentStandardDocument(draft);
            revision.setDocumentRole(kind == RevisionKind.AMENDMENT ? DocumentRole.AMENDMENT : DocumentRole.CORRECTION);
            revision.setDocumentNo(no);
            revision.setDocumentName(doc.documentName() == null ? null : doc.documentName().trim());
            revision.setIssuingAuthority(doc.issuingAuthority() == null || doc.issuingAuthority().isBlank()
                    ? "Bộ Giáo dục và Đào tạo" : doc.issuingAuthority().trim());
            revision.setIssueDate(doc.issueDate());
            revision.setEffectiveDate(doc.effectiveDate());
            revision.setUrl(doc.url() == null || doc.url().isBlank() ? null : doc.url().trim());
            revision.setSortOrder(order++);
            draft.getDocuments().add(revision);
        }
        // Năm học áp dụng KHÔNG đặt lúc lập: nó là năm học của ngày bấm Áp dụng (trưởng nhóm 16/11/2026).
        draft.setRevisionKind(kind);
        draft.setRevisionNote(reason);
        draft.setStandardVersion(standardVersion == null || standardVersion.isBlank()
                ? versionOf(draft.getDocuments()) : standardVersion.trim());
        entityManager().persist(draft);
        entityManager().flush();
        if (revision != null) {
            draft.setRevisionDocumentId(revision.getId());
        }

        // Chép mọi dòng thiết bị, giữ nguyên mã (mã chỉ duy nhất trong một bộ); văn bản nguồn của dòng
        // trỏ sang bản chép của đúng văn bản ấy (khớp theo số hiệu).
        entityManager().createNativeQuery("""
                INSERT INTO equipment_norms (code, name, sort_order, active, note, standard_id, equipment_type_id,
                    subject_id, grade_id, room_type_id, min_quantity, unit_id, norm_basis, source_document_id,
                    created_at, catalog_id, basis_size, quantity_text, unit_text, grade_levels, item_no,
                    section_name, topic, purpose, description, for_teacher, for_student, optional, effective_from)
                SELECT n.code, n.name, n.sort_order, n.active, n.note, :draft, n.equipment_type_id,
                    n.subject_id, n.grade_id, n.room_type_id, n.min_quantity, n.unit_id, n.norm_basis,
                    (SELECT nd.id FROM equipment_standard_documents od
                     JOIN equipment_standard_documents nd ON nd.standard_id = :draft AND nd.document_no = od.document_no
                     WHERE od.id = n.source_document_id LIMIT 1),
                    now(), n.catalog_id, n.basis_size, n.quantity_text, n.unit_text, n.grade_levels, n.item_no,
                    n.section_name, n.topic, n.purpose, n.description, n.for_teacher, n.for_student, n.optional,
                    n.effective_from
                FROM equipment_norms n WHERE n.standard_id = :source
                  AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE)""")
                .setParameter("draft", draft.getId())
                .setParameter("source", source.getId())
                .executeUpdate();
        return draft;
    }

    /**
     * Dòng phụ lục khác bộ trước. Bộ đã áp dụng: danh sách ghi lúc áp dụng (bộ áp dụng trước khi có bảng ghi thì so
     * lại với bộ trước nó). Bộ nháp: so ngay — xem trước khi áp dụng. Bộ không có bộ trước: rỗng.
     */
    @Transactional(readOnly = true)
    public List<StandardChange> changes(Long id) {
        EquipmentStandard standard = get(id);
        if (standard.getStatus() != StandardStatus.DRAFT) {
            List<StandardChange> recorded = changes.recorded(standard.getId());
            if (recorded != null) {
                return recorded;
            }
        }
        if (standard.getPreviousStandard() == null) {
            return List.of();
        }
        return changes.compare(standard.getId(), standard.getPreviousStandard().getId()).changes();
    }

    /**
     * Áp dụng bộ nháp: bộ đang áp dụng của cùng cấp học chuyển HẾT HIỆU LỰC, bộ này thành ĐANG ÁP DỤNG,
     * và cờ "thuộc danh mục tối thiểu" của danh mục thiết bị tính lại theo các bộ đang áp dụng.
     *
     * <p>Bộ lập từ bộ trước phải có căn cứ của lần sửa và phải khác bộ trước. Dòng thêm / đổi của lần sửa đổi, bổ sung
     * lấy văn bản sửa đổi làm "văn bản quy định"; lần đính chính giữ căn cứ cũ của dòng. Danh sách thêm / đổi / bỏ ghi
     * lại để tra về sau.
     */
    @Transactional
    public EquipmentStandard apply(Long id) {
        EquipmentStandard draft = get(id);
        if (draft.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("status", "Chỉ bộ nháp mới áp dụng được.");
        }
        if (draft.getDocuments().isEmpty()) {
            throw new FieldValidationException("documents", "Bộ chưa có văn bản căn cứ — khai văn bản trước khi áp dụng.");
        }
        Long norms = entityManager().createQuery(
                "SELECT count(n) FROM EquipmentNorm n WHERE n.standard = :s", Long.class)
                .setParameter("s", draft).getSingleResult();
        if (norms == 0) {
            throw new FieldValidationException("status", "Bộ chưa có thiết bị nào.");
        }
        // Văn bản của lần sửa chưa có hiệu lực thì chưa áp dụng được (đính chính không ghi ngày hiệu lực: ngày ban hành).
        EquipmentStandardDocument basis = revisionDocument(draft);
        LocalDate inForce = basis == null ? null
                : basis.getEffectiveDate() != null ? basis.getEffectiveDate() : basis.getIssueDate();
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        if (inForce != null && inForce.isAfter(today)) {
            throw new FieldValidationException("status", "Văn bản " + basis.getDocumentNo() + " có hiệu lực từ "
                    + inForce.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) + " — chưa áp dụng được.");
        }
        // Thời điểm xác nhận: từ đây bộ mới tính đủ / thiếu và báo cáo, bộ cũ hết hiệu lực — một mốc cho cả hai.
        java.time.Instant confirmedAt = java.time.Instant.now();
        // Năm học áp dụng = năm học chứa ngày bấm Áp dụng. Bộ khai tay từ đầu (không lập từ bộ trước) đã khai thì giữ.
        if (draft.getPreviousStandard() != null || draft.getStartSchoolYear() == null) {
            draft.setStartSchoolYear(schoolYearFrom(today));
        }
        StandardChanges.Diff diff = null;
        if (draft.getPreviousStandard() != null) {
            if (draft.getRevisionKind() == null) {
                throw new FieldValidationException("revisionKind",
                        "Bản nháp chưa khai căn cứ của lần sửa (sửa đổi, bổ sung hay đính chính) — xoá bản nháp và lập lại.");
            }
            if (draft.getRevisionKind() == RevisionKind.AMENDMENT && revisionDocument(draft) == null) {
                throw new FieldValidationException("documents",
                        "Văn bản sửa đổi của lần này không còn trong căn cứ của bộ — xoá bản nháp và lập lại.");
            }
            entityManager().flush();
            diff = changes.compare(draft.getId(), draft.getPreviousStandard().getId());
            if (diff.changes().isEmpty()) {
                throw new FieldValidationException("status", "Bản nháp chưa khác bộ đang áp dụng — chưa có gì để áp dụng.");
            }
        }
        for (EquipmentStandard current : entityManager().createQuery(
                "SELECT s FROM EquipmentStandard s WHERE s.educationLevel = :lv AND s.status = :a", EquipmentStandard.class)
                .setParameter("lv", draft.getEducationLevel()).setParameter("a", StandardStatus.ACTIVE)
                .getResultList()) {
            current.setStatus(StandardStatus.RETIRED);
            current.setRetiredAt(confirmedAt);
            // Bộ cũ hết áp dụng từ năm học bộ mới bắt đầu: năm kết thúc của nó là năm học liền trước. Bộ đang áp dụng
            // không tự khai năm kết thúc (form không có ô đó) — nó đặt ở đây. Đã khai tay từ trước thì giữ; năm liền trước
            // sớm hơn năm bắt đầu của chính nó (hai bộ cùng bắt đầu một năm) thì để trống, không ghi khoảng ngược.
            if (current.getEndSchoolYear() == null && draft.getStartSchoolYear() != null) {
                SchoolYear started = current.getStartSchoolYear();
                entityManager().createQuery(
                        "SELECT y FROM SchoolYear y WHERE y.startDate < :d ORDER BY y.startDate DESC", SchoolYear.class)
                        .setParameter("d", draft.getStartSchoolYear().getStartDate()).setMaxResults(1)
                        .getResultStream().findFirst()
                        .filter(y -> started == null || !y.getStartDate().isBefore(started.getStartDate()))
                        .ifPresent(current::setEndSchoolYear);
            }
        }
        // Đẩy "hết hiệu lực" xuống trước: chỉ mục duy nhất "mỗi cấp một bộ đang áp dụng".
        entityManager().flush();
        draft.setStatus(StandardStatus.ACTIVE);
        draft.setAppliedAt(confirmedAt);
        entityManager().flush();
        // Dòng chưa gắn thiết bị (thêm tay trong bản nháp, hoặc nhập từ Excel mà danh mục chưa có) sinh ra
        // thiết bị CHUẨN ngay lúc áp dụng — danh mục thiết bị chỉ thêm thiết bị của thông tư bằng lối này.
        String legalBasis = draft.getDocuments().stream().map(EquipmentStandardDocument::getDocumentNo)
                .filter(no -> no != null && !no.isBlank()).collect(Collectors.joining(", "));
        for (EquipmentNorm norm : entityManager().createQuery(
                "SELECT n FROM EquipmentNorm n WHERE n.standard = :s AND n.catalog IS NULL ORDER BY n.id", EquipmentNorm.class)
                .setParameter("s", draft).getResultList()) {
            norm.setCatalog(catalogs.ensureForStandard(draft.getEducationLevel(), norm.getSubject(), norm.getName(),
                    norm.getEquipmentType(), norm.getUnit(), norm.getDescription(), norm.isForTeacher(), norm.isForStudent(),
                    legalBasis));
        }
        entityManager().flush();
        entityManager().createNativeQuery("""
                UPDATE equipment_catalogs c SET minimum_required = EXISTS (
                    SELECT 1 FROM equipment_norms n JOIN equipment_standards s ON s.id = n.standard_id
                    WHERE n.catalog_id = c.id AND n.active AND s.status = 'ACTIVE'
                      AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE))
                WHERE c.owner_school_id IS NULL""").executeUpdate();
        if (diff != null) {
            EquipmentStandardDocument revision = revisionDocument(draft);
            if (draft.getRevisionKind() == RevisionKind.AMENDMENT && revision != null) {
                changes.tagSource(diff.touchedNormIds(), revision.getId());
            }
            changes.record(draft.getId(), diff.changes());
        }
        return draft;
    }


    /** Số hiệu thông tư viết gọn: "37/2021/TT-BGDĐT" → "37/2021"; số không theo khuôn ấy giữ nguyên. */
    private static final Pattern CIRCULAR_NO = Pattern.compile("^(\\d+/\\d{4})(?:/.*)?$");

    /**
     * Phiên bản của bộ = chuỗi số thông tư đã gộp vào nó, theo thứ tự (trưởng nhóm 16/11/2026: "2021, sửa đổi 2023"
     * khó hiểu, gọi theo số thông tư): căn cứ chính, các văn bản sửa đổi, đính chính (tiền tố "ĐC") —
     * "TT 37/2021 + 26/2023 + 16/2026". Văn bản hướng dẫn / tham khảo không vào. Cột 50 ký tự. Changelog 268 đặt lại
     * bộ có sẵn cùng cách.
     */
    static String versionOf(Collection<EquipmentStandardDocument> docs) {
        String chain = docs.stream()
                .filter(d -> d.getDocumentRole() == DocumentRole.MAIN || d.getDocumentRole() == DocumentRole.AMENDMENT
                        || d.getDocumentRole() == DocumentRole.CORRECTION)
                .sorted(Comparator.comparing(EquipmentStandardDocument::getSortOrder,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(d -> {
                    String no = d.getDocumentNo().trim();
                    Matcher m = CIRCULAR_NO.matcher(no);
                    String shortNo = m.matches() ? m.group(1) : no;
                    return d.getDocumentRole() == DocumentRole.CORRECTION ? "ĐC " + shortNo : shortNo;
                })
                .collect(Collectors.joining(" + "));
        if (chain.isEmpty()) {
            return null;
        }
        String label = "TT " + chain;
        return label.length() <= 50 ? label : label.substring(0, 50);
    }

    /** Văn bản của lần sửa, nếu còn trong căn cứ của bộ. */
    private static EquipmentStandardDocument revisionDocument(EquipmentStandard item) {
        Long id = item.getRevisionDocumentId();
        return id == null ? null : item.getDocuments().stream().filter(d -> id.equals(d.getId())).findFirst().orElse(null);
    }

    /**
     * Văn bản của lần sửa: sửa đổi, bổ sung thì đủ số hiệu, trích yếu, ngày ban hành (không sau hôm nay), ngày hiệu lực
     * (không trước ngày ban hành); quyết định đính chính khai kèm thì đủ số hiệu, ngày ban hành.
     */
    private static void requireRevisionDocument(StandardReviseRequest.Document doc, boolean amendment) {
        if (doc == null || doc.documentNo() == null || doc.documentNo().isBlank()) {
            throw new FieldValidationException("document.documentNo", "Nhập số hiệu văn bản");
        }
        if (amendment && (doc.documentName() == null || doc.documentName().isBlank())) {
            throw new FieldValidationException("document.documentName", "Nhập trích yếu");
        }
        if (doc.issueDate() == null) {
            throw new FieldValidationException("document.issueDate", "Nhập ngày ban hành");
        }
        if (doc.issueDate().isAfter(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw new FieldValidationException("document.issueDate", "Ngày ban hành không được sau hôm nay");
        }
        if (amendment && doc.effectiveDate() == null) {
            throw new FieldValidationException("document.effectiveDate", "Nhập ngày hiệu lực");
        }
        if (doc.effectiveDate() != null && doc.effectiveDate().isBefore(doc.issueDate())) {
            throw new FieldValidationException("document.effectiveDate", "Không được trước ngày ban hành");
        }
    }

    /**
     * Năm học áp dụng một văn bản: năm học chứa ngày hiệu lực; ngày đó rơi vào kỳ nghỉ hè (ngoài mọi năm học) thì năm
     * học kế tiếp. Không có năm học nào hợp thì để trống — người dùng chọn.
     */
    private SchoolYear schoolYearFrom(LocalDate date) {
        if (date == null) {
            return null;
        }
        return entityManager().createQuery(
                "SELECT y FROM SchoolYear y WHERE y.endDate >= :d ORDER BY y.startDate ASC", SchoolYear.class)
                .setParameter("d", date).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }

    /** {@code STD-TH} → {@code STD-TH-2}, {@code STD-TH-2} → {@code STD-TH-3}: số nhỏ nhất còn trống. */
    private String nextRevisionCode(String code) {
        String base = code.replaceFirst("-\\d+$", "");
        for (int n = 2; ; n++) {
            String candidate = base + "-" + n;
            Long taken = entityManager().createQuery(
                    "SELECT count(s) FROM EquipmentStandard s WHERE lower(s.code) = lower(:c)", Long.class)
                    .setParameter("c", candidate).getSingleResult();
            if (taken == 0) {
                return candidate;
            }
        }
    }

    /** Lọc theo cấp học: {@code educationLevel.id=n}. */
    @Override
    protected Specification<EquipmentStandard> extraFilters(ListParams params) {
        Specification<EquipmentStandard> byParam = CatalogSpecifications.referenceFilter(params, "educationLevel");
        // Tài khoản của một trường chỉ thấy bộ tiêu chuẩn của CẤP HỌC trường mình — cùng luật với danh
        // mục thiết bị (`EquipmentCatalogService.levelScope`). Ghép AND nên tham số lọc không nới được.
        Long levelId = callerLevel.educationLevelId();
        if (levelId == null) {
            return byParam;
        }
        return byParam.and((root, q, cb) -> cb.equal(root.get("educationLevel").get("id"), levelId));
    }

    private SchoolYear yearOf(IdRef ref) {
        return ref.id() == null ? null : schoolYears.get(ref.id());
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }

    private static void requireYearRange(EquipmentStandard item) {
        SchoolYear start = item.getStartSchoolYear();
        SchoolYear end = item.getEndSchoolYear();
        if (start != null && end != null && end.getStartDate().isBefore(start.getStartDate())) {
            throw new FieldValidationException(
                    "endSchoolYear", "Năm học kết thúc phải từ năm học bắt đầu trở đi");
        }
    }

    private void syncDocuments(EquipmentStandard item, List<StandardDocumentInput> inputs) {
        Map<Long, EquipmentStandardDocument> existing = new HashMap<>();
        for (EquipmentStandardDocument doc : item.getDocuments()) {
            existing.put(doc.getId(), doc);
        }

        List<EquipmentStandardDocument> keep = new ArrayList<>();
        int order = 1;
        for (StandardDocumentInput input : inputs) {
            EquipmentStandardDocument doc = input.id() == null ? null : existing.get(input.id());
            if (doc == null) {
                doc = new EquipmentStandardDocument(item);
                item.getDocuments().add(doc);
            }
            doc.setDocumentRole(input.documentRole());
            doc.setDocumentNo(input.documentNo().trim());
            doc.setDocumentName(blankToNull(input.documentName()));
            doc.setIssuingAuthority(blankToNull(input.issuingAuthority()));
            doc.setIssueDate(input.issueDate());
            doc.setEffectiveDate(input.effectiveDate());
            doc.setUrl(blankToNull(input.url()));
            doc.setSortOrder(order++);
            keep.add(doc);
        }
        // Sửa trên CHÍNH tập Hibernate đang theo dõi, không gán tập mới.
        item.getDocuments().retainAll(keep);
    }
}
