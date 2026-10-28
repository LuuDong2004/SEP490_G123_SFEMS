package com.g123.sfems.domain.catalog.coderule;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Quy tắc sinh mã tự động cho một danh mục — "Tùy chỉnh mã tự động" của bản Jmix.
 *
 * <p>Mã kế tiếp = {@code prefix + đệm0(currentNumber + 1, numberLength) + suffix}.
 * {@code numberLength} là độ rộng của RIÊNG phần số, không phải cả mã. Bộ đếm
 * tăng liên tục, không bao giờ quay về 0.
 *
 * <p>Mỗi danh mục đích ({@link #target}, tên resource như {@code units}) có tối
 * đa một quy tắc — database giữ bằng unique constraint.
 */
@Entity
@Table(name = "code_rules")
public class CodeRule extends CatalogEntity {

    @Column(nullable = false, length = 64, unique = true)
    private String target;

    @Column(length = 20)
    private String prefix;

    @Column(length = 20)
    private String suffix;

    @Column(name = "number_length", nullable = false)
    private Integer numberLength = 4;

    @Column(name = "current_number", nullable = false)
    private Long currentNumber = 0L;

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getPrefix() {
        return prefix;
    }

    public void setPrefix(String prefix) {
        this.prefix = prefix;
    }

    public String getSuffix() {
        return suffix;
    }

    public void setSuffix(String suffix) {
        this.suffix = suffix;
    }

    public Integer getNumberLength() {
        return numberLength;
    }

    public void setNumberLength(Integer numberLength) {
        this.numberLength = numberLength;
    }

    public Long getCurrentNumber() {
        return currentNumber;
    }

    public void setCurrentNumber(Long currentNumber) {
        this.currentNumber = currentNumber;
    }

    /** Mã mà số {@code number} sẽ cho ra theo quy tắc này. */
    public String format(long number) {
        return format(prefix, suffix, numberLength, number);
    }

    public static String format(String prefix, String suffix, Integer numberLength, long number) {
        int width = numberLength == null ? 0 : numberLength;
        String digits = width > 0 ? String.format("%0" + width + "d", number) : Long.toString(number);
        return (prefix == null ? "" : prefix) + digits + (suffix == null ? "" : suffix);
    }
}
