(function () {
  const reportRoot = document.getElementById("reportSummary");
  if (!reportRoot) {
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
  }


  const currencySymbol = (window.TailorBookConfig && window.TailorBookConfig.currencySymbol) ? window.TailorBookConfig.currencySymbol : "₹";

  function formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    return currencySymbol + " " + formatted;
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    const summary = TailorStorage.getSummary();

    const items = [
      ["Total Customers", summary.totalCustomers],
      ["Total Orders", summary.totalOrders],
      ["Pending", summary.pending],
      ["Stitching", summary.stitching],
      ["Ready", summary.ready],
      ["Delivered", summary.delivered],
      ["Total Paid", formatMoney(summary.totalPaid)],
      ["Actual Revenue", formatMoney(summary.totalRevenue)],
      ["Budget (Material)", formatMoney(summary.totalMaterialCost)],
      ["Margin", formatMoney(summary.totalMargin)],
      ["Total Balance", formatMoney(summary.totalBalance)]
    ];

    reportRoot.innerHTML = items
      .map(function (entry) {
        return (
          "<div class='stat-card'>" +
          "<p class='label'>" + entry[0] + "</p>" +
          "<p class='value'>" + entry[1] + "</p>" +
          "</div>"
        );
      })
      .join("");

    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });
})();
