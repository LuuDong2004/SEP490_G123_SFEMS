package com.g123.sfems.module.report;

import java.math.BigDecimal;
import java.util.List;

public record AdequacyReportResponse(String scope, Filters filters, Summary summary, List<Band> distribution,
        List<Row> rows, List<DetailRow> details) {
    public record Option(Long id, String label) {}
    public record Filters(List<Option> schools, List<Option> subjects, List<Option> grades,
            List<Option> equipmentTypes) {}
    public record Summary(int schools, int countedSchools, int averagePercent, BigDecimal shortageTotal,
            BigDecimal surplusTotal, int unknownNorms) {}
    public record Band(String key, String label, int count) {}
    public record Row(Long schoolId, String schoolCode, String schoolName, String educationLevel,
            Integer classCount, Integer studentCount, int norms, int met, int unknown, int shortageNorms,
            BigDecimal shortageTotal, int surplusNorms, BigDecimal surplusTotal, Integer percent) {}
    public record DetailRow(Long schoolId, String schoolCode, String schoolName, String normCode, String normName,
            String itemNo, String catalogCode, String catalogName, String subjectName, String gradeName,
            String gradeLevels, String equipmentTypeName, Integer required, BigDecimal available,
            BigDecimal shortage, BigDecimal surplus, Integer percent) {}
}
