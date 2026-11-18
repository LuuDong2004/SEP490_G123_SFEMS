package com.g123.sfems.domain.school.team;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Tổ bộ môn của trường — "Tổ Toán - Tin", "Tổ Khoa học tự nhiên": tổ trưởng, các môn tổ phụ trách,
 * giáo viên thuộc tổ.
 *
 * <p>Một giáo viên thuộc MỘT tổ ({@code uq_subject_team_members_staff}); thêm vào tổ khác là chuyển
 * tổ, do service gỡ khỏi tổ cũ trước. Thành viên nằm ở phía tổ (bảng nối), không phải một cột trên
 * cán bộ — feature cán bộ không phải biết tổ bộ môn tồn tại.
 */
@RowLevelResource("subject_teams")
@Entity
@Table(name = "subject_teams")
public class SubjectTeam extends SchoolOwnedEntity {

    /** Tổ trưởng — cán bộ cùng trường. */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "leader_id")
    private Staff leader;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "subject_team_subjects",
            joinColumns = @JoinColumn(name = "team_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id"))
    @OrderBy("sortOrder ASC, name ASC")
    @BatchSize(size = 100)
    private Set<Subject> subjects = new LinkedHashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "subject_team_members",
            joinColumns = @JoinColumn(name = "team_id"),
            inverseJoinColumns = @JoinColumn(name = "staff_id"))
    @OrderBy("name ASC")
    @BatchSize(size = 100)
    private Set<Staff> members = new LinkedHashSet<>();

    public Staff getLeader() {
        return leader;
    }

    public void setLeader(Staff leader) {
        this.leader = leader;
    }

    public Set<Subject> getSubjects() {
        return subjects;
    }

    public Set<Staff> getMembers() {
        return members;
    }
}
