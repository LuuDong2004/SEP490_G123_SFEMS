package com.g123.sfems.module.school.coderule;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.organization.school.service.SchoolService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quy tắc sinh mã của một trường (TS-05, TS-06). Phạm vi theo trường: đọc theo quyền đọc trường, khai
 * theo quyền sửa trường, cùng cơ chế với {@code /api/schools/{id}/logo}.
 */
@RestController
@RequestMapping("/api/schools/{id}/code-rules")
public class SchoolCodeRuleController {

    private final AssetCodeService assetCodes;
    private final SchoolService schools;

    public SchoolCodeRuleController(AssetCodeService assetCodes, SchoolService schools) {
        this.assetCodes = assetCodes;
        this.schools = schools;
    }

    @GetMapping("/equipment")
    @PreAuthorize("hasAuthority('school_code_rules:read')")
    @Transactional(readOnly = true)
    public EquipmentCodeRuleResponse getEquipment(@PathVariable Long id) {
        School school = schools.get(id);
        return EquipmentCodeRuleResponse.from(assetCodes.view(school));
    }

    @PutMapping("/equipment")
    @PreAuthorize("hasAuthority('school_code_rules:write')")
    @Transactional
    public EquipmentCodeRuleResponse putEquipment(@PathVariable Long id,
            @RequestBody EquipmentCodeRuleRequest request) {
        School school = schools.getWritable(id);
        return EquipmentCodeRuleResponse.from(assetCodes.setStartNumber(school, request.startNumber()));
    }

    public record EquipmentCodeRuleRequest(Integer startNumber) {
    }

    public record EquipmentCodeRuleResponse(int startNumber, int numberLength) {

        static EquipmentCodeRuleResponse from(AssetCodeService.EquipmentRule rule) {
            return new EquipmentCodeRuleResponse(rule.startNumber(), 3);
        }
    }
}
