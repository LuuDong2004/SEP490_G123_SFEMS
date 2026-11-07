package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_standards")
public class EquipmentStandardController extends CatalogController<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {
    private final EquipmentStandardService service;
    private final RowLevelSecurity rowLevel;
    private final StandardDocumentService documents;

    public EquipmentStandardController(EquipmentStandardService service, RowLevelSecurity rowLevel,
            StandardDocumentService documents) {
        super(service, rowLevel);
        this.service = service;
        this.rowLevel = rowLevel;
        this.documents = documents;
    }

    @Override protected String resource() { return "equipment_standards"; }
    @Override protected Object respond(EquipmentStandard item, RowLevelSecurity security) {
        return EquipmentStandardResponse.from(item, security,
                security == null ? List.of() : documents.list(item.getId()));
    }

    @PostMapping("/{id}/apply")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object apply(@PathVariable Long id) {
        return respond(service.apply(id), rowLevel);
    }

    @PostMapping("/{id}/revise")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object revise(@PathVariable Long id, @Valid @RequestBody(required = false) ReviseRequest request) {
        return respond(service.revise(id, request == null ? null : request.standardVersion()), rowLevel);
    }

    public record ReviseRequest(@Size(max = 50) String standardVersion) { }

    @GetMapping("/{id}/documents")
    @PreAuthorize("hasAuthority('equipment_standards:read')")
    public List<StandardDocumentResponse> documents(@PathVariable Long id) {
        return documents.list(id);
    }

    @PostMapping("/{id}/documents")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public StandardDocumentResponse addDocument(@PathVariable Long id,
            @Valid @RequestBody StandardDocumentRequest request) {
        return documents.create(id, request);
    }

    @PatchMapping("/{id}/documents/{documentId}")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public StandardDocumentResponse updateDocument(@PathVariable Long id, @PathVariable Long documentId,
            @Valid @RequestBody StandardDocumentRequest request) {
        return documents.update(id, documentId, request);
    }

    @DeleteMapping("/{id}/documents/{documentId}")
    @PreAuthorize("hasAuthority('equipment_standards:delete')")
    public StandardDocumentResponse deleteDocument(@PathVariable Long id, @PathVariable Long documentId) {
        return documents.delete(id, documentId);
    }
}
