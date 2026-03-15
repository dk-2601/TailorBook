(function () {
  // Minimal PDF generator for invoices (Type1 fonts + text only).
  // Produces a real PDF file that can be shared via Web Share API.

  function normalizeMoney(n, currency) {
    const amount = Number.isFinite(Number(n)) ? Number(n) : 0;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    return (currency || "Rs") + " " + formatted;
  }

  function formatDateToken(value) {
    if (!value) {
      return "-";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return day + "/" + month + "/" + year;
  }

  function pdfEscape(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\r?\n/g, " ");
  }

  function chunkLine(text, maxLen) {
    const t = String(text || "");
    if (t.length <= maxLen) {
      return [t];
    }
    const out = [];
    let start = 0;
    while (start < t.length) {
      out.push(t.slice(start, start + maxLen));
      start += maxLen;
    }
    return out;
  }

  function toPdfBytes(str) {
    // PDF uses binary; this is safe for ASCII output we generate.
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function makePdf(objects) {
    let body = "";
    const offsets = [0];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(body.length);
      body += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
    }
    const header = "%PDF-1.3\n%\u00e2\u00e3\u00cf\u00d3\n";
    const xrefStart = header.length + body.length;
    let xref = "xref\n0 " + (objects.length + 1) + "\n";
    xref += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i++) {
      const off = header.length + offsets[i];
      xref += String(off).padStart(10, "0") + " 00000 n \n";
    }
    const trailer =
      "trailer\n<< /Size " +
      (objects.length + 1) +
      " /Root 1 0 R >>\nstartxref\n" +
      xrefStart +
      "\n%%EOF\n";
    return toPdfBytes(header + body + xref + trailer);
  }

  function buildInvoicePages(model) {
    const A4_W = 595.28;
    const A4_H = 841.89;
    const margin = 42; // ~15mm
    const lineGap = 14;

    const pages = [];

    const maxRowsPerPage = 22; // safe for A4 with header + totals
    const rows = model.lines || [];

    let index = 0;
    while (index < rows.length || index === 0) {
      const slice = rows.slice(index, index + maxRowsPerPage);
      pages.push({
        rows: slice,
        pageNo: pages.length + 1,
        totalPages: 0, // fill later
        w: A4_W,
        h: A4_H,
        margin: margin,
        lineGap: lineGap
      });
      index += maxRowsPerPage;
      if (!rows.length) {
        break;
      }
    }

    pages.forEach(function (p) {
      p.totalPages = pages.length;
    });

    return pages;
  }

  function renderPageContent(model, page) {
    const w = page.w;
    const h = page.h;
    const m = page.margin;
    const g = page.lineGap;

    // Content stream commands
    const cmds = [];

    function setStroke(r, gg, b) {
      cmds.push(r + " " + gg + " " + b + " RG");
    }

    function setFill(r, gg, b) {
      cmds.push(r + " " + gg + " " + b + " rg");
    }

    function line(x1, y1, x2, y2) {
      cmds.push(x1.toFixed(2) + " " + y1.toFixed(2) + " m " + x2.toFixed(2) + " " + y2.toFixed(2) + " l S");
    }

    function text(font, size, x, y, t) {
      cmds.push("BT /" + font + " " + size + " Tf 1 0 0 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Tm (" + pdfEscape(t) + ") Tj ET");
    }

    function wrapText(font, size, x, y, maxChars, t) {
      const parts = chunkLine(t, maxChars);
      parts.forEach(function (part, i) {
        text(font, size, x, y - i * (size + 3), part);
      });
      return parts.length;
    }

    // Header
    setFill(0, 0, 0);
    text("F2", 18, m, h - m - 10, model.shopName || "SRI LADIES DESIGNER");
    text("F1", 11, m, h - m - 30, (model.shopAddressLines || []).join(", "));
    text("F1", 11, m, h - m - 45, String(model.shopPhone || ""));

    // Meta blocks
    const leftX = m;
    const rightX = w / 2 + 10;
    const blockTop = h - m - 80;
    setStroke(0.85, 0.87, 0.90);
    line(m, blockTop, w - m, blockTop);

    text("F2", 12, leftX, blockTop - 24, "Bill To");
    text("F1", 11, leftX, blockTop - 40, "Name: " + (model.customerName || "-"));
    text("F1", 11, leftX, blockTop - 56, "Phone: " + (model.customerPhone || "-"));

    text("F2", 12, rightX, blockTop - 24, "Invoice Details");
    text("F1", 11, rightX, blockTop - 40, "Order: " + (model.orderNo || "-"));
    text("F1", 11, rightX, blockTop - 56, "Invoice Date: " + (model.invoiceDate || "-"));
    text("F1", 11, rightX, blockTop - 72, "Est. Delivery: " + (model.estDeliveryDate || "-"));

    // Table header
    const tableTop = blockTop - 100;
    const colService = m;
    const colQty = w * 0.56;
    const colPrice = w * 0.69;
    const colTotal = w * 0.84;

    setFill(0.20, 0.22, 0.26);
    text("F2", 11, colService, tableTop, "SERVICE");
    text("F2", 11, colQty, tableTop, "QTY");
    text("F2", 11, colPrice, tableTop, "PRICE");
    text("F2", 11, colTotal, tableTop, "TOTAL");

    setStroke(0.85, 0.87, 0.90);
    line(m, tableTop - 8, w - m, tableTop - 8);

    // Table rows
    let y = tableTop - 28;
    setFill(0, 0, 0);
    page.rows.forEach(function (row) {
      const svc = String(row.serviceName || "Service");
      const qty = String(Math.max(1, Math.round(Number(row.qty) || 1)));
      const price = normalizeMoney(Math.max(0, Number(row.unitPrice) || 0), model.currency);
      const total = normalizeMoney(Math.max(0, Number(row.amount) || 0), model.currency);

      // Service can be long; wrap to max 34 chars, up to 2 lines.
      const usedLines = Math.min(2, wrapText("F1", 11, colService, y, 34, svc));
      text("F1", 11, colQty, y, qty);
      text("F1", 11, colPrice, y, price);
      text("F1", 11, colTotal, y, total);

      y -= usedLines * (11 + 3);
      y -= 8;
    });

    // Summary (only on last page)
    if (page.pageNo === page.totalPages) {
      const sumTop = Math.max(y - 10, m + 110);
      line(w * 0.62, sumTop + 34, w - m, sumTop + 34);
      text("F1", 12, w * 0.62, sumTop + 16, "Total");
      text("F2", 12, w - m - 150, sumTop + 16, normalizeMoney(model.total, model.currency));
      text("F1", 12, w * 0.62, sumTop - 2, "Paid");
      text("F2", 12, w - m - 150, sumTop - 2, normalizeMoney(model.paid, model.currency));
      text("F1", 12, w * 0.62, sumTop - 20, "Balance");
      text("F2", 12, w - m - 150, sumTop - 20, normalizeMoney(model.balance, model.currency));
    }

    // Footer
    const footerText = "Generated On " + (model.generatedOn || "") + " | Thanks for choosing " + (model.shopName || "");
    setFill(0.35, 0.40, 0.47);
    text("F1", 10, m, m - 10 + 20, footerText);
    text("F1", 10, w - m - 80, m - 10 + 20, "Page " + page.pageNo + "/" + page.totalPages);

    return cmds.join("\n");
  }

  function generateInvoicePdfBytes(order, config) {
    const cfg = config || {};
    const shop = cfg.shop || {};
    const currency = cfg.currencySymbol || "Rs";

    const paid = Number.isFinite(Number(order.paidAmount)) ? Number(order.paidAmount) : 0;
    const total = Number(order.totalAmount) || 0;
    const balance = Math.max(total - paid, 0);
    const lines = Array.isArray(order.lineItems) ? order.lineItems : [];

    const model = {
      currency: currency,
      shopName: shop.name || "SRI LADIES DESIGNER",
      shopAddressLines: Array.isArray(shop.addressLines) ? shop.addressLines : [],
      shopPhone: shop.phone || "",
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      orderNo: order.orderNo || "",
      invoiceDate: formatDateToken(order.createdAt),
      estDeliveryDate: formatDateToken(order.dueDate),
      generatedOn: formatDateToken(new Date()),
      total: total,
      paid: paid,
      balance: balance,
      lines: lines
    };

    const pages = buildInvoicePages(model);

    // PDF objects
    const objects = [];
    // 1: Catalog (Root)
    // 2: Pages
    // 3.. : Page + Contents per page
    // Fonts: Helvetica, Helvetica-Bold
    const pageKids = [];

    // Reserve slots: 1 Catalog, 2 Pages, 3 Font F1, 4 Font F2
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("<< /Type /Pages /Kids [] /Count 0 >>"); // fill later
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 3 0
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"); // 4 0

    let nextObj = 5;
    const pageObjNums = [];
    const contentObjNums = [];

    pages.forEach(function (page) {
      const pageObj = nextObj++;
      const contentObj = nextObj++;
      pageObjNums.push(pageObj);
      contentObjNums.push(contentObj);
    });

    // Build page + content objects
    pages.forEach(function (page, idx) {
      const content = renderPageContent(model, page);
      const contentStream =
        "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream";
      objects[contentObjNums[idx] - 1] = contentStream;

      const pageDict =
        "<< /Type /Page /Parent 2 0 R " +
        "/MediaBox [0 0 595.28 841.89] " +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
        "/Contents " + contentObjNums[idx] + " 0 R >>";
      objects[pageObjNums[idx] - 1] = pageDict;
      pageKids.push(pageObjNums[idx] + " 0 R");
    });

    // Fill Pages object (2 0)
    objects[1] = "<< /Type /Pages /Kids [" + pageKids.join(" ") + "] /Count " + pageKids.length + " >>";

    return makePdf(objects);
  }

  window.TailorInvoicePdf = {
    generateBytes: generateInvoicePdfBytes
  };
})();

