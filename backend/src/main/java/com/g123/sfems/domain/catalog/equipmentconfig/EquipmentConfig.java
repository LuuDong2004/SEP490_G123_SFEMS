package com.g123.sfems.domain.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Bộ thông số kỹ thuật (DM-01): danh sách thông số mà một loại thiết bị phải khai (công suất, kích
 * thước…). Bộ chỉ giữ ĐỊNH NGHĨA thông số ({@link EquipmentConfigAttribute}); giá trị theo từng thiết bị
 * nằm ở sổ tài sản.
 *
 * <p>{@link #scopeTypes} rỗng là dùng được cho mọi loại thiết bị. {@link #defaultConfig} là bộ được chọn
 * sẵn khi tạo thiết bị mới; service chặn hai bộ mặc định trùng loại thiết bị.
 */
@Entity
@Table(name = "equipment_configs")
public class EquipmentConfig extends CatalogEntity {

    @Column(length = 500)
    private String description;

    @Column(name = "is_default", nullable = false)
    private Boolean defaultConfig = Boolean.FALSE;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "equipment_config_scope_types",
            joinColumns = @JoinColumn(name = "config_id"),
            inverseJoinColumns = @JoinColumn(name = "equipment_type_id"))
    @OrderBy("sortOrder ASC, name ASC")
    @BatchSize(size = 100)
    private Set<EquipmentType> scopeTypes = new LinkedHashSet<>();

    /** Căn cứ pháp lý: thông tư, quyết định ban hành danh mục thiết bị. */
    @Column(name = "document_no", length = 100)
    private String documentNo;

    @Column(name = "document_name", length = 255)
    private String documentName;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "start_school_year_id")
    private SchoolYear startSchoolYear;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "end_school_year_id")
    private SchoolYear endSchoolYear;

    @OneToMany(mappedBy = "config", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 100)
    private Set<EquipmentConfigAttribute> attributes = new LinkedHashSet<>();

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getDefaultConfig() {
        return defaultConfig;
    }

    public void setDefaultConfig(Boolean defaultConfig) {
        this.defaultConfig = Boolean.TRUE.equals(defaultConfig);
    }

    public Set<EquipmentType> getScopeTypes() {
        return scopeTypes;
    }

    public String getDocumentNo() {
        return documentNo;
    }

    public void setDocumentNo(String documentNo) {
        this.documentNo = documentNo;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public void setIssueDate(LocalDate issueDate) {
        this.issueDate = issueDate;
    }

    public SchoolYear getStartSchoolYear() {
        return startSchoolYear;
    }

    public void setStartSchoolYear(SchoolYear startSchoolYear) {
        this.startSchoolYear = startSchoolYear;
    }

    public SchoolYear getEndSchoolYear() {
        return endSchoolYear;
    }

    public void setEndSchoolYear(SchoolYear endSchoolYear) {
        this.endSchoolYear = endSchoolYear;
    }

    public Set<EquipmentConfigAttribute> getAttributes() {
        return attributes;
    }
}
