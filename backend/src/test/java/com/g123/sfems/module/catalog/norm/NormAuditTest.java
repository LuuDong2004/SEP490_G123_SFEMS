package com.g123.sfems.module.catalog.norm;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

/** Danh mục tối thiểu phẳng: bộ đang áp dụng thêm / sửa / xoá trực tiếp, nhật ký ghi cả ba. */
@SpringBootTest
@Transactional
class NormAuditTest {

    @Autowired
    EquipmentNormService norms;

    @Autowired
    JdbcTemplate jdbc;

    @PersistenceContext
    EntityManager em;

    @BeforeEach
    void login() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("t", "t",
                "equipment_norms:read", "equipment_norms:write", "equipment_norms:delete", "equipment_standards:read",
                "legal_documents:read"));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void activeStandardIsEditedDirectlyAndAudited() {
        Long standard = jdbc.queryForObject(
                "SELECT id FROM equipment_standards WHERE status = 'ACTIVE' ORDER BY id LIMIT 1", Long.class);
        Long legal = jdbc.queryForObject("SELECT id FROM legal_documents ORDER BY id LIMIT 1", Long.class);
        EquipmentNorm n = norms.create(new EquipmentNormRequest(null, "Thiết bị thử nhật ký", null, true, null,
                new IdRef(standard), null, null, null, null, null, BigDecimal.ONE, null, NormBasis.PER_TEACHER, null,
                null, null, null, null, null, null, null, null, true, false, false, null, new IdRef(legal)));
        norms.update(n.getId(), new EquipmentNormPatchRequest(null, null, null, null, null, null, null, null, null,
                null, null, BigDecimal.valueOf(3), null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, new IdRef(legal)));
        long id = n.getId();
        norms.remove(id, new IdRef(legal));
        em.flush();
        List<String> fields = jdbc.queryForList(
                "SELECT field FROM data_changes WHERE resource = 'equipment_norms' AND record_id = ? ORDER BY id",
                String.class, id);
        assertThat(fields).contains("(thêm)", "minQuantity", "(xoá)");
    }
}
