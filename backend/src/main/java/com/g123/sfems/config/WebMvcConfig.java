package com.g123.sfems.config;

import com.g123.sfems.module.security.auth.api.AuthVersionAdvice;
import com.g123.sfems.shared.web.ListResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import com.g123.sfems.module.system.activity.ActivityLogInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS for the Vite dev server.
 *
 * <p>Both custom response headers have to be exposed explicitly: neither is one
 * of the CORS-safelisted headers, so without this the browser strips them. The
 * failure is silent in both cases and looks like a feature that was never
 * built — every list renders a total of 0, and a permission change never
 * reaches an open tab.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;
    private final ActivityLogInterceptor activityLog;

    public WebMvcConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins,
            ActivityLogInterceptor activityLog) {
        this.allowedOrigins = allowedOrigins;
        this.activityLog = activityLog;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(activityLog).addPathPatterns("/api/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                // Content-Disposition: tên tệp khi tải tệp đính kèm hay tệp xuất về.
                .exposedHeaders(ListResponse.TOTAL_COUNT_HEADER, AuthVersionAdvice.HEADER, "Content-Disposition")
                .maxAge(3600);
    }
}
