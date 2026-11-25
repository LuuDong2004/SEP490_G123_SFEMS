package com.g123.sfems.module.school.voucher;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/voucher_links?resource=&id=} — phiếu gốc và các phiếu sinh ra từ một phiếu ({@link VoucherLinks}).
 * Không có mã quyền riêng: ai đọc được phiếu thì đọc được phiếu liên quan của nó, như nhật ký duyệt.
 */
@RestController
@RequestMapping("/api/voucher_links")
public class VoucherLinkController {

    private final VoucherLinks links;

    public VoucherLinkController(VoucherLinks links) {
        this.links = links;
    }

    @GetMapping
    public List<VoucherLinks.Link> list(@RequestParam String resource, @RequestParam Long id) {
        return links.of(resource, id);
    }
}
