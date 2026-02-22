(function () {
  const dashboard = document.getElementById("dashboardSummary");
  if (!dashboard) {
    return;
  }

  const summary = TailorStorage.getSummary();

  document.getElementById("sumCustomers").textContent = summary.totalCustomers;
  document.getElementById("sumOrders").textContent = summary.totalOrders;
  document.getElementById("sumPending").textContent = summary.pending;
  document.getElementById("sumBalance").textContent = "Rs " + summary.totalBalance.toFixed(0);
})();
