package com.g123.sfems;

import com.g123.sfems.shared.data.SecuredRepositoryImpl;
import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Entities, repositories and controllers all live below this package, so
 * component scanning finds them without any {@code @EntityScan} of its own
 * despite the {@code domain} and {@code module} trees being separate.
 *
 * <p>The one explicit piece is {@link EnableJpaRepositories}, and it is here
 * only to name a base class. {@link SecuredRepositoryImpl} lends {@code save},
 * {@code delete} and {@code flush} back to
 * {@link com.g123.sfems.shared.data.SecuredRepository}, which deliberately
 * inherits nothing. Registering it for every repository rather than for the
 * secured ones alone is both simpler and harmless: Spring Data exposes only what
 * a repository's own interface declares, so the extra methods are reachable
 * exactly where they were asked for. Declaring {@code basePackages} is required
 * once the annotation is present at all, because it replaces the default scan
 * Boot would otherwise configure.
 */
@SpringBootApplication
@EnableJpaRepositories(
        basePackages = "com.g123.sfems",
        repositoryBaseClass = SecuredRepositoryImpl.class)
public class SfemsApplication {

    /** Giờ nghiệp vụ: "hôm nay" của ngày chứng từ, năm trong mã tài sản, hạn dùng, lịch chạy tác vụ. */
    public static final String ZONE = "Asia/Ho_Chi_Minh";

    public static void main(String[] args) {
        // Đặt trước khi Spring khởi động, không để theo máy chủ: ảnh Docker chạy UTC, nên từ 0 giờ đến 7 giờ sáng
        // LocalDate.now() còn là hôm qua — ngày chứng từ, mã tài sản đầu năm, hạn dùng lệch một ngày. pgjdbc cũng
        // đặt TimeZone của phiên theo giá trị này, nên CURRENT_DATE trong SQL cùng một "hôm nay". Mọi cột thời
        // điểm là TIMESTAMPTZ, nên giá trị đã lưu không đổi nghĩa.
        TimeZone.setDefault(TimeZone.getTimeZone(ZONE));
        SpringApplication.run(SfemsApplication.class, args);
    }

}
