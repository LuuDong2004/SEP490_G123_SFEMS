package com.g123.sfems.module.security.rowlevel.service;

import com.g123.sfems.shared.security.rowlevel.RowLevelContextProvider;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The context keys every application gets.
 *
 * <p>Each is one bean volunteering one key, which is the whole extension
 * mechanism: an application-specific key is another bean of the same shape, and
 * nothing in the engine changes to accommodate it.
 *
 * <p>None of them queries anything. Everything the account-shaped keys need is
 * already on {@link RowLevelPrincipal}, which came out of the authority cache —
 * so a scope costs no SQL at all, which is the budget the whole design is built
 * to.
 */
@Configuration
public class RowLevelContextProviders {

    @Bean
    RowLevelContextProvider currentUserId() {
        return provider("user.id", Long.class, principal -> principal.userId());
    }

    /**
     * Trường của người đang gọi — khoá ngữ cảnh mà gần như mọi chính sách của
     * hệ thống này sẽ dùng: {@code school.id = user.schoolId} trên chính bảng
     * trường, và {@code school.id = user.schoolId} trên mọi bảng nghiệp vụ trỏ
     * về trường.
     *
     * <p>Đọc thẳng từ {@code RowLevelPrincipal}, vốn được dựng từ entry của
     * authority cache đã xác thực request này một nhịp trước — nên nó KHÔNG
     * tốn truy vấn nào, đúng ràng buộc "resolve không được chạm database" mà
     * mọi provider phải giữ.
     *
     * <p>Trả về {@code null} với tài khoản không thuộc trường nào. Một so sánh
     * với null cho ra {@code UNKNOWN}, và {@code UNKNOWN} bị xử như TỪ CHỐI —
     * nên tài khoản chưa gán trường thì không thấy gì, chứ không phải thấy tất
     * cả.
     */
    @Bean
    RowLevelContextProvider currentSchoolId() {
        return provider("user.schoolId", Long.class, RowLevelPrincipal::schoolId);
    }

    /**
     * Cơ quan quản lý của tài khoản — Sở hoặc UBND.
     *
     * <p>Đây là khoá làm cho "Sở quản lý THÔNG QUA UBND" thành một luật chạy
     * được: chính sách của UBND so khoá này với
     * {@code schools.departmentOfEducation.id}, nên mỗi UBND chỉ thấy trường
     * mình chủ quản mà không cần một mã quyền riêng cho từng địa bàn.
     *
     * <p>Rỗng với tài khoản của trường và tài khoản quản trị. Rỗng thì phép so
     * sánh cho ra UNKNOWN, và UNKNOWN bị xử như TỪ CHỐI — fail closed.
     */
    @Bean
    RowLevelContextProvider currentManagingBodyId() {
        return provider("user.managingBodyId", Long.class, RowLevelPrincipal::managingBodyId);
    }

    /** A set, so it is usable only with {@code in} and {@code notIn}. */
    @Bean
    RowLevelContextProvider currentRoleCodes() {
        return new RowLevelContextProvider() {
            @Override
            public String key() {
                return "user.roleCodes";
            }

            @Override
            public Class<?> type() {
                return String.class;
            }

            @Override
            public boolean isCollection() {
                return true;
            }

            @Override
            public Object resolve(RowLevelPrincipal principal) {
                return Set.copyOf(principal.roleCodes());
            }
        };
    }

    /**
     * Today, on the server.
     *
     * <p>Resolved here rather than sent by the client for the same reason
     * {@code TaskSpecifications.overdueSpec} resolves it here: a browser in
     * another timezone must not be able to disagree with a security policy about
     * what day it is.
     */
    @Bean
    RowLevelContextProvider today() {
        return provider("today", LocalDate.class, principal -> LocalDate.now());
    }

    @Bean
    RowLevelContextProvider now() {
        return provider("now", Instant.class, principal -> Instant.now());
    }

    private static RowLevelContextProvider provider(
            String key, Class<?> type, java.util.function.Function<RowLevelPrincipal, Object> resolve) {

        return new RowLevelContextProvider() {
            @Override
            public String key() {
                return key;
            }

            @Override
            public Class<?> type() {
                return type;
            }

            @Override
            public Object resolve(RowLevelPrincipal principal) {
                return resolve.apply(principal);
            }
        };
    }
}
