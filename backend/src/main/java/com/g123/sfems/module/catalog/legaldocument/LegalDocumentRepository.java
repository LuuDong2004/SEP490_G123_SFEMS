package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import org.springframework.data.jpa.repository.Query;

public interface LegalDocumentRepository extends CatalogRepository<LegalDocument> {

    @Query("select count(d) > 0 from LegalDocument d where d.replaces.id = :id")
    boolean isReplacedBy(Long id);
}
