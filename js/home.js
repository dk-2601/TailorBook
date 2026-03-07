(function () {
  const state = {
    customers: [],
    orders: [],
    activeTab: "overview",
    rangeType: "today",
    customFrom: "",
    customTo: ""
  };

  const refs = {
    tabButtons: document.querySelectorAll(".footer-tab"),
    tabPanels: document.querySelectorAll(".tab-panel"),
    customerSearch: document.getElementById("customerSearch"),
    customerList: document.getElementById("customerList"),
    statusFilter: document.getElementById("statusFilter"),
    ordersContainer: document.getElementById("ordersContainer"),
    fabCustomer: document.getElementById("fabCustomer"),
    fabOrder: document.getElementById("fabOrder"),
    fixedMetricsGrid: document.getElementById("fixedMetricsGrid"),
    globalInsights: document.getElementById("globalInsights"),
    rangeToolbar: document.getElementById("rangeToolbar"),
    rangeButtons: document.querySelectorAll(".range-chip"),
    customRangeWrap: document.getElementById("customRangeWrap"),
    rangeFrom: document.getElementById("rangeFrom"),
    rangeTo: document.getElementById("rangeTo"),
    applyCustomRangeBtn: document.getElementById("applyCustomRangeBtn"),
    rangeCaption: document.getElementById("rangeCaption"),
    rangeMetricsGrid: document.getElementById("rangeMetricsGrid")
  };

  init();

  function init() {
    Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
      loadData();
      setupTabs();
      setupCustomerSearch();
      setupOrderFilter();
      setupFabNavigation();
      setupAuthRefresh();
      setupRangeFilter();
      renderAll();
      updateFabVisibility();
    });
  }

  function setupAuthRefresh() {
    window.addEventListener("tailor-auth-changed", function () {
      Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
        loadData();
        renderAll();
      });
    });
  }

  function loadData() {
    state.customers = TailorStorage.getCustomers();
    state.orders = TailorStorage.getOrders();
  }

  function renderAll() {
    renderOverview();
    renderCustomerList();
    renderOrdersList();
  }

  function setupTabs() {
    refs.tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const target = button.getAttribute("data-tab");
        state.activeTab = target;

        refs.tabButtons.forEach(function (btn) {
          btn.classList.toggle("active", btn === button);
        });

        refs.tabPanels.forEach(function (panel) {
          panel.classList.toggle("active", panel.id === "tab-" + target);
        });

        updateFabVisibility();
      });
    });
  }

  function updateFabVisibility() {
    refs.fabCustomer.classList.toggle("hidden", state.activeTab !== "customers");
    refs.fabOrder.classList.toggle("hidden", state.activeTab !== "orders");
  }

  function setupFabNavigation() {
    refs.fabCustomer.addEventListener("click", function () {
      window.location.href = "add-customer.html";
    });

    refs.fabOrder.addEventListener("click", function () {
      window.location.href = "add-order.html";
    });
  }

  function setupRangeFilter() {
    if (!refs.rangeButtons || refs.rangeButtons.length === 0) {
      return;
    }

    refs.rangeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const next = button.getAttribute("data-range") || "today";
        state.rangeType = next;

        if (state.rangeType === "custom") {
          const todayText = formatInputDate(new Date());
          if (!state.customFrom) {
            state.customFrom = todayText;
          }
          if (!state.customTo) {
            state.customTo = todayText;
          }
        }

        syncRangeUi();
        renderOverview();
      });
    });

    if (refs.rangeFrom) {
      refs.rangeFrom.addEventListener("change", function () {
        state.customFrom = refs.rangeFrom.value || "";
      });
    }

    if (refs.rangeTo) {
      refs.rangeTo.addEventListener("change", function () {
        state.customTo = refs.rangeTo.value || "";
      });
    }

    if (refs.applyCustomRangeBtn) {
      refs.applyCustomRangeBtn.addEventListener("click", function () {
        if (!state.customFrom || !state.customTo) {
          return;
        }

        const from = parseDateValue(state.customFrom);
        const to = parseDateValue(state.customTo);
        if (!from || !to || from.getTime() > to.getTime()) {
          return;
        }

        renderOverview();
      });
    }

    syncRangeUi();
  }

  function syncRangeUi() {
    refs.rangeButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-range") === state.rangeType);
    });

    const customMode = state.rangeType === "custom";
    if (refs.customRangeWrap) {
      refs.customRangeWrap.classList.toggle("hidden", !customMode);
    }

    if (refs.rangeFrom) {
      refs.rangeFrom.value = state.customFrom;
    }

    if (refs.rangeTo) {
      refs.rangeTo.value = state.customTo;
    }
  }

  function renderOverview() {
    renderFixedMetrics();
    renderGlobalInsights();
    renderRangeMetrics();
  }

  function renderFixedMetrics() {
    const customers = state.customers;
    const orders = state.orders;

    const activeCustomers = customers.filter(function (customer) {
      return customer.isActive;
    }).length;

    const openOrders = orders.filter(function (order) {
      return order.status === "Pending" || order.status === "Stitching" || order.status === "Ready";
    }).length;

    const readyForDelivery = orders.filter(function (order) {
      return order.status === "Ready";
    }).length;

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const todayDue = orders.filter(function (order) {
      if (order.status === "Delivered") {
        return false;
      }
      const due = parseDateValue(order.dueDate);
      return !!due && due.getTime() >= todayStart.getTime() && due.getTime() <= todayEnd.getTime();
    }).length;

    const overdue = orders.filter(function (order) {
      if (order.status === "Delivered") {
        return false;
      }
      const due = parseDateValue(order.dueDate);
      return !!due && due.getTime() < todayStart.getTime();
    }).length;

    const outstanding = orders.reduce(function (sum, order) {
      const total = toAmount(order.totalAmount);
      const paid = getPaid(order);
      return sum + Math.max(total - paid, 0);
    }, 0);

    const cards = [
      { label: "Customers", value: activeCustomers + " / " + customers.length },
      { label: "Open Orders", value: String(openOrders) },
      { label: "Today Due", value: String(todayDue) },
      { label: "Overdue", value: String(overdue) },
      { label: "Outstanding Balance", value: formatMoney(outstanding) },
      { label: "Ready for Delivery", value: String(readyForDelivery) }
    ];

    renderMetricCards(refs.fixedMetricsGrid, cards);
  }

  function renderGlobalInsights() {
    if (!refs.globalInsights) {
      return;
    }

    const grouped = {};
    const customerById = state.customers.reduce(function (acc, customer) {
      acc[customer.id] = customer;
      return acc;
    }, {});

    state.orders.forEach(function (order) {
      const key = order.customerId || "name:" + String(order.customerName || "").toLowerCase();
      if (!grouped[key]) {
        const known = order.customerId ? customerById[order.customerId] : null;
        grouped[key] = {
          name: (known && known.name) || order.customerName || "Unknown Customer",
          orders: 0,
          amount: 0
        };
      }
      grouped[key].orders += 1;
      grouped[key].amount += toAmount(order.totalAmount);
    });

    const rows = Object.keys(grouped).map(function (key) {
      return grouped[key];
    });

    const topRepeat = rows
      .slice()
      .sort(function (a, b) {
        if (b.orders !== a.orders) {
          return b.orders - a.orders;
        }
        return b.amount - a.amount;
      })[0] || null;

    const topValue = rows
      .slice()
      .sort(function (a, b) {
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        return b.orders - a.orders;
      })[0] || null;

    const cards = [
      {
        title: "Top Repeat Customer",
        name: topRepeat ? topRepeat.name : "-",
        meta: topRepeat ? topRepeat.orders + " orders" : "No orders yet"
      },
      {
        title: "Top Value Customer",
        name: topValue ? topValue.name : "-",
        meta: topValue ? formatMoney(topValue.amount) : "No orders yet"
      }
    ];

    refs.globalInsights.innerHTML = cards
      .map(function (card) {
        return (
          "<div class='insight-card'>" +
          "<p class='insight-label'>" + escapeHtml(card.title) + "</p>" +
          "<p class='insight-name'>" + escapeHtml(card.name) + "</p>" +
          "<p class='insight-meta'>" + escapeHtml(card.meta) + "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderRangeMetrics() {
    const bounds = getRangeBounds();
    const filtered = state.orders.filter(function (order) {
      if (!bounds) {
        return false;
      }
      const created = parseDateValue(order.createdAt);
      if (!created) {
        return false;
      }
      return created.getTime() >= bounds.from.getTime() && created.getTime() <= bounds.to.getTime();
    });

    const revenue = filtered.reduce(function (sum, order) {
      return sum + toAmount(order.totalAmount);
    }, 0);

    const paid = filtered.reduce(function (sum, order) {
      return sum + getPaid(order);
    }, 0);

    const cost = filtered.reduce(function (sum, order) {
      return sum + toAmount(order.materialCost);
    }, 0);

    const profit = revenue - cost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    const cards = [
      { label: "Orders (In Range)", value: String(filtered.length) },
      { label: "Revenue (In Range)", value: formatMoney(revenue) },
      { label: "Paid (Orders in Range)", value: formatMoney(paid) },
      { label: "Profit (In Range)", value: formatMoney(profit) },
      { label: "Margin % (In Range)", value: formatPercent(marginPct) }
    ];

    renderMetricCards(refs.rangeMetricsGrid, cards);

    if (refs.rangeCaption) {
      if (!bounds) {
        refs.rangeCaption.textContent = "Select a valid custom date range.";
      } else {
        refs.rangeCaption.textContent =
          "Based on orders created from " + formatDate(bounds.from) + " to " + formatDate(bounds.to) + ".";
      }
    }
  }

  function renderMetricCards(container, cards) {
    if (!container) {
      return;
    }

    container.innerHTML = cards
      .map(function (card) {
        return (
          "<div class='stat-card'>" +
          "<p class='label'>" + escapeHtml(card.label) + "</p>" +
          "<p class='value'>" + escapeHtml(card.value) + "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function getRangeBounds() {
    const now = new Date();

    if (state.rangeType === "today") {
      return {
        from: startOfDay(now),
        to: endOfDay(now)
      };
    }

    if (state.rangeType === "week") {
      const from = startOfDay(now);
      const day = from.getDay();
      const offset = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - offset);
      return {
        from: from,
        to: endOfDay(addDays(from, 6))
      };
    }

    if (state.rangeType === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: from, to: to };
    }

    if (state.rangeType === "year") {
      const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: from, to: to };
    }

    if (state.rangeType === "custom") {
      const fromDate = parseDateValue(state.customFrom);
      const toDate = parseDateValue(state.customTo);
      if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) {
        return null;
      }

      return {
        from: startOfDay(fromDate),
        to: endOfDay(toDate)
      };
    }

    return null;
  }

  function setupCustomerSearch() {
    refs.customerSearch.addEventListener("input", function () {
      renderCustomerList();
    });
  }

  function renderCustomerList() {
    const query = refs.customerSearch.value.trim().toLowerCase();
    refs.customerList.innerHTML = "";

    const filtered = state.customers.filter(function (customer) {
      const text = [customer.name, customer.phone, customer.isActive ? "active" : "inactive"].join(" ").toLowerCase();
      return !query || text.includes(query);
    });

    if (filtered.length === 0) {
      refs.customerList.innerHTML = "<p class='empty'>No customers found.</p>";
      return;
    }

    filtered.forEach(function (customer) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "customer-item";

      const title = document.createElement("strong");
      title.textContent = customer.name;

      const status = document.createElement("p");
      status.className = customer.isActive ? "tag ok" : "tag warn";
      status.textContent = customer.isActive ? "Active" : "Inactive";

      card.appendChild(title);
      card.appendChild(status);

      card.addEventListener("click", function () {
        window.location.href = "customer-detail.html?id=" + encodeURIComponent(customer.id);
      });

      refs.customerList.appendChild(card);
    });
  }

  function setupOrderFilter() {
    refs.statusFilter.addEventListener("change", function () {
      renderOrdersList();
    });
  }

  function renderOrdersList() {
    const selectedStatus = refs.statusFilter.value;
    refs.ordersContainer.innerHTML = "";

    const filtered = state.orders.filter(function (order) {
      return selectedStatus === "All" || order.status === selectedStatus;
    });

    if (filtered.length === 0) {
      refs.ordersContainer.innerHTML = "<p class='empty'>No orders found.</p>";
      return;
    }

    filtered
      .slice()
      .reverse()
      .forEach(function (order) {
        const paid = getPaid(order);
        const balance = Math.max(toAmount(order.totalAmount) - paid, 0);
        const servicesCount = Array.isArray(order.lineItems) ? order.lineItems.length : 0;

        const card = document.createElement("button");
        card.type = "button";
        card.className = "order-card";

        const title = document.createElement("h3");
        title.textContent = order.orderNo + " - " + order.customerName;

        const item = document.createElement("p");
        item.textContent = "Services: " + servicesCount;

        const status = document.createElement("p");
        status.textContent = "Status: " + order.status;

        const balanceText = document.createElement("p");
        balanceText.textContent = "Balance: " + formatMoney(balance);

        card.appendChild(title);
        card.appendChild(item);
        card.appendChild(status);
        card.appendChild(balanceText);

        card.addEventListener("click", function () {
          window.location.href = "order-detail.html?id=" + encodeURIComponent(order.id);
        });

        refs.ordersContainer.appendChild(card);
      });
  }

  function getPaid(order) {
    const raw = Number(order.paidAmount);
    if (Number.isFinite(raw) && raw >= 0) {
      return raw;
    }
    return Math.max(0, Number(order.advanceAmount) || 0);
  }

  function toAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDateValue(value) {
    if (!value) {
      return null;
    }

    const text = String(value);
    const plain = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) {
      return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]), 0, 0, 0, 0);
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function formatDate(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return d + "/" + m + "/" + y;
  }

  function formatInputDate(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return y + "-" + m + "-" + d;
  }

  function formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return (
      "Rs " +
      new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    );
  }

  function formatPercent(value) {
    const n = Number.isFinite(Number(value)) ? Number(value) : 0;
    return n.toFixed(1) + "%";
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
