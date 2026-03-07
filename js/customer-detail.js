(function () {
  const root = document.getElementById("customerDetailRoot");
  const customerId = new URLSearchParams(window.location.search).get("id");
  let editMode = false;
  let showOrderForm = false;
  let orderServiceQuery = "";
  let orderServiceState = {};

  const statusOptions = ["Pending", "Stitching", "Ready", "Delivered"];

  if (!customerId) {
    root.innerHTML = "<p class='empty'>Invalid customer.</p>";
    return;
  }

  function resolvePaid(order) {
    const paidRaw = Number(order.paidAmount);
    if (Number.isFinite(paidRaw) && paidRaw >= 0) {
      return paidRaw;
    }
    return Number(order.advanceAmount) || 0;
  }

  function getActiveServices() {
    return TailorStorage.getActiveServices ? TailorStorage.getActiveServices() : [];
  }

  function render() {
    root.innerHTML = "";

    const customer = TailorStorage.getCustomerById(customerId);
    if (!customer) {
      root.innerHTML = "<p class='empty'>Customer not found.</p>";
      return;
    }

    const orders = TailorStorage.getOrdersByCustomerId(customerId);
    const totals = orders.reduce(
      function (acc, order) {
        const total = Number(order.totalAmount) || 0;
        const paid = resolvePaid(order);
        acc.totalOrders += 1;
        acc.totalPaid += paid;
        acc.balance += Math.max(total - paid, 0);
        return acc;
      },
      { totalOrders: 0, totalPaid: 0, balance: 0 }
    );

    const panel = document.createElement("div");
    panel.className = "highlight-panel";
    panel.innerHTML =
      "<div class='highlight-card'><p class='label'>Total Orders</p><p class='value'>" + totals.totalOrders + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Total Paid</p><p class='value'>Rs " + totals.totalPaid.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Balance</p><p class='value'>Rs " + totals.balance.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Phone</p><p class='value'>" + (customer.phone || "-") + "</p></div>";
    root.appendChild(panel);

    const shell = document.createElement("div");
    shell.className = "record-shell";

    const head = document.createElement("div");
    head.className = "record-head";
    head.innerHTML =
      "<h2>Customer Record</h2>" +
      "<div class='record-actions'>" +
      "<button type='button' id='custEditBtn' class='mini-btn'>" + (editMode ? "Cancel Edit" : "Edit") + "</button>" +
      "<button type='button' id='custToggleBtn' class='mini-btn " + (customer.isActive ? "warn-btn" : "ok-btn") + "'>" +
      (customer.isActive ? "Deactivate" : "Activate") +
      "</button>" +
      "</div>";
    shell.appendChild(head);

    const form = document.createElement("form");
    form.id = "customerEditForm";
    form.className = "field-form";

    form.appendChild(field("Customer No", "customerNo", customer.customerNo, false, "text"));
    form.appendChild(field("Name", "name", customer.name || "", editMode, "text"));
    form.appendChild(field("Phone", "phone", customer.phone || "", editMode, "text"));
    form.appendChild(field("Notes", "notes", customer.notes || "", editMode, "textarea"));
    form.appendChild(field("Status", "status", customer.isActive ? "Active" : "Inactive", false, "text"));

    shell.appendChild(form);

    if (editMode) {
      const saveBar = document.createElement("div");
      saveBar.className = "save-bar";
      saveBar.innerHTML =
        "<button type='button' id='custSaveBtn' class='ok-btn'>Save</button>" +
        "<button type='button' id='custCancelBtn' class='mini-btn'>Cancel</button>";
      shell.appendChild(saveBar);
    }

    root.appendChild(shell);

    const historyWrap = document.createElement("div");
    historyWrap.className = "record-shell";

    const historyHead = document.createElement("div");
    historyHead.className = "record-head";
    historyHead.innerHTML =
      "<h2>Order History</h2>" +
      "<div class='record-actions'><button type='button' id='addOrderFromCustomerBtn' class='mini-btn ok-btn'>" +
      (showOrderForm ? "Close" : "Add Order") +
      "</button></div>";
    historyWrap.appendChild(historyHead);

    if (showOrderForm) {
      historyWrap.appendChild(renderCustomerOrderForm(customer));
    }

    if (orders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No orders for this customer.";
      historyWrap.appendChild(empty);
    } else {
      const historyList = document.createElement("div");
      historyList.className = "list-box";

      orders
        .slice()
        .reverse()
        .forEach(function (order) {
          const paid = resolvePaid(order);
          const balance = Math.max((Number(order.totalAmount) || 0) - paid, 0);

          const card = document.createElement("button");
          card.type = "button";
          card.className = "history-card";
          card.setAttribute("data-order-id", order.id);
          card.innerHTML =
            "<strong>" + escapeHtml(order.orderNo) + "</strong>" +
            "<p>Status: " + escapeHtml(order.status || "Pending") + "</p>" +
            "<p>Balance: Rs " + balance.toFixed(0) + "</p>";
          historyList.appendChild(card);
        });

      historyWrap.appendChild(historyList);
    }

    root.appendChild(historyWrap);

    document.getElementById("custEditBtn").addEventListener("click", function () {
      editMode = !editMode;
      render();
    });

    document.getElementById("custToggleBtn").addEventListener("click", function () {
      TailorStorage.setCustomerActive(customer.id, !customer.isActive);
      render();
    });

    document.getElementById("addOrderFromCustomerBtn").addEventListener("click", function () {
      showOrderForm = !showOrderForm;
      if (!showOrderForm) {
        orderServiceQuery = "";
        orderServiceState = {};
      }
      render();
    });

    historyWrap.querySelectorAll(".history-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-order-id");
        window.location.href = "order-detail.html?id=" + encodeURIComponent(id);
      });
    });

    if (showOrderForm) {
      wireCustomerOrderForm(customer);
    }

    if (editMode) {
      document.getElementById("custCancelBtn").addEventListener("click", function () {
        editMode = false;
        render();
      });

      function saveCustomerChanges() {
        const nameInput = form.querySelector('[name="name"]');
        const phoneInput = form.querySelector('[name="phone"]');
        const notesInput = form.querySelector('[name="notes"]');

        const name = nameInput ? nameInput.value.trim() : "";
        const phone = phoneInput ? phoneInput.value.trim() : "";
        const notes = notesInput ? notesInput.value.trim() : "";

        if (!name || !phone) {
          return;
        }

        TailorStorage.updateCustomer(customer.id, {
          name: name,
          phone: phone,
          notes: notes
        });

        editMode = false;
        render();
      }

      const saveBtn = document.getElementById("custSaveBtn");
      if (saveBtn) {
        saveBtn.addEventListener("click", saveCustomerChanges);
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        saveCustomerChanges();
      });
    }
  }

  function initCustomerOrderServiceState() {
    if (Object.keys(orderServiceState).length > 0) {
      return;
    }

    const services = getActiveServices();
    orderServiceState = {};
    services.forEach(function (service) {
      orderServiceState[service.id] = {
        checked: false,
        price: Math.max(0, Number(service.defaultPrice) || 0),
        qty: 1
      };
    });
  }

  function getCustomerServiceState(service) {
    if (!orderServiceState[service.id]) {
      orderServiceState[service.id] = {
        checked: false,
        price: Math.max(0, Number(service.defaultPrice) || 0),
        qty: 1
      };
    }
    return orderServiceState[service.id];
  }

  function renderCustomerOrderForm(customer) {
    const wrap = document.createElement("div");

    wrap.innerHTML =
      "<form id='customerOrderForm' class='field-form'>" +
      "<div class='field-item'><label>Customer</label><input type='text' value='" + escapeHtml(customer.name || "") + "' readonly /></div>" +
      "<div class='field-item'><label>Phone</label><input type='text' value='" + escapeHtml(customer.phone || "") + "' readonly /></div>" +
      "<div class='field-item'><label for='custServiceSearch'>Search Services</label><input id='custServiceSearch' type='text' placeholder='Search service' value='" + escapeHtml(orderServiceQuery) + "' /></div>" +
      "<div class='table-wrap'>" +
      "<table class='service-table'>" +
      "<thead><tr><th>Select</th><th>Service</th><th>Price</th><th>Quantity</th><th>Total</th></tr></thead>" +
      "<tbody id='custServiceTableBody'></tbody>" +
      "</table>" +
      "</div>" +
      "<div class='field-item'><label for='custOrderTotal'>Total Amount</label><input id='custOrderTotal' type='number' min='0' readonly /></div>" +
      "<div class='field-item'><label for='custOrderPaid'>Paid Amount</label><input id='custOrderPaid' type='number' min='0' value='0' /></div>" +
      "<div class='field-item'><label for='custOrderMaterial'>Material Cost</label><input id='custOrderMaterial' type='number' min='0' value='0' /></div>" +
      "<div class='field-item'><label for='custOrderDue'>Due Date</label><input id='custOrderDue' type='date' /></div>" +
      "<div class='field-item'><label for='custOrderStatus'>Status</label><select id='custOrderStatus'>" +
      statusOptions
        .map(function (opt) {
          return "<option value='" + opt + "'" + (opt === "Pending" ? " selected" : "") + ">" + opt + "</option>";
        })
        .join("") +
      "</select></div>" +
      "<div class='field-item'><label for='custOrderNotes'>Notes</label><textarea id='custOrderNotes' rows='3'></textarea></div>" +
      "<div class='save-bar'>" +
      "<button type='submit' class='ok-btn'>Save Order</button>" +
      "<button type='button' id='custOrderCancelBtn' class='mini-btn'>Cancel</button>" +
      "</div>" +
      "<p id='custOrderMessage' class='message'></p>" +
      "</form>";

    return wrap;
  }

  function renderCustomerOrderServiceTable() {
    const body = document.getElementById("custServiceTableBody");
    if (!body) {
      return;
    }

    const services = getActiveServices();
    body.innerHTML = "";

    const filtered = services.filter(function (service) {
      if (!orderServiceQuery) {
        return true;
      }
      const text = (service.name + " " + String(service.defaultPrice || "")).toLowerCase();
      return text.includes(orderServiceQuery);
    });

    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = services.length ? "No matching services." : "No active services available. Add services first.";
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    filtered.forEach(function (service) {
      const state = getCustomerServiceState(service);
      const row = document.createElement("tr");
      row.setAttribute("data-service-id", service.id);

      row.innerHTML =
        "<td><input type='checkbox' class='svc-check cust-svc-check' " + (state.checked ? "checked" : "") + " /></td>" +
        "<td>" + escapeHtml(service.name) + "</td>" +
        "<td><input type='number' min='0' class='table-input cust-svc-price' value='" + Number(state.price || 0).toFixed(0) + "' " + (state.checked ? "" : "disabled") + " /></td>" +
        "<td><input type='number' min='1' class='table-input cust-svc-qty' value='" + Number(state.qty || 1) + "' " + (state.checked ? "" : "disabled") + " /></td>" +
        "<td><input type='number' class='table-input cust-svc-total' value='" + (state.checked ? Number(state.price || 0) * Number(state.qty || 1) : 0).toFixed(0) + "' readonly /></td>";

      body.appendChild(row);
    });
  }

  function syncCustomerServiceRowToState(row) {
    const serviceId = row.getAttribute("data-service-id") || "";
    if (!serviceId) {
      return;
    }

    const services = getActiveServices();
    const service = services.find(function (item) {
      return item.id === serviceId;
    });
    if (!service) {
      return;
    }

    const state = getCustomerServiceState(service);
    const check = row.querySelector(".cust-svc-check");
    const priceInput = row.querySelector(".cust-svc-price");
    const qtyInput = row.querySelector(".cust-svc-qty");

    state.checked = Boolean(check && check.checked);
    state.price = Math.max(0, Number(priceInput ? priceInput.value : 0) || 0);
    state.qty = Math.max(1, Math.round(Number(qtyInput ? qtyInput.value : 1) || 1));
  }

  function renderCustomerServiceRowFromState(row) {
    const serviceId = row.getAttribute("data-service-id") || "";
    const state = orderServiceState[serviceId];
    if (!state) {
      return;
    }

    const priceInput = row.querySelector(".cust-svc-price");
    const qtyInput = row.querySelector(".cust-svc-qty");
    const totalInput = row.querySelector(".cust-svc-total");

    if (!priceInput || !qtyInput || !totalInput) {
      return;
    }

    priceInput.disabled = !state.checked;
    qtyInput.disabled = !state.checked;
    priceInput.value = String(state.price);
    qtyInput.value = String(state.qty);
    totalInput.value = state.checked ? String(state.price * state.qty) : "0";
  }

  function recalcCustomerOrderTotal() {
    const totalInput = document.getElementById("custOrderTotal");
    if (!totalInput) {
      return;
    }

    const total = Object.keys(orderServiceState).reduce(function (sum, serviceId) {
      const row = orderServiceState[serviceId];
      if (!row || !row.checked) {
        return sum;
      }
      return sum + row.price * row.qty;
    }, 0);

    totalInput.value = String(total);
  }

  function collectCustomerOrderLineItems() {
    const services = getActiveServices();

    return services
      .filter(function (service) {
        return orderServiceState[service.id] && orderServiceState[service.id].checked;
      })
      .map(function (service) {
        const state = orderServiceState[service.id];
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

  function wireCustomerOrderForm(customer) {
    const orderForm = document.getElementById("customerOrderForm");
    const cancelBtn = document.getElementById("custOrderCancelBtn");
    const msg = document.getElementById("custOrderMessage");
    const searchInput = document.getElementById("custServiceSearch");
    const tableBody = document.getElementById("custServiceTableBody");

    initCustomerOrderServiceState();
    renderCustomerOrderServiceTable();
    recalcCustomerOrderTotal();

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        orderServiceQuery = searchInput.value.trim().toLowerCase();
        renderCustomerOrderServiceTable();
        recalcCustomerOrderTotal();
      });
    }

    if (tableBody) {
      tableBody.addEventListener("change", function (event) {
        const row = event.target.closest("tr");
        if (!row) {
          return;
        }

        syncCustomerServiceRowToState(row);
        renderCustomerServiceRowFromState(row);
        recalcCustomerOrderTotal();
      });

      tableBody.addEventListener("input", function (event) {
        const row = event.target.closest("tr");
        if (!row) {
          return;
        }

        syncCustomerServiceRowToState(row);
        renderCustomerServiceRowFromState(row);
        recalcCustomerOrderTotal();
      });
    }

    cancelBtn.addEventListener("click", function () {
      showOrderForm = false;
      orderServiceQuery = "";
      orderServiceState = {};
      render();
    });

    orderForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const lineItems = collectCustomerOrderLineItems();
      const paidAmount = document.getElementById("custOrderPaid").value;
      const materialCost = document.getElementById("custOrderMaterial").value;
      const dueDate = document.getElementById("custOrderDue").value;
      const status = document.getElementById("custOrderStatus").value;
      const notes = document.getElementById("custOrderNotes").value.trim();

      if (lineItems.length === 0) {
        msg.textContent = "Select at least one service.";
        msg.className = "message error";
        return;
      }

      TailorStorage.addOrder({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        lineItems: lineItems,
        paidAmount: paidAmount,
        materialCost: materialCost,
        dueDate: dueDate,
        status: status,
        notes: notes
      });

      showOrderForm = false;
      orderServiceQuery = "";
      orderServiceState = {};
      render();
    });
  }

  function field(label, name, value, editable, type) {
    const wrap = document.createElement("div");
    wrap.className = "field-item";

    const lab = document.createElement("label");
    lab.textContent = label;
    wrap.appendChild(lab);

    if (!editable) {
      const p = document.createElement("p");
      p.className = "field-static";
      p.textContent = value || "-";
      wrap.appendChild(p);
      return wrap;
    }

    if (type === "textarea") {
      const ta = document.createElement("textarea");
      ta.name = name;
      ta.value = value || "";
      ta.rows = 3;
      wrap.appendChild(ta);
      return wrap;
    }

    const input = document.createElement("input");
    input.type = type || "text";
    input.name = name;
    input.value = value || "";
    wrap.appendChild(input);

    return wrap;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    render();
  });
})();
