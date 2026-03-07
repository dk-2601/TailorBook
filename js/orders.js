(function () {
  const refs = {
    form: document.getElementById("orderForm"),
    customerSelect: document.getElementById("orderCustomer"),
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
    return;
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    loadData();
    initServiceState();
    renderCustomers();
    renderServiceTable();
    bindEvents();
    recalcOrderTotal();
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
    refs.customerSelect.innerHTML = "<option value=''>Select customer</option>";

    customers.forEach(function (customer) {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = customer.name;
      refs.customerSelect.appendChild(option);
    });

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
    refs.customerSelect.addEventListener("change", function () {
      const customer = customers.find(function (c) {
        return c.id === refs.customerSelect.value;
      });
      refs.customerPhone.value = customer ? customer.phone : "";
    });

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
    const customer = customers.find(function (c) {
      return c.id === refs.customerSelect.value;
    });

    if (!customer) {
      showMessage("Select a customer.", true);
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
    refs.customerPhone.value = "";
    serviceQuery = "";
    if (refs.serviceSearch) {
      refs.serviceSearch.value = "";
    }
    initServiceState();
    renderServiceTable();
    recalcOrderTotal();
  }

  function showMessage(text, isError) {
    refs.message.textContent = text;
    refs.message.className = isError ? "message error" : "message success";
  }
})();
