package com.g123.sfems.module.school.base;

import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.Optional;
import org.springframework.data.repository.NoRepositoryBean;

/** Repository của dữ liệu thuộc trường. Lớp con chỉ cần {@code interface RoomRepository extends SchoolOwnedRepository<Room> {}}. */
@NoRepositoryBean
public interface SchoolOwnedRepository<T extends SchoolOwnedEntity> extends CatalogRepository<T> {

    /** Bản ghi cùng trường đang giữ mã này — mã chỉ duy nhất trong một trường. */
    Optional<T> findBySchoolIdAndCodeIgnoreCase(Long schoolId, String code);
}
