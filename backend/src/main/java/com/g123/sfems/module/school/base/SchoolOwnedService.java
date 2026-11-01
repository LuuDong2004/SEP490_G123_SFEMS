package com.g123.sfems.module.school.base;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.data.jpa.domain.Specification;

/**
 * Logic chung của dữ liệu thuộc trường, dựng trên {@link CatalogService}.
 *
 * <p>Thêm ba việc so với danh mục:
 *
 * <ul>
 *   <li><b>Trường sở hữu</b> lấy từ payload ({@code school.id}); vắng thì lấy trường của TÀI KHOẢN
 *       đang đăng nhập — cán bộ trường không phải chọn trường của chính mình. Không có cả hai (Sở tạo
 *       mà quên chọn) là 422.</li>
 *   <li><b>Không đổi trường</b> sau khi tạo: dữ liệu chuyển trường là một nghiệp vụ, không phải một
 *       lần sửa form.</li>
 *   <li><b>Mã duy nhất trong trường</b>, không phải trong cả bảng.</li>
 * </ul>
 *
 * <p>Việc "chỉ thấy/sửa trường mình" KHÔNG nằm ở đây mà ở phân quyền dòng: một cán bộ trường gửi
 * {@code school.id} của trường khác sẽ bị chặn ở {@code checkWritable}, và đọc thì chỉ thấy dòng
 * trong phạm vi.
 *
 * <p>Lớp con: {@link #applyCreateOwned} / {@link #applyUpdateOwned} ghi các trường riêng,
 * {@link #ownedFilters} thêm bộ lọc riêng, {@link #resolveCode} đổi cách cấp mã (TS-06 quy tắc mã của
 * trường đè lại hàm này).
 */
public abstract class SchoolOwnedService<
                T extends SchoolOwnedEntity, C extends SchoolOwnedInput, P extends SchoolOwnedInput>
        extends CatalogService<T, C, P> {

    private final SchoolOwnedRepository<T> repository;
    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;

    protected SchoolOwnedService(
            SchoolOwnedRepository<T> repository,
            RowLevelSecurity rowLevel,
            Class<T> type,
            Supplier<T> factory,
            String label,
            SchoolService schools,
            RowLevelPrincipalResolver principals) {
        super(repository, rowLevel, type, factory, label);
        this.repository = repository;
        this.schools = schools;
        this.principals = principals;
    }

    /** Dữ liệu thuộc trường không dùng quy tắc sinh mã dùng chung của Sở. */
    @Override
    protected String codeTarget() {
        return null;
    }

    @Override
    protected final void applyCreate(T item, C request) {
        item.setSchool(resolveSchool(request.school()));
        applyCreateOwned(item, request);
        // Sau móc tạo, trước kiểm trùng của lớp cha: mã cấp lại vẫn được kiểm như mã gõ tay.
        item.setCode(resolveCode(item, item.getCode()));
    }

    @Override
    protected final void applyUpdate(T item, P request) {
        IdRef school = request.school();
        if (school != null && school.id() != null && !school.id().equals(item.getSchool().getId())) {
            throw new FieldValidationException("school", "Không đổi được trường sau khi tạo");
        }
        applyUpdateOwned(item, request);
    }

    /** Lọc {@code school.id=n} + bộ lọc riêng của lớp con. */
    @Override
    protected final Specification<T> extraFilters(ListParams params) {
        return CatalogSpecifications.<T>referenceFilter(params, "school").and(ownedFilters(params));
    }

    @Override
    protected Optional<T> findSameCode(T item, String code) {
        return repository.findBySchoolIdAndCodeIgnoreCase(item.getSchool().getId(), code);
    }

    /**
     * Mã của bản ghi mới: mặc định giữ mã người dùng gõ (rỗng thì lớp cha báo "Mã là bắt buộc"). Loại
     * dữ liệu có quy tắc sinh mã của trường (TS-05, TS-06) đè hàm này để cấp mã khi để trống.
     */
    protected String resolveCode(T item, String code) {
        return code;
    }

    /** Móc tạo cho trường riêng; trường sở hữu đã được gán. */
    protected void applyCreateOwned(T item, C request) {
    }

    /** Móc sửa cho trường riêng, ngữ nghĩa patch. */
    protected void applyUpdateOwned(T item, P request) {
    }

    protected Specification<T> ownedFilters(ListParams params) {
        return Specification.unrestricted();
    }

    /** Bản ghi khác mà lớp con tham chiếu tới phải cùng trường (thiết bị -> phòng...). */
    protected static void requireSameSchool(SchoolOwnedEntity item, SchoolOwnedEntity other, String field) {
        if (other != null && !other.getSchool().getId().equals(item.getSchool().getId())) {
            throw new FieldValidationException(field, "Phải thuộc cùng trường");
        }
    }

    protected School resolveSchool(IdRef ref) {
        if (ref != null && ref.id() != null) {
            return schools.get(ref.id());
        }
        Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (own == null) {
            throw new FieldValidationException("school", "Chọn trường");
        }
        return schools.get(own);
    }
}
