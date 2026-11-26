package com.g123.sfems.domain.school.student;

import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Một học sinh của trường (304), thuộc MỘT lớp — năm học suy ra từ lớp.
 *
 * <p>Dùng chung khuôn dữ liệu của trường ({@link SchoolOwnedEntity}): {@code code} là mã học sinh, {@code name} là
 * họ và tên (cột {@code full_name}). Mã chỉ duy nhất trong một lớp: unique {@code (class_id, code)} ở database, và
 * service kiểm cùng phạm vi để nói bằng tiếng Việt.
 *
 * <p>Dữ liệu cá nhân của trẻ vị thành niên: chỉ vai loại trường có quyền {@code students:*} (Sở, quản trị viên thấy
 * sĩ số qua lớp, không thấy danh sách). Lớp có học sinh thì {@code school_classes.student_count} tự đếm từ đây.
 */
@RowLevelResource("students")
@Entity
@Table(name = "students")
@AttributeOverride(name = "name", column = @Column(name = "full_name", nullable = false, length = 255))
public class Student extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "class_id", nullable = false)
    private SchoolClass schoolClass;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", length = 16)
    private StudentGender gender;

    public SchoolClass getSchoolClass() {
        return schoolClass;
    }

    public void setSchoolClass(SchoolClass schoolClass) {
        this.schoolClass = schoolClass;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public StudentGender getGender() {
        return gender;
    }

    public void setGender(StudentGender gender) {
        this.gender = gender;
    }
}
