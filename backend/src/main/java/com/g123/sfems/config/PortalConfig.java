package com.g123.sfems.config;

import com.g123.sfems.shared.web.portal.PortalHandlerMapping;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.autoconfigure.WebMvcRegistrations;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Cổng API theo loại tài khoản (docs/kien-truc/11): thay bộ ánh xạ controller mặc định bằng
 * {@link PortalHandlerMapping}, đăng ký mỗi endpoint thêm dưới {@code /api/<cổng>/...} theo bảng phân cổng.
 * {@code app.portal.legacy-api} (mặc định bật) giữ đường dẫn cũ chạy song song tới khi giao diện chuyển xong.
 */
@Configuration
public class PortalConfig {

    @Bean
    public WebMvcRegistrations portalRegistrations(@Value("${app.portal.legacy-api:true}") boolean legacyApi) {
        return new WebMvcRegistrations() {
            @Override
            public RequestMappingHandlerMapping getRequestMappingHandlerMapping() {
                return new PortalHandlerMapping(legacyApi);
            }
        };
    }
}
