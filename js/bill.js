(function () {
  const billRoot = document.getElementById("billRoot");
  const printBtn = document.getElementById("printBillBtn");
  const shareBtn = document.getElementById("shareBillBtn");
  const backLink = document.getElementById("billBackLink");
  const orderId = new URLSearchParams(window.location.search).get("id");
  let loadedOrder = null;

  if (!orderId) {
    billRoot.innerHTML = "<p class='empty'>Invalid order.</p>";
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    const order = TailorStorage.getOrderById(orderId);
    if (!order) {
      billRoot.innerHTML = "<p class='empty'>Order not found.</p>";
      if (window.TailorSplash && window.TailorSplash.hide) {
        window.TailorSplash.hide();
      }
      return;
    }

    loadedOrder = order;

    const config = window.TailorBookConfig || {};
    const shop = config.shop || {};
    const appName = config.appName || "Invoice";
    const currency = config.currencySymbol || "₹";
    const shopName = shop.name || "SRI LADIES DESIGNER";
    const shopPhone = shop.phone || "-";
    const footerPrefix = shop.footerPrefix || "Thanks for choosing";
    const generatedOn = formatDate(new Date(), true);

    const paid = Number.isFinite(Number(order.paidAmount)) ? Number(order.paidAmount) : 0;
    const total = Number(order.totalAmount) || 0;
    const balance = Math.max(total - paid, 0);
    const lines = Array.isArray(order.lineItems) ? order.lineItems : [];

    billRoot.innerHTML =
      "<article class='bill-pro'>" +
      "<header class='bill-top'>" +
      "<div>" +
      "<p class='bill-appname'>" + escapeHtml(appName) + "</p>" +
      "<h1 class='bill-shop-name'>" + escapeHtml(shopName) + "</h1>" +
      renderShopAddress(shop.addressLines) +
      "<p class='bill-shop-line bill-shop-phone'>" + escapeHtml(shopPhone) + "</p>" +
      "</div>" +
      "</header>" +
      "<section class='bill-meta-grid'>" +
      "<div class='bill-meta-card'>" +
      "<p class='bill-card-title'>Bill To</p>" +
      "<p class='bill-meta-line'><strong>Name:</strong> " + escapeHtml(order.customerName || "-") + "</p>" +
      "<p class='bill-meta-line'><strong>Phone:</strong> " + escapeHtml(order.customerPhone || "-") + "</p>" +
      "</div>" +
      "<div class='bill-meta-card'>" +
      "<p class='bill-card-title'>Invoice Details</p>" +
      "<p class='bill-meta-line'><strong>Order Number:</strong> " + escapeHtml(order.orderNo || "-") + "</p>" +
      "<p class='bill-meta-line'><strong>Invoice Date:</strong> " + escapeHtml(formatDate(order.createdAt, true)) + "</p>" +
      "<p class='bill-meta-line'><strong>Est. Delivery Date:</strong> " + escapeHtml(formatDate(order.dueDate, false)) + "</p>" +
      "</div>" +
      "</section>" +
      renderLines(lines, currency, total, paid, balance) +
      "<footer class='bill-footer'>" +
      "<p>" + escapeHtml("Generated On " + generatedOn + " | " + footerPrefix + " " + shopName) + "</p>" +
      "</footer>" +
      "</article>";

    backLink.href = "order-detail.html?id=" + encodeURIComponent(order.id);

    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });

  printBtn.addEventListener("click", function () {
    window.print();
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      if (!loadedOrder) {
        return;
      }
      sharePdf(loadedOrder);
    });
  }

  function sharePdf(order) {
    const config = window.TailorBookConfig || {};
    const shop = config.shop || {};
    const shopName = shop.name || "SRI LADIES DESIGNER";
    const shopPhone = String(shop.phone || "").trim();
    const filename = "Invoice-" + String(order.orderNo || "order") + ".pdf";

    if (!window.TailorInvoicePdf || !window.TailorInvoicePdf.generateBytes) {
      return;
    }

    const bytes = window.TailorInvoicePdf.generateBytes(order, config);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const file = new File([blob], filename, { type: "application/pdf" });

    const paid = Number.isFinite(Number(order.paidAmount)) ? Number(order.paidAmount) : 0;
    const total = Number(order.totalAmount) || 0;
    const balance = Math.max(total - paid, 0);

    const name = String(order.customerName || "Customer").trim() || "Customer";
    const orderNo = String(order.orderNo || "").trim();
    const estDelivery = formatDateLong(order.dueDate);

    function formatMoneyMsg(value) {
      const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
      const formatted = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
      return "₹" + formatted;
    }

    const lines = [
      "Hi " + name + ",",
      "",
      "Please find your bill for Order #" + orderNo + ".",
      "",
      "Total: " + formatMoneyMsg(total),
      "Paid: " + formatMoneyMsg(paid),
      "Balance: " + formatMoneyMsg(balance),
      ""
    ];

    if (estDelivery && estDelivery !== "-") {
      lines.push("Estimated Delivery: " + estDelivery);
      lines.push("");
    }

    lines.push("Thank you for choosing");
    lines.push(shopName);
    if (shopPhone) {
      lines.push(shopPhone);
    }

    const text = lines.join("\n");

    // Web Share API with files (best on Android Chrome). User can select WhatsApp and send.
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        title: filename,
        text: text,
        files: [file]
      });
      return;
    }

    // Fallback: download the PDF so user can attach it manually in WhatsApp.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function renderLines(lines, currency, totalAmount, paidAmount, grandTotal) {
    if (!lines.length) {
      return "<p class='empty'>No services listed.</p>";
    }

    return (
      "<section class='bill-items-wrap'>" +
      "<table class='bill-items'>" +
      "<thead><tr><th>S.No</th><th>Service</th><th>Qty</th><th>Unit Price</th><th>Total Price</th></tr></thead>" +
      "<tbody>" +
      lines
        .map(function (line, index) {
          return (
            "<tr>" +
            "<td>" + (index + 1) + "</td>" +
            "<td>" + escapeHtml(line.serviceName || "Service") + "</td>" +
            "<td>" + Math.max(1, Math.round(Number(line.qty) || 1)) + "</td>" +
            "<td>" + formatMoney(Math.max(0, Number(line.unitPrice) || 0), currency) + "</td>" +
            "<td>" + formatMoney(Math.max(0, Number(line.amount) || 0), currency) + "</td>" +
            "</tr>"
          );
        })
        .join("") +
      renderTableSummaryRow("Total Amount", formatMoney(totalAmount, currency), "") +
      renderTableSummaryRow("Paid Amount", formatMoney(paidAmount, currency), "") +
      renderTableSummaryRow("Grand Total", formatMoney(grandTotal, currency), "bill-items-grand-row") +
      "</tbody>" +
      "</table>" +
      "</section>"
    );
  }

  function renderShopAddress(lines) {
    if (!Array.isArray(lines) || !lines.length) {
      return "";
    }
    return lines
      .filter(function (line) {
        return String(line || "").trim();
      })
      .map(function (line) {
        return "<p class='bill-shop-line'>" + escapeHtml(line) + "</p>";
      })
      .join("");
  }

  function formatDateLong(value) {
    if (!value) {
      return "-";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[date.getMonth()] || "";
    const year = date.getFullYear();
    return day + " " + mon + " " + year;
  }

  function formatDate(value, fallbackToday) {
    if (!value) {
      return fallbackToday ? formatDateToken(new Date()) : "-";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return fallbackToday ? formatDateToken(new Date()) : "-";
    }

    return formatDateToken(date);
  }

  function formatDateToken(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return day + "/" + month + "/" + year;
  }

  function formatMoney(value, currency) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    return currency + " " + formatted;
  }

  function renderTableSummaryRow(label, value, extraClass) {
    return (
      "<tr class='bill-items-summary-row " + (extraClass || "") + "'>" +
      "<td></td>" +
      "<td></td>" +
      "<td></td>" +
      "<td>" + escapeHtml(label) + "</td>" +
      "<td>" + escapeHtml(value) + "</td>" +
      "</tr>"
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
