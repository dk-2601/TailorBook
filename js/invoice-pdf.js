(function () {
  // Minimal PDF generator for invoices (Type1 fonts + text only).
  // Produces a real PDF file that can be shared via Web Share API.

  function normalizeMoney(n) {
    const amount = Number.isFinite(Number(n)) ? Number(n) : 0;
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function normalizeMoneyLabel(n) {
    return "INR " + normalizeMoney(n);
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
    let startIndex = 1;
    while (index < rows.length || index === 0) {
      const slice = rows.slice(index, index + maxRowsPerPage);
      pages.push({
        rows: slice,
        startIndex: startIndex,
        pageNo: pages.length + 1,
        totalPages: 0, // fill later
        w: A4_W,
        h: A4_H,
        margin: margin,
        lineGap: lineGap
      });
      index += maxRowsPerPage;
      startIndex += slice.length;
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

    function rect(x, y, width, height, paint) {
      cmds.push(
        x.toFixed(2) +
          " " +
          y.toFixed(2) +
          " " +
          width.toFixed(2) +
          " " +
          height.toFixed(2) +
          " re " +
          (paint || "S")
      );
    }

    function text(font, size, x, y, t) {
      cmds.push("BT /" + font + " " + size + " Tf 1 0 0 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Tm (" + pdfEscape(t) + ") Tj ET");
    }

    function approxTextWidth(font, size, t) {
      const s = String(t || "");
      const factor = font === "F2" ? 0.56 : 0.52;
      return s.length * size * factor;
    }

    function textRight(font, size, rightX, y, t) {
      const width = approxTextWidth(font, size, t);
      const x = Math.max(m, rightX - width);
      text(font, size, x, y, t);
    }

    function textCenter(font, size, leftX, rightX, y, t) {
      const width = approxTextWidth(font, size, t);
      const x = leftX + ((rightX - leftX - width) / 2);
      text(font, size, x, y, t);
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
    text("F1", 10, m, h - m + 6, "INVOICE");
    text("F2", 18, m, h - m - 10, model.shopName || "SRI LADIES DESIGNER");
    text("F1", 11, m, h - m - 30, (model.shopAddressLines || []).join(", "));
    text("F1", 11, m, h - m - 45, String(model.shopPhone || ""));

    // Meta blocks
    const cardGap = 14;
    const cardWidth = (w - (m * 2) - cardGap) / 2;
    const leftX = m;
    const rightX = leftX + cardWidth + cardGap;
    const blockTop = h - m - 80;
    setStroke(0.85, 0.87, 0.90);
    line(m, blockTop, w - m, blockTop);
    setFill(0.995, 0.979, 0.988);
    rect(leftX, blockTop - 86, cardWidth, 62, "B");
    rect(rightX, blockTop - 86, cardWidth, 62, "B");
    setFill(0.76, 0.23, 0.45);
    text("F2", 12, leftX + 10, blockTop - 24, "Bill To");
    text("F2", 12, rightX + 10, blockTop - 24, "Invoice Details");

    setFill(0, 0, 0);
    text("F2", 11, leftX + 10, blockTop - 42, "Name:");
    text("F1", 11, leftX + 62, blockTop - 42, model.customerName || "-");
    text("F2", 11, leftX + 10, blockTop - 60, "Phone:");
    text("F1", 11, leftX + 66, blockTop - 60, model.customerPhone || "-");

    text("F2", 11, rightX + 10, blockTop - 42, "Order Number:");
    text("F1", 11, rightX + 98, blockTop - 42, model.orderNo || "-");
    text("F2", 11, rightX + 10, blockTop - 60, "Invoice Date:");
    text("F1", 11, rightX + 90, blockTop - 60, model.invoiceDate || "-");
    text("F2", 11, rightX + 10, blockTop - 78, "Est. Delivery Date:");
    text("F1", 11, rightX + 132, blockTop - 78, model.estDeliveryDate || "-");

    // Table header
    const tableTop = blockTop - 108;
    const tableLeft = m;
    const tableRight = w - m;
    const colNoR = tableLeft + 44;
    const colServiceR = tableLeft + 286;
    const colQtyR = tableLeft + 344;
    const colPriceR = tableLeft + 428;
    const colTotalR = tableRight;
    const headerTop = tableTop + 12;
    const headerBottom = tableTop - 10;
    const rowGap = 6;

    const rowModels = page.rows.map(function (row, index) {
      const svc = String(row.serviceName || "Service");
      const parts = chunkLine(svc, 30).slice(0, 2);
      return {
        serial: page.startIndex + index,
        svc: svc,
        qty: String(Math.max(1, Math.round(Number(row.qty) || 1))),
        price: normalizeMoney(Math.max(0, Number(row.unitPrice) || 0)),
        total: normalizeMoney(Math.max(0, Number(row.amount) || 0)),
        lines: parts.length || 1,
        rowHeight: Math.max(22, (parts.length || 1) * (11 + 3) + rowGap)
      };
    });

    const bodyHeight = rowModels.reduce(function (sum, row) {
      return sum + row.rowHeight;
    }, 0);
    const tableBottom = headerBottom - bodyHeight;

    setFill(0.949, 0.905, 0.925);
    setStroke(0.85, 0.87, 0.90);
    rect(tableLeft, headerBottom, tableRight - tableLeft, headerTop - headerBottom, "B");
    rect(tableLeft, tableBottom, tableRight - tableLeft, headerTop - tableBottom, "S");

    [colNoR, colServiceR, colQtyR, colPriceR].forEach(function (x) {
      line(x, tableBottom, x, headerTop);
    });

    setFill(0.20, 0.22, 0.26);
    textCenter("F2", 10, tableLeft, colNoR, tableTop - 1, "S.NO");
    text("F2", 10, colNoR + 10, tableTop - 1, "SERVICE");
    textCenter("F2", 10, colServiceR, colQtyR, tableTop - 1, "QTY");
    textCenter("F2", 8, colQtyR, colPriceR, tableTop - 1, "UNIT PRICE");
    textCenter("F2", 8, colPriceR, colTotalR, tableTop - 1, "TOTAL PRICE");

    // Table rows
    let rowTop = headerBottom;
    setFill(0, 0, 0);
    rowModels.forEach(function (row) {
      const baseline = rowTop - 16;
      textCenter("F1", 10, tableLeft, colNoR, baseline, String(row.serial));
      wrapText("F1", 11, colNoR + 10, baseline, 28, row.svc);
      textCenter("F1", 11, colServiceR, colQtyR, baseline, row.qty);
      textRight("F1", 11, colPriceR - 10, baseline, row.price);
      textRight("F1", 11, colTotalR - 10, baseline, row.total);

      rowTop -= row.rowHeight;
      line(tableLeft, rowTop, tableRight, rowTop);
    });

    // Summary (only on last page)
    if (page.pageNo === page.totalPages) {
      const summaryRowHeight = 22;
      const summaryTop = tableBottom;
      const summaryBottom = summaryTop - (summaryRowHeight * 3);
      const summaryLeft = colQtyR;
      const summaryMid = colPriceR;

      [summaryLeft, summaryMid, colTotalR].forEach(function (x) {
        line(x, summaryBottom, x, summaryTop);
      });
      line(summaryLeft, summaryBottom, colTotalR, summaryBottom);

      setFill(0.20, 0.22, 0.26);
      text("F1", 11, summaryLeft + 12, summaryTop - 15, "Total Amount");
      textRight("F2", 11, colTotalR - 10, summaryTop - 15, normalizeMoney(model.total));

      line(summaryLeft, summaryTop - summaryRowHeight, colTotalR, summaryTop - summaryRowHeight);

      text("F1", 11, summaryLeft + 12, summaryTop - 37, "Paid Amount");
      textRight("F2", 11, colTotalR - 10, summaryTop - 37, normalizeMoney(model.paid));

      line(summaryLeft, summaryTop - (summaryRowHeight * 2), colTotalR, summaryTop - (summaryRowHeight * 2));

      text("F2", 11, summaryLeft + 12, summaryTop - 59, "Grand Total");
      textRight("F2", 12, colTotalR - 10, summaryTop - 59, normalizeMoney(model.balance));
    }

    // Footer
    const footerText = "Generated On " + (model.generatedOn || "") + " | Thanks for choosing " + (model.shopName || "");
    setFill(0.35, 0.40, 0.47);
    text("F1", 10, m, m - 10 + 20, footerText);
    textRight("F1", 10, w - m, m - 10 + 20, "Page " + page.pageNo + "/" + page.totalPages);

    return cmds.join("\n");
  }

  function generateInvoicePdfBytes(order, config) {
    const cfg = config || {};
    const shop = cfg.shop || {};
    const currency = cfg.currencySymbol || "₹";

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
