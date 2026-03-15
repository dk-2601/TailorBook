(function () {
  const reportRoot = document.getElementById("reportSummary");
  if (!reportRoot) {
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
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
      ["Total Paid", "Rs " + summary.totalPaid.toFixed(0)],
      ["Actual Revenue", "Rs " + summary.totalRevenue.toFixed(0)],
      ["Budget (Material)", "Rs " + summary.totalMaterialCost.toFixed(0)],
      ["Margin", "Rs " + summary.totalMargin.toFixed(0)],
      ["Total Balance", "Rs " + summary.totalBalance.toFixed(0)]
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
