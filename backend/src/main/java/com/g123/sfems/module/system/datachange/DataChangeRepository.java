package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.system.datachange.DataChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

interface DataChangeRepository extends JpaRepository<DataChange, Long>, JpaSpecificationExecutor<DataChange> {
}
