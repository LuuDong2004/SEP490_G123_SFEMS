package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.domain.catalog.coderule.CodeRule;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.Optional;

public interface CodeRuleRepository extends CatalogRepository<CodeRule> {

    Optional<CodeRule> findByTarget(String target);
}
