package com.g123.sfems.shared.validation;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

final class Formats {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private Formats() {
    }

    /** Kiểu Việt Nam: chấm hàng nghìn, phẩy thập phân. */
    static String number(BigDecimal value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols();
        symbols.setGroupingSeparator('.');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.###", symbols).format(value);
    }

    static String date(LocalDate value) {
        return value.format(DATE);
    }
}
