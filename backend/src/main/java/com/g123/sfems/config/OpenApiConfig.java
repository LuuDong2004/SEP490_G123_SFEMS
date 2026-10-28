package com.g123.sfems.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Tài liệu API (QLTB-449, 252) ở {@code /swagger-ui.html}: mọi endpoint, tham số, kiểu trả về — sinh từ chính code
 * nên không lệch khỏi API thật. Xác thực bằng access token Bearer: tài khoản người dùng ({@code POST /api/auth/login})
 * hoặc khoá API của hệ thống đối tác ({@code POST /api/auth/token}).
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer";

    @Bean
    OpenAPI qltbOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("QLTB — API quản lý cơ sở vật chất và thiết bị trường học")
                        .version("1.0")
                        .description("""
                                Danh sách là `GET /api/{resource}?_start=&_end=&_sort=&_order=&{field}{_op}=`, trả mảng JSON, \
                                tổng số dòng ở header `X-Total-Count`. Thêm `POST`, sửa `PATCH`, xoá `DELETE /api/{resource}/{id}`. \
                                Lỗi luôn có body JSON; 422 kèm `errors` theo từng ô.

                                Xác thực: lấy access token (15 phút) qua `POST /api/auth/login` (người dùng) hoặc \
                                `POST /api/auth/token` với khoá API (hệ thống đối tác — Quản trị → Khoá API tích hợp), \
                                rồi bấm **Authorize** và dán token. Quyền và phạm vi dữ liệu của token là của tài khoản đứng tên."""))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
