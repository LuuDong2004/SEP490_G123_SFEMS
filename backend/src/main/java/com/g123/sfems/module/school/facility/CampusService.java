package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.catalog.base.CampusRule;
import org.springframework.beans.factory.annotation.Autowired;
import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SameName;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.FlushModeType;
import org.springframework.stereotype.Service;

/**
 * Cơ sở. Quy tắc riêng: mỗi trường một cơ sở chính — đánh dấu cơ sở này là
 * chính thì cơ sở chính cũ tự bỏ đánh dấu.
 */
@Service
public class CampusService extends SchoolOwnedService<Campus, CampusRequest, CampusPatchRequest> {

    /** Id không bao giờ tồn tại — "bỏ cờ của TẤT CẢ" khi cơ sở mới chưa có id. */
    private static final long NO_ID = -1L;

    private final CampusRepository repository;

    public CampusService(
            CampusRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals) {
        super(repository, rowLevel, Campus.class, Campus::new, "Cơ sở", schools, principals);
        this.repository = repository;
    }

    @Override
    protected void applyCreateOwned(Campus item, CampusRequest request) {
        item.setPhone(blankToNull(request.phone()));
        item.setAddress(blankToNull(request.address()));
        if (Boolean.TRUE.equals(request.primaryCampus())) {
            repository.clearPrimaryExcept(item.getSchool().getId(), NO_ID);
            item.setPrimaryCampus(true);
        } else if (countCampuses(item.getSchool().getId(), true) == 0) {
            // Trường chưa có cơ sở chính: cơ sở đầu tiên là cơ sở chính.
            item.setPrimaryCampus(true);
        }
        item.setBranch(!Boolean.TRUE.equals(item.getPrimaryCampus()) && Boolean.TRUE.equals(request.branch()));
        requireNameFree(item);
    }

    @Override
    protected void applyUpdateOwned(Campus item, CampusPatchRequest request) {
        if (request.phone() != null) {
            item.setPhone(blankToNull(request.phone()));
        }
        if (request.address() != null) {
            item.setAddress(blankToNull(request.address()));
        }
        if (request.primaryCampus() != null) {
            if (!request.primaryCampus() && Boolean.TRUE.equals(item.getPrimaryCampus())) {
                throw new FieldValidationException("primaryCampus",
                        "Trường phải có một cơ sở chính — đánh dấu cơ sở khác là chính");
            }
            if (request.primaryCampus() &&!Boolean.TRUE.equals(item.getPrimaryCampus())) {
                repository.clearPrimaryExcept(item.getSchool().getId(), item.getId());
            }
            item.setPrimaryCampus(request.primaryCampus());
        }
        if (request.branch() != null) {
            item.setBranch(request.branch());
        }
        if (Boolean.TRUE.equals(item.getPrimaryCampus())) {
            // Trường chính không là phân hiệu / điểm trường.
            item.setBranch(false);
        }
        if (request.name() != null || request.active() != null) {
            requireNameFree(item);
        }
    }

    /** Hai cơ sở cùng tên trong một trường thì ô chọn cơ sở (phòng, khối nhà, cán bộ) không phân biệt được. */
    private void requireNameFree(Campus item) {
        if (SameName.taken(entityManager(), Campus.class, item, "school", item.getSchool().getId())) {
            throw new FieldValidationException("name", "Trường đã có cơ sở tên \"%s\"".formatted(item.getName().trim()));
        }
    }

    /** Không xoá cơ sở chính khi trường còn cơ sở khác: đánh dấu cơ sở khác là chính trước. */
    @Override
    protected void beforeDelete(Campus item) {
        if (Boolean.TRUE.equals(item.getPrimaryCampus()) && countCampuses(item.getSchool().getId(), false) > 1) {
            throw new FieldValidationException("primaryCampus",
                    "Đây là cơ sở chính — đánh dấu cơ sở khác là chính trước khi xoá");
        }
    }

    /** Số cơ sở của trường ({@code primaryOnly}: chỉ đếm cơ sở chính). Không đẩy bản ghi đang sửa xuống DB. */
    private long countCampuses(Long schoolId, boolean primaryOnly) {
        return entityManager()
                .createQuery("SELECT count(c) FROM Campus c WHERE c.school.id = :school"
                        + (primaryOnly ? " AND c.primaryCampus = true" : ""), Long.class)
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("school", schoolId)
                .getSingleResult();
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở (270), xem {@link CampusScope}. */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    @Override
    protected CampusRule<Campus> campusRule() {
        return campusScope.campuses();
    }
}
