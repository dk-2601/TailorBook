(function () {
  const reportRoot = document.getElementById("reportSummary");
  if (!reportRoot) {
    return;
  }

  const summary = TailorStorage.getSummary();

  const items = [
    ["Total Customers", summary.totalCustomers],
    ["Total Orders", summary.totalOrders],
    ["Pending", summary.pending],
    ["Stitching", summary.stitching],
    ["Ready", summary.ready],
    ["Delivered", summary.delivered],
    ["Total Advance", "Rs " + summary.totalAdvance.toFixed(0)],
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
})();
