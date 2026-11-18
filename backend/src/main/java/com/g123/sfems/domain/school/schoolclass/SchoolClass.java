package com.g123.sfems.domain.school.schoolclass;

import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Lớp học của trường — "6A1", "10C2" — như SchoolClass của bản Jmix.
 *
 * <p>{@code code} là tên ngắn của lớp (6A1), {@code name} là tên hiển thị (Lớp 6A1). Mỗi năm học
 * một bộ lớp, nên mã chỉ duy nhất trong (trường, năm học): unique {@code (school_id,
 * school_year_id, code)} ở database, và service kiểm cùng phạm vi ấy để nói bằng tiếng Việt.
 */
@RowLevelResource("school_classes")
@Entity
@Table(name = "school_classes")
public class SchoolClass extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "grade_id", nullable = false)
    private Grade grade;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "school_year_id", nullable = false)
    private SchoolYear schoolYear;

    /** Giáo viên chủ nhiệm — cán bộ cùng trường. */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "homeroom_teacher_id")
    private Staff homeroomTeacher;

    /** Phòng học của lớp — phòng cùng trường. */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "room_id")
    private Room room;

    /** Sĩ số. */
    @Column(name = "student_count")
    private Integer studentCount;

    public Grade getGrade() {
        return grade;
    }

    public void setGrade(Grade grade) {
        this.grade = grade;
    }

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
    }

    public Staff getHomeroomTeacher() {
        return homeroomTeacher;
    }

    public void setHomeroomTeacher(Staff homeroomTeacher) {
        this.homeroomTeacher = homeroomTeacher;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public Integer getStudentCount() {
        return studentCount;
    }

    public void setStudentCount(Integer studentCount) {
        this.studentCount = studentCount;
    }
}
