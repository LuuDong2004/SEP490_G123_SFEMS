package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SchoolYearRepository extends CatalogRepository<SchoolYear> {

    /**
     * Bỏ cờ hiện hành của mọi năm học trừ {@code keepId}.
     *
     * <p>Một lệnh ghi KHÔNG phạm vi, và đó là lý do nó được khai tường minh ở
     * đây để review thấy: năm học là danh mục toàn cục, và bất biến "chỉ một năm
     * hiện hành" là của cả bảng, không phải của phạm vi người gọi.
     *
     * <p>Không {@code clearAutomatically}: xoá persistence context sẽ tách luôn
     * bản ghi mà service đang sửa, và lần ghi tiếp theo của nó sẽ lặng lẽ không
     * tới database.
     */
    @Modifying
    @Query("update SchoolYear s set s.current = false where s.current = true and s.id <> :keepId")
    int clearCurrentExcept(@Param("keepId") Long keepId);

    /** Năm học chứa một ngày, năm mới nhất trước. Đọc không phạm vi vì năm học là danh mục toàn cục. */
    @Query("select s from SchoolYear s where :day between s.startDate and s.endDate order by s.startDate desc")
    List<SchoolYear> containing(@Param("day") LocalDate day);

    /** Năm học khác (trừ {@code selfId}) có khoảng ngày chồng lên {@code [start, end]}. */
    @Query("select s from SchoolYear s where s.id <> :selfId and s.startDate <= :end and s.endDate >= :start")
    List<SchoolYear> overlapping(@Param("selfId") Long selfId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    /** Năm học đang mang cờ hiện hành (tối đa một — chỉ mục duy nhất có điều kiện giữ). */
    @Query("select s from SchoolYear s where s.current = true")
    List<SchoolYear> currentYears();
}
