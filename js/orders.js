(function () {
  const refs = {
    form: document.getElementById("orderForm"),
    customerSearch: document.getElementById("orderCustomerSearch"),
    customerId: document.getElementById("orderCustomerId"),
    customerSuggestions: document.getElementById("customerSuggestions"),
    customerPhone: document.getElementById("orderCustomerPhone"),
    serviceTableBody: document.getElementById("serviceTableBody"),
    serviceSearch: document.getElementById("serviceSearch"),
    orderTotal: document.getElementById("orderTotal"),
    orderPaid: document.getElementById("orderPaid"),
    orderMaterialCost: document.getElementById("orderMaterialCost"),
    orderDueDate: document.getElementById("orderDueDate"),
    orderStatus: document.getElementById("orderStatus"),
    orderNotes: document.getElementById("orderNotes"),
    message: document.getElementById("orderMessage")
  };

  let customers = [];
  let services = [];
  let serviceQuery = "";
  let serviceState = {};

  if (!refs.form) {
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    loadData();
    initServiceState();
    renderCustomers();
    renderServiceTable();
    bindEvents();
    recalcOrderTotal();
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });

  function loadData() {
    customers = TailorStorage.getCustomers().filter(function (c) {
      return c.isActive;
    });
    services = TailorStorage.getActiveServices ? TailorStorage.getActiveServices() : [];
  }

  function initServiceState() {
    serviceState = {};
    services.forEach(function (service) {
      serviceState[service.id] = {
        checked: false,
        price: Math.max(0, Number(service.defaultPrice) || 0),
        qty: 1
      };
    });
  }

  function renderCustomers() {
    if (refs.customerSearch) {
      refs.customerSearch.value = "";
    }
    if (refs.customerId) {
      refs.customerId.value = "";
    }
    refs.customerPhone.value = "";
  }

  function getServiceState(service) {
    const id = service.id;
    if (!serviceState[id]) {
      serviceState[id] = {
        checked: false,
        price: Math.max(0, Number(service.defaultPrice) || 0),
        qty: 1
      };
    }
    return serviceState[id];
  }

  function renderServiceTable() {
    refs.serviceTableBody.innerHTML = "";

    const filtered = services.filter(function (service) {
      if (!serviceQuery) {
        return true;
      }
      const text = (service.name + " " + String(service.defaultPrice || "")).toLowerCase();
      return text.includes(serviceQuery);
    });

    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = services.length
        ? "No matching services."
        : "No active services available. Add services first.";
      row.appendChild(cell);
      refs.serviceTableBody.appendChild(row);
      return;
    }

    filtered.forEach(function (service) {
      const state = getServiceState(service);
      const row = document.createElement("tr");
      row.setAttribute("data-service-id", service.id);
      row.setAttribute("data-service-name", service.name);

      const selectCell = document.createElement("td");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "svc-check";
      check.checked = state.checked;
      selectCell.appendChild(check);

      const nameCell = document.createElement("td");
      nameCell.textContent = service.name;

      const priceCell = document.createElement("td");
      const priceInput = document.createElement("input");
      priceInput.type = "number";
      priceInput.min = "0";
      priceInput.className = "svc-price table-input";
      priceInput.value = String(state.price);
      priceInput.disabled = !state.checked;
      priceCell.appendChild(priceInput);

      const qtyCell = document.createElement("td");
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.className = "svc-qty table-input";
      qtyInput.value = String(state.qty);
      qtyInput.disabled = !state.checked;
      qtyCell.appendChild(qtyInput);

      const totalCell = document.createElement("td");
      const totalInput = document.createElement("input");
      totalInput.type = "number";
      totalInput.className = "svc-total table-input";
      totalInput.readOnly = true;
      totalInput.value = state.checked ? String(state.price * state.qty) : "0";
      totalCell.appendChild(totalInput);

      row.appendChild(selectCell);
      row.appendChild(nameCell);
      row.appendChild(priceCell);
      row.appendChild(qtyCell);
      row.appendChild(totalCell);
      refs.serviceTableBody.appendChild(row);
    });
  }

  function bindEvents() {
    bindCustomerSearch();

    refs.serviceSearch.addEventListener("input", function () {
      serviceQuery = refs.serviceSearch.value.trim().toLowerCase();
      renderServiceTable();
      recalcOrderTotal();
    });

    refs.serviceTableBody.addEventListener("change", function (event) {
      const row = event.target.closest("tr");
      if (!row) {
        return;
      }

      syncRowToState(row);
      renderRowFromState(row);
      recalcOrderTotal();
    });

    refs.serviceTableBody.addEventListener("input", function (event) {
      const row = event.target.closest("tr");
      if (!row) {
        return;
      }

      syncRowToState(row);
      renderRowFromState(row);
      recalcOrderTotal();
    });

    refs.form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveOrder();
    });
  }

  function bindCustomerSearch() {
    if (!refs.customerSearch || !refs.customerId || !refs.customerSuggestions) {
      return;
    }

    let lastQuery = "";

    function clearSelection() {
      refs.customerId.value = "";
      refs.customerPhone.value = "";
    }

    function closeSuggestions() {
      refs.customerSuggestions.classList.add("hidden");
      refs.customerSuggestions.innerHTML = "";
    }

    function openSuggestions(list) {
      refs.customerSuggestions.innerHTML = "";

      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "suggestion-item suggestion-empty";
        empty.setAttribute("role", "option");
        empty.textContent = "No matching customers.";
        refs.customerSuggestions.appendChild(empty);
        refs.customerSuggestions.classList.remove("hidden");
        return;
      }

      list.forEach(function (customer) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggestion-item";
        btn.setAttribute("role", "option");
        btn.innerHTML =
          "<strong>" + escapeHtml(customer.name) + "</strong>" +
          "<p>" + escapeHtml(customer.phone || "") + "</p>";

        btn.addEventListener("click", function () {
          refs.customerSearch.value = customer.name;
          refs.customerId.value = customer.id;
          refs.customerPhone.value = customer.phone || "";
          closeSuggestions();
        });

        refs.customerSuggestions.appendChild(btn);
      });

      refs.customerSuggestions.classList.remove("hidden");
    }

    function getMatches(query) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) {
        return customers
          .slice()
          .sort(function (a, b) {
            return String(a.name || "").localeCompare(String(b.name || ""));
          })
          .slice(0, 8);
      }

      const starts = [];
      const contains = [];

      customers.forEach(function (c) {
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        const hay = (name + " " + phone).trim();

        if (!hay.includes(q)) {
          return;
        }

        if (name.indexOf(q) === 0) {
          starts.push(c);
        } else {
          contains.push(c);
        }
      });

      const sorted = starts.concat(contains).sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      return sorted.slice(0, 8);
    }

    function refreshSuggestions() {
      const q = refs.customerSearch.value;
      // If user edits after selecting, require re-select.
      // If user edits after selecting, require re-select.
      clearSelection();
      if (String(q) !== String(lastQuery)) {
        lastQuery = String(q);
      }
      openSuggestions(getMatches(q));
    }

    refs.customerSearch.addEventListener("input", refreshSuggestions);
    // Some mobile keyboards are flaky; keep a keyup fallback.
    refs.customerSearch.addEventListener("keyup", refreshSuggestions);

    refs.customerSearch.addEventListener("focus", function () {
      refreshSuggestions();
    });

    document.addEventListener("click", function (event) {
      if (!refs.customerSuggestions) {
        return;
      }
      const wrap = refs.customerSearch.closest(".input-wrap");
      if (wrap && !wrap.contains(event.target)) {
        closeSuggestions();
      }
    });
  }

  function syncRowToState(row) {
    const serviceId = row.getAttribute("data-service-id") || "";
    if (!serviceId || !serviceState[serviceId]) {
      return;
    }

    const check = row.querySelector(".svc-check");
    const priceInput = row.querySelector(".svc-price");
    const qtyInput = row.querySelector(".svc-qty");

    serviceState[serviceId].checked = Boolean(check && check.checked);
    serviceState[serviceId].price = Math.max(0, Number(priceInput ? priceInput.value : 0) || 0);
    serviceState[serviceId].qty = Math.max(1, Math.round(Number(qtyInput ? qtyInput.value : 1) || 1));
  }

  function renderRowFromState(row) {
    const serviceId = row.getAttribute("data-service-id") || "";
    const state = serviceState[serviceId];
    if (!state) {
      return;
    }

    const priceInput = row.querySelector(".svc-price");
    const qtyInput = row.querySelector(".svc-qty");
    const totalInput = row.querySelector(".svc-total");

    if (!priceInput || !qtyInput || !totalInput) {
      return;
    }

    priceInput.disabled = !state.checked;
    qtyInput.disabled = !state.checked;
    priceInput.value = String(state.price);
    qtyInput.value = String(state.qty);
    totalInput.value = state.checked ? String(state.price * state.qty) : "0";
  }

  function recalcOrderTotal() {
    const total = Object.keys(serviceState).reduce(function (sum, id) {
      const row = serviceState[id];
      if (!row || !row.checked) {
        return sum;
      }
      return sum + row.price * row.qty;
    }, 0);

    refs.orderTotal.value = String(total);
  }

  function collectLineItems() {
    return services
      .filter(function (service) {
        return serviceState[service.id] && serviceState[service.id].checked;
      })
      .map(function (service) {
        const state = serviceState[service.id];
        const price = Math.max(0, Number(state.price) || 0);
        const qty = Math.max(1, Math.round(Number(state.qty) || 1));

        return {
          serviceId: service.id,
          serviceName: service.name,
          qty: qty,
          unitPrice: price,
          amount: qty * price
        };
      });
  }

  function saveOrder() {
    const customerId = refs.customerId ? refs.customerId.value : "";
    const customer = customers.find(function (c) {
      return c.id === customerId;
    });

    if (!customer) {
      showMessage("Select a valid customer.", true);
      return;
    }

    const lineItems = collectLineItems();
    if (!lineItems.length) {
      showMessage("Select at least one service.", true);
      return;
    }

    TailorStorage.addOrder({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      lineItems: lineItems,
      paidAmount: refs.orderPaid.value,
      materialCost: refs.orderMaterialCost.value,
      dueDate: refs.orderDueDate.value,
      status: refs.orderStatus.value,
      notes: refs.orderNotes.value.trim()
    });

    showMessage("Order saved.");
    refs.form.reset();
    refs.orderStatus.value = "Pending";
    if (refs.customerSearch) {
      refs.customerSearch.value = "";
    }
    if (refs.customerId) {
      refs.customerId.value = "";
    }
    refs.customerPhone.value = "";
    serviceQuery = "";
    if (refs.serviceSearch) {
      refs.serviceSearch.value = "";
    }
    initServiceState();
    renderServiceTable();
    recalcOrderTotal();
  }



  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function showMessage(text, isError) {
    refs.message.textContent = text;
    refs.message.className = isError ? "message error" : "message success";
  }
})();
