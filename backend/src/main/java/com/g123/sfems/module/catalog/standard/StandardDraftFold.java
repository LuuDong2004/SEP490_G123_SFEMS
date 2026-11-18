package com.g123.sfems.module.catalog.standard;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gộp bản nháp còn sót vào bộ đang áp dụng (changelog 267 — bỏ khái niệm phiên bản / bản nháp, trưởng nhóm
 * 17/11/2026). Mỗi bản nháp lập từ bộ đang áp dụng được so với bộ đó ({@link StandardChanges}) rồi đổ vào bộ đang áp
 * dụng thành các dòng có ngày: thêm → dòng mới từ ngày hiệu lực của văn bản sửa đổi; đổi → dòng cũ thôi áp dụng từ
 * ngày đó, dòng mới (cùng mã) thay nó; bỏ → dòng cũ thôi áp dụng từ ngày đó. Văn bản sửa đổi chép vào căn cứ của bộ.
 * Xong thì xoá bản nháp. Chạy mỗi lần khởi động, không còn bản nháp thì không làm gì.
 */
@Component
class StandardDraftFold {

    private static final Logger LOG = LoggerFactory.getLogger(StandardDraftFold.class);

    private final JdbcTemplate jdbc;
    private final StandardChanges changes;

    StandardDraftFold(JdbcTemplate jdbc, StandardChanges changes) {
        this.jdbc = jdbc;
        this.changes = changes;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void foldDrafts() {
        List<Map<String, Object>> drafts = jdbc.queryForList("""
                SELECT d.id, d.previous_standard_id AS active_id, d.revision_document_id AS doc_id
                FROM equipment_standards d JOIN equipment_standards p ON p.id = d.previous_standard_id
                WHERE d.status = 'DRAFT' AND p.status = 'ACTIVE'""");
        for (Map<String, Object> d : drafts) {
            fold(((Number) d.get("id")).longValue(), ((Number) d.get("active_id")).longValue(),
                    d.get("doc_id") == null ? null : ((Number) d.get("doc_id")).longValue());
        }
    }

    private void fold(long draftId, long activeId, Long revisionDocId) {
        StandardChanges.Diff diff = changes.compare(draftId, activeId);
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        Long docId = null;
        if (revisionDocId != null && !diff.changes().isEmpty()) {
            Map<String, Object> doc = jdbc.queryForMap(
                    "SELECT document_no, effective_date, issue_date FROM equipment_standard_documents WHERE id = ?",
                    revisionDocId);
            Object when = doc.get("effective_date") != null ? doc.get("effective_date") : doc.get("issue_date");
            if (when instanceof Date sql) {
                date = sql.toLocalDate();
            }
            docId = documentInActive(activeId, revisionDocId, (String) doc.get("document_no"));
        }
        int added = 0;
        int changed = 0;
        int removed = 0;
        for (StandardChange c : diff.changes()) {
            switch (c.kind()) {
                case "ADDED" -> {
                    jdbc.update("""
                            UPDATE equipment_norms SET standard_id = ?, effective_from = ?, effective_to = NULL,
                                source_document_id = COALESCE(?, source_document_id), updated_at = now()
                            WHERE id = ?""", activeId, date, docId, c.normId());
                    added++;
                }
                case "CHANGED" -> {
                    Long old = diff.pairs().get(c.normId());
                    if (old == null) {
                        continue;
                    }
                    jdbc.update("""
                            UPDATE equipment_norms SET effective_to = ?, end_document_id = ?, updated_at = now()
                            WHERE id = ? AND effective_from < ?""", date, docId, old, date);
                    jdbc.update("""
                            UPDATE equipment_norms SET standard_id = ?, effective_from = ?, effective_to = NULL,
                                replaces_norm_id = ?, source_document_id = COALESCE(?, source_document_id),
                                updated_at = now()
                            WHERE id = ?""", activeId, date, old, docId, c.normId());
                    changed++;
                }
                case "REMOVED" -> {
                    jdbc.update("""
                            UPDATE equipment_norms SET effective_to = ?, end_document_id = ?, updated_at = now()
                            WHERE id = ? AND effective_from < ?""", date, docId, c.normId(), date);
                    removed++;
                }
                default -> {
                }
            }
        }
        // Phần còn lại của bản nháp là bản chép giống hệt bộ đang áp dụng: xoá cùng bản nháp.
        jdbc.update("UPDATE equipment_standards SET previous_standard_id = NULL WHERE previous_standard_id = ?", draftId);
        jdbc.update("DELETE FROM equipment_standards WHERE id = ?", draftId);
        jdbc.update("""
                UPDATE equipment_catalogs c SET minimum_required = EXISTS (
                    SELECT 1 FROM equipment_norms n JOIN equipment_standards s ON s.id = n.standard_id
                    WHERE n.catalog_id = c.id AND n.active AND s.status = 'ACTIVE'
                      AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE))
                WHERE c.owner_school_id IS NULL""");
        LOG.info("Gộp bản nháp {} vào bộ {} từ {}: thêm {}, đổi {}, bỏ {}", draftId, activeId, date, added, changed,
                removed);
    }

    /** Văn bản sửa đổi trong căn cứ của bộ đang áp dụng (cùng số hiệu), chưa có thì chép sang. */
    private Long documentInActive(long activeId, long draftDocId, String documentNo) {
        List<Long> found = jdbc.queryForList(
                "SELECT id FROM equipment_standard_documents WHERE standard_id = ? AND document_no = ? ORDER BY id",
                Long.class, activeId, documentNo);
        if (!found.isEmpty()) {
            return found.get(0);
        }
        return jdbc.queryForObject("""
                INSERT INTO equipment_standard_documents (standard_id, document_role, document_no, document_name,
                    issuing_authority, issue_date, effective_date, url, sort_order, created_at)
                SELECT ?, document_role, document_no, document_name, issuing_authority, issue_date, effective_date, url,
                    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM equipment_standard_documents WHERE standard_id = ?),
                    now()
                FROM equipment_standard_documents WHERE id = ?
                RETURNING id""", Long.class, activeId, activeId, draftDocId);
    }
}
