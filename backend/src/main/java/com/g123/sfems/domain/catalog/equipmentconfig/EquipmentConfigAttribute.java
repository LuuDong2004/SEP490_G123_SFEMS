package com.g123.sfems.domain.catalog.equipmentconfig;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Arrays;
import java.util.List;

/**
 * Một thông số kỹ thuật trong bộ, ví dụ "Công suất" (số thập phân, W) hay "Loại màn hình" (chọn một
 * trong LCD/LED/OLED). Đây chỉ là định nghĩa; giá trị của từng thiết bị lưu ở sổ tài sản theo {@link #code}.
 */
@Entity
@Table(name = "equipment_config_attributes")
public class EquipmentConfigAttribute extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "config_id", nullable = false)
    private EquipmentConfig config;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_type", nullable = false, length = 20)
    private AttributeDataType dataType = AttributeDataType.TEXT;

    /** Đơn vị đo hiển thị cạnh giá trị, ví dụ "W", "inch", "kg". */
    @Column(name = "measure_unit", length = 32)
    private String measureUnit;

    @Column(nullable = false)
    private Boolean required = Boolean.FALSE;

    /** Các lựa chọn cho kiểu {@code ENUM}, mỗi dòng một giá trị. */
    @Column(columnDefinition = "text")
    private String options;

    @Column(name = "sort_order")
    private Integer sortOrder;

    protected EquipmentConfigAttribute() {
    }

    public EquipmentConfigAttribute(EquipmentConfig config) {
        this.config = config;
    }

    public EquipmentConfig getConfig() {
        return config;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public AttributeDataType getDataType() {
        return dataType;
    }

    public void setDataType(AttributeDataType dataType) {
        this.dataType = dataType == null ? AttributeDataType.TEXT : dataType;
    }

    public String getMeasureUnit() {
        return measureUnit;
    }

    public void setMeasureUnit(String measureUnit) {
        this.measureUnit = measureUnit;
    }

    public Boolean getRequired() {
        return required;
    }

    public void setRequired(Boolean required) {
        this.required = Boolean.TRUE.equals(required);
    }

    public List<String> getOptionList() {
        return options == null || options.isBlank() ? List.of()
                : Arrays.stream(options.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public void setOptionList(List<String> values) {
        List<String> clean = values == null ? List.of()
                : values.stream().map(v -> v == null ? "" : v.trim()).filter(v -> !v.isEmpty()).toList();
        this.options = clean.isEmpty() ? null : String.join("\n", clean);
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
