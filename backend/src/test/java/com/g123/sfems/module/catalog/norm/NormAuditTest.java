package com.g123.sfems.module.catalog.norm;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.catalog.standard.AdjustKind;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
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
                null, null, null, null, null, null, null, null, true, false, false, null, new IdRef(legal), null));
        norms.update(n.getId(), new EquipmentNormPatchRequest(null, null, null, null, null, null, null, null, null,
                null, null, BigDecimal.valueOf(3), null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, new IdRef(legal), null));
        long id = n.getId();
        norms.remove(id, new IdRef(legal));
        em.flush();
        List<String> fields = jdbc.queryForList(
                "SELECT field FROM data_changes WHERE resource = 'equipment_norms' AND record_id = ? ORDER BY id",
                String.class, id);
        assertThat(fields).contains("(thêm)", "minQuantity", "(xoá)");
    }

    @Test
    void adjustmentIsEditedOnTheActiveStandardAndAudited() {
        Long standard = jdbc.queryForObject(
                "SELECT id FROM equipment_standards WHERE status = 'ACTIVE' ORDER BY id LIMIT 1", Long.class);
        Long legal = jdbc.queryForObject("SELECT id FROM legal_documents ORDER BY id LIMIT 1", Long.class);
        Long other = jdbc.queryForObject("SELECT id FROM equipment_catalogs ORDER BY id LIMIT 1", Long.class);
        EquipmentNorm n = norms.create(new EquipmentNormRequest(null, "Thiết bị thử điều chỉnh", null, true,
                "Nơi chưa có điều kiện có thể sử dụng 01 bộ/02HS", new IdRef(standard), null, null, null, null, null,
                BigDecimal.ONE, null, NormBasis.PER_STUDENT, null, null, null, null, null, null, null, null, null, true,
                true, false, null, new IdRef(legal), new NormAdjustmentRequest(AdjustKind.REDUCE, BigDecimal.ONE,
                        NormBasis.PER_STUDENT, 2, "Nơi chưa có điều kiện", null, null, null, null, null,
                        "Nơi chưa có điều kiện có thể sử dụng 01 bộ/02HS", null)));
        assertThat(n.getAdjustKind()).isEqualTo(AdjustKind.REDUCE);
        assertThat(n.getAdjustBasisSize()).isEqualTo(2);

        norms.update(n.getId(), patch(legal, new NormAdjustmentRequest(AdjustKind.SHARED, null, null, null, null, null,
                null, null, null, null, "Có thể sử dụng thiết bị dùng chung", List.of(new IdRef(other)))));
        em.flush();
        EquipmentNorm shared = norms.get(n.getId());
        assertThat(shared.getAdjustKind()).isEqualTo(AdjustKind.SHARED);
        assertThat(shared.getAdjustQuantity()).isNull();
        assertThat(shared.getAdjustShared()).extracting(c -> c.getId()).containsExactly(other);
        List<String> fields = jdbc.queryForList(
                "SELECT field FROM data_changes WHERE resource = 'equipment_norms' AND record_id = ? ORDER BY id",
                String.class, n.getId());
        assertThat(fields).contains("adjustKind", "adjustShared");

        Long year = jdbc.queryForObject(
                "SELECT id FROM school_years WHERE start_date > ? ORDER BY start_date LIMIT 1", Long.class,
                n.getEffectiveFrom());
        EquipmentNorm stopped = norms.stop(n.getId(), new IdRef(legal), new IdRef(year));
        LocalDate start = jdbc.queryForObject("SELECT start_date FROM school_years WHERE id = ?", LocalDate.class, year);
        assertThat(stopped.getEffectiveTo()).isEqualTo(start);
        assertThat(stopped.getEndDocument()).isNotNull();
        assertThat(norms.inUse(n.getId())).isFalse();
    }

    private static EquipmentNormPatchRequest patch(Long legal, NormAdjustmentRequest adjustment) {
        return new EquipmentNormPatchRequest(null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new IdRef(legal), adjustment);
    }
}
