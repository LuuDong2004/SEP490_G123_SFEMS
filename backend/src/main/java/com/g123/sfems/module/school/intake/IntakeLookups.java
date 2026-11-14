package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.intake.EquipmentIntakeDocument;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gợi ý khi lập phiếu ghi tăng (254) — đọc từ chính các phiếu của trường, không có danh mục riêng phải nuôi:
 *
 * <ul>
 *   <li>danh bạ nhà cung cấp: tên, mã số thuế, nguồn kinh phí và hình thức mua sắm của lần mua gần nhất;</li>
 *   <li>hoá đơn trùng: cùng số hoá đơn của cùng nhà cung cấp đã ghi tăng ở phiếu khác (cảnh báo, không chặn);</li>
 *   <li>lần nhập trước của một thiết bị: đơn giá, model, hãng, bảo hành.</li>
 * </ul>
 *
 * <p>Trường đọc qua {@link SchoolService#get} — có phạm vi dòng: không đọc được trường thì không có gợi ý.
 */
@Service
@Transactional(readOnly = true)
public class IntakeLookups {

    public record SupplierHint(String name, String taxCode, FundingSource fundingSource, RefSummary acquisitionMethod,
            LocalDate lastDate, String contact) {
    }

    public record DuplicateDocument(Long intakeId, String code, VoucherStatus status, LocalDate intakeDate, Integer docNo) {
    }

    public record CatalogHistory(Long catalogId, BigDecimal unitPrice, String model, String manufacturer,
            Integer warrantyMonths, String intakeCode, LocalDate intakeDate) {
    }

    private static final List<VoucherStatus> LIVE = List.of(VoucherStatus.DRAFT, VoucherStatus.PENDING,
            VoucherStatus.APPROVED, VoucherStatus.COMPLETED);

    private final EntityManager entityManager;
    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;

    public IntakeLookups(EntityManager entityManager, SchoolService schools, RowLevelPrincipalResolver principals) {
        this.entityManager = entityManager;
        this.schools = schools;
        this.principals = principals;
    }

    /** Nhà cung cấp trường đã mua, lần gần nhất trước; {@code q} lọc theo tên, mã số thuế hoặc liên hệ (điện thoại / email). Tối đa 20. */
    public List<SupplierHint> suppliers(Long schoolId, String q) {
        Long school = school(schoolId);
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        List<EquipmentIntakeDocument> rows = entityManager.createQuery("""
                        select d from EquipmentIntakeDocument d join fetch d.intake i
                        where i.school.id = :school and d.supplier is not null and i.status in :live
                          and (lower(d.supplier) like :like or coalesce(d.taxCode, '') like :like
                               or lower(coalesce(d.contact, '')) like :like)
                        order by i.intakeDate desc, i.id desc""", EquipmentIntakeDocument.class)
                .setParameter("school", school)
                .setParameter("live", LIVE)
                .setParameter("like", like)
                .setMaxResults(200)
                .getResultList();
        Map<String, SupplierHint> out = new LinkedHashMap<>();
        for (EquipmentIntakeDocument d : rows) {
            String key = d.getTaxCode() != null ? d.getTaxCode() : d.getSupplier().trim().toLowerCase(Locale.ROOT);
            out.putIfAbsent(key, new SupplierHint(d.getSupplier(), d.getTaxCode(), d.getFundingSource(),
                    RefSummary.of(d.getAcquisitionMethod()), d.getIntake().getIntakeDate(), d.getContact()));
            if (out.size() >= 20) {
                break;
            }
        }
        return new ArrayList<>(out.values());
    }

    /**
     * Phiếu khác (chưa huỷ, chưa bị từ chối) có hoá đơn cùng số của cùng nhà cung cấp — so mã số thuế nếu có, không thì
     * tên. {@code excludeId}: phiếu đang sửa.
     */
    public List<DuplicateDocument> duplicates(Long schoolId, String documentNo, String taxCode, String supplier, Long excludeId) {
        Long school = school(schoolId);
        String no = documentNo == null ? "" : documentNo.trim().toLowerCase(Locale.ROOT);
        if (no.isEmpty()) {
            return List.of();
        }
        String tax = taxCode == null ? "" : taxCode.trim();
        String name = supplier == null ? "" : supplier.trim().toLowerCase(Locale.ROOT);
        if (tax.isEmpty() && name.isEmpty()) {
            return List.of();
        }
        List<EquipmentIntakeDocument> rows = entityManager.createQuery("""
                        select d from EquipmentIntakeDocument d join fetch d.intake i
                        where i.school.id = :school and lower(trim(d.documentNo)) = :no and i.status in :live
                        order by i.intakeDate desc""", EquipmentIntakeDocument.class)
                .setParameter("school", school)
                .setParameter("no", no)
                .setParameter("live", LIVE)
                .getResultList();
        List<DuplicateDocument> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (EquipmentIntakeDocument d : rows) {
            Long intakeId = d.getIntake().getId();
            if (intakeId.equals(excludeId) || !seen.add(intakeId)) {
                continue;
            }
            boolean sameSupplier = (!tax.isEmpty() && tax.equals(d.getTaxCode()))
                    || (!name.isEmpty() && d.getSupplier() != null && name.equals(d.getSupplier().trim().toLowerCase(Locale.ROOT)));
            if (sameSupplier) {
                out.add(new DuplicateDocument(intakeId, d.getIntake().getCode(), d.getIntake().getStatus(),
                        d.getIntake().getIntakeDate(), d.getDocNo()));
            }
        }
        return out;
    }

    /** Lần ghi tăng ĐÃ DUYỆT gần nhất của từng thiết bị ở trường: đơn giá, model, hãng, bảo hành (của cái đầu tiên). */
    public List<CatalogHistory> history(Long schoolId, List<Long> catalogIds) {
        Long school = school(schoolId);
        if (catalogIds == null || catalogIds.isEmpty()) {
            return List.of();
        }
        List<EquipmentIntakeLine> rows = entityManager.createQuery("""
                        select l from EquipmentIntakeLine l join fetch l.intake i
                        where i.school.id = :school and l.catalog.id in :ids and i.status in :done
                          and l.receivedQuantity > 0
                        order by i.intakeDate desc, i.id desc, l.lineNo asc""", EquipmentIntakeLine.class)
                .setParameter("school", school)
                .setParameter("ids", catalogIds.stream().limit(200).toList())
                .setParameter("done", List.of(VoucherStatus.APPROVED, VoucherStatus.COMPLETED))
                .setMaxResults(1000)
                .getResultList();
        Map<Long, CatalogHistory> out = new LinkedHashMap<>();
        for (EquipmentIntakeLine l : rows) {
            out.putIfAbsent(l.getCatalog().getId(), new CatalogHistory(l.getCatalog().getId(), l.getUnitPrice(),
                    l.modelOf(0), l.manufacturerOf(0), l.warrantyMonthsOf(0), l.getIntake().getCode(),
                    l.getIntake().getIntakeDate()));
        }
        return new ArrayList<>(out.values());
    }

    /** Trường hỏi: theo tham số (đọc qua phạm vi dòng), vắng thì trường của tài khoản. */
    private Long school(Long schoolId) {
        if (schoolId != null) {
            return schools.get(schoolId).getId();
        }
        Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (own == null) {
            throw new FieldValidationException("schoolId", "Chọn trường");
        }
        return own;
    }
}
