package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.DocumentRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record StandardDocumentRequest(
        DocumentRole documentRole,
        @NotBlank @Size(max = 100) String documentNo,
        @Size(max = 500) String documentName,
        @Size(max = 255) String issuingAuthority,
        LocalDate issueDate, LocalDate effectiveDate,
        @Size(max = 1000) String url,
        Integer sortOrder) {
}
