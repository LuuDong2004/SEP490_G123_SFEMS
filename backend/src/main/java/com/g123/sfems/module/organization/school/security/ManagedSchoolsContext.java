package com.g123.sfems.module.organization.school.security;

import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.shared.security.rowlevel.RowLevelContextProvider;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import org.springframework.stereotype.Component;

/**
 * Khoá ngữ cảnh {@code user.managedSchoolIds} — các trường mà cơ quan của tài
 * khoản (Sở hoặc UBND) là cơ quan quản lý.
 *
 * <p>Nó làm cho "UBND thấy phiếu của trường trên địa bàn mình" viết được thành
 * một chính sách trên MỌI bảng thuộc trường, chỉ với cột {@code school_id} đã có:
 * {@code school.id in user.managedSchoolIds}. Phương án kia là thêm cột cơ quan
 * quản lý vào từng bảng nghiệp vụ, và sửa lại chúng mỗi lần một trường đổi cơ
 * quan.
 *
 * <p>Tài khoản không thuộc cơ quan nào nhận tập rỗng, và {@code in} một tập rỗng
 * là SAI — không thấy gì, chứ không phải thấy tất cả.
 */
@Component
public class ManagedSchoolsContext implements RowLevelContextProvider {

    private final ManagedSchoolsCache cache;

    public ManagedSchoolsContext(ManagedSchoolsCache cache) {
        this.cache = cache;
    }

    @Override
    public String key() {
        return "user.managedSchoolIds";
    }

    @Override
    public Class<?> type() {
        return Long.class;
    }

    @Override
    public boolean isCollection() {
        return true;
    }

    @Override
    public Object resolve(RowLevelPrincipal principal) {
        return cache.schoolsOf(principal.managingBodyId());
    }
}
