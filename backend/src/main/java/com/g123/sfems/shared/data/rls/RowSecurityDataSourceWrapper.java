package com.g123.sfems.shared.data.rls;

import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Thay bean DataSource bằng {@link RowSecurityDataSource} trước khi JPA, JdbcTemplate, Liquibase nhận nó — mọi
 * đường đọc ghi CSDL đều đi qua một chỗ. {@code app.db-rls.enabled=false} để tắt (công tắc khẩn).
 *
 * <p>Nguồn phạm vi lấy qua {@link ObjectProvider}: nó phụ thuộc chuỗi bean cần chính DataSource này.
 */
@Component
public class RowSecurityDataSourceWrapper implements BeanPostProcessor {

    private final ObjectProvider<DbRowScopeSource> scopes;
    private final boolean enabled;

    public RowSecurityDataSourceWrapper(ObjectProvider<DbRowScopeSource> scopes, Environment environment) {
        this.scopes = scopes;
        this.enabled = environment.getProperty("app.db-rls.enabled", Boolean.class, true);
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (enabled && bean instanceof DataSource dataSource && !(bean instanceof RowSecurityDataSource)) {
            return new RowSecurityDataSource(dataSource, scopes);
        }
        return bean;
    }
}
