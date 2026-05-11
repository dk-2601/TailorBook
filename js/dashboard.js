(function () {
  const dashboard = document.getElementById("dashboardSummary");
  if (!dashboard) {
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

    document.getElementById("sumCustomers").textContent = summary.totalCustomers;
    document.getElementById("sumOrders").textContent = summary.totalOrders;
    document.getElementById("sumPending").textContent = summary.pending;
    document.getElementById("sumBalance").textContent = formatMoney(summary.totalBalance);

    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });
})();
