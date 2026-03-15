(function () {
  const root = document.getElementById("orderDetailRoot");
  const orderId = new URLSearchParams(window.location.search).get("id");

  let editMode = false;
  let serviceQuery = "";
  let editServices = [];
  let editServiceState = {};

  const statusOptions = ["Pending", "Stitching", "Ready", "Delivered"];

  if (!orderId) {
    root.innerHTML = "<p class='empty'>Invalid order.</p>";
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
  }

  function resolvePaid(order) {
    const paidRaw = Number(order.paidAmount);
    if (Number.isFinite(paidRaw) && paidRaw >= 0) {
      return paidRaw;
    }
    return Number(order.advanceAmount) || 0;
  }

  function cloneLineItems(items) {
    return (Array.isArray(items) ? items : []).map(function (line) {
      return {
        serviceId: line.serviceId || "",
        serviceName: line.serviceName || "Service",
        qty: Number(line.qty) > 0 ? Number(line.qty) : 1,
        unitPrice: Number(line.unitPrice) >= 0 ? Number(line.unitPrice) : 0,
        amount: Number(line.amount) >= 0 ? Number(line.amount) : (Number(line.qty) || 1) * (Number(line.unitPrice) || 0)
      };
    });
  }

  function getLinesTotal(items) {
    return (items || []).reduce(function (sum, line) {
      return sum + (Number(line.amount) || 0);
    }, 0);
  }

  function getActiveServices() {
    return TailorStorage.getActiveServices ? TailorStorage.getActiveServices() : [];
  }

  function buildEditServiceModel(order) {
    const activeServices = getActiveServices();
    const existing = cloneLineItems(order.lineItems);

    const byId = {};
    const byName = {};
    activeServices.forEach(function (service) {
      byId[service.id] = service;
      byName[String(service.name || "").toLowerCase()] = service;
    });

    editServices = activeServices.map(function (service) {
      return {
        id: service.id,
        name: service.name,
        defaultPrice: Math.max(0, Number(service.defaultPrice) || 0)
      };
    });

    editServiceState = {};

    editServices.forEach(function (service) {
      editServiceState[service.id] = {
        checked: false,
        price: service.defaultPrice,
        qty: 1
      };
    });

    existing.forEach(function (line, idx) {
      const id = line.serviceId;
      const byIdMatch = id && byId[id] ? byId[id] : null;
      const byNameMatch = byName[String(line.serviceName || "").toLowerCase()] || null;

      let key = byIdMatch ? byIdMatch.id : (byNameMatch ? byNameMatch.id : "legacy_" + idx + "_" + Date.now());

      if (!editServiceState[key]) {
        editServices.push({
          id: key,
          name: line.serviceName || "Service",
          defaultPrice: Math.max(0, Number(line.unitPrice) || 0)
        });
        editServiceState[key] = {
          checked: false,
          price: Math.max(0, Number(line.unitPrice) || 0),
          qty: Math.max(1, Math.round(Number(line.qty) || 1))
        };
      }

      editServiceState[key].checked = true;
      editServiceState[key].price = Math.max(0, Number(line.unitPrice) || 0);
      editServiceState[key].qty = Math.max(1, Math.round(Number(line.qty) || 1));
    });
  }

  function getServiceById(serviceId) {
    return editServices.find(function (s) {
      return s.id === serviceId;
    }) || null;
  }

  function collectLineItemsFromState() {
    return editServices
      .filter(function (service) {
        return editServiceState[service.id] && editServiceState[service.id].checked;
      })
      .map(function (service) {
        const row = editServiceState[service.id];
        const price = Math.max(0, Number(row.price) || 0);
        const qty = Math.max(1, Math.round(Number(row.qty) || 1));
        return {
          serviceId: String(service.id || "").indexOf("legacy_") === 0 ? "" : service.id,
          serviceName: service.name,
          qty: qty,
          unitPrice: price,
          amount: qty * price
        };
      });
  }

  function renderServicesSection(lineItems) {
    const shell = document.createElement("div");
    shell.className = "record-shell";
    shell.innerHTML = "<h2>Order Services</h2>";

    if (editMode) {
      const search = document.createElement("input");
      search.type = "text";
      search.id = "editServiceSearch";
      search.placeholder = "Search services";
      search.value = serviceQuery;
      shell.appendChild(search);
    }

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "service-table";
    table.innerHTML =
      "<thead><tr><th>Select</th><th>Service</th><th>Price</th><th>Quantity</th><th>Total</th></tr></thead>";

    const body = document.createElement("tbody");

    if (!editMode) {
      if (!lineItems.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = "No services recorded for this order.";
        row.appendChild(cell);
        body.appendChild(row);
      } else {
        lineItems.forEach(function (line, index) {
          const row = document.createElement("tr");
          row.innerHTML =
            "<td><input type='checkbox' class='svc-check' checked disabled /></td>" +
            "<td>" + escapeHtml(line.serviceName || "Service") + "</td>" +
            "<td><input type='number' class='table-input' value='" + Number(line.unitPrice || 0).toFixed(0) + "' readonly /></td>" +
            "<td><input type='number' class='table-input' value='" + Number(line.qty || 1) + "' readonly /></td>" +
            "<td><input type='number' class='table-input' value='" + Number(line.amount || 0).toFixed(0) + "' readonly /></td>";
          row.setAttribute("data-index", String(index));
          body.appendChild(row);
        });
      }
    } else {
      const filtered = editServices.filter(function (service) {
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
        cell.textContent = "No matching services.";
        row.appendChild(cell);
        body.appendChild(row);
      } else {
        filtered.forEach(function (service) {
          const state = editServiceState[service.id] || {
            checked: false,
            price: Math.max(0, Number(service.defaultPrice) || 0),
            qty: 1
          };

          const total = state.checked ? state.price * state.qty : 0;

          const row = document.createElement("tr");
          row.setAttribute("data-service-id", service.id);
          row.innerHTML =
            "<td><input type='checkbox' class='svc-check svc-edit-check' " + (state.checked ? "checked" : "") + " /></td>" +
            "<td>" + escapeHtml(service.name) + "</td>" +
            "<td><input type='number' min='0' class='table-input svc-edit-price' value='" + Number(state.price || 0).toFixed(0) + "' " + (state.checked ? "" : "disabled") + " /></td>" +
            "<td><input type='number' min='1' class='table-input svc-edit-qty' value='" + Number(state.qty || 1) + "' " + (state.checked ? "" : "disabled") + " /></td>" +
            "<td><input type='number' class='table-input svc-edit-total' value='" + Number(total).toFixed(0) + "' readonly /></td>";
          body.appendChild(row);
        });
      }
    }

    table.appendChild(body);
    wrap.appendChild(table);
    shell.appendChild(wrap);

    return shell;
  }

  function render() {
    root.innerHTML = "";

    const order = TailorStorage.getOrderById(orderId);
    if (!order) {
      root.innerHTML = "<p class='empty'>Order not found.</p>";
      return;
    }

    if (editMode && Object.keys(editServiceState).length === 0) {
      buildEditServiceModel(order);
    }

    const lineItems = editMode ? collectLineItemsFromState() : cloneLineItems(order.lineItems);

    const total = getLinesTotal(lineItems);
    const materialCost = Number(order.materialCost) || 0;
    const paid = resolvePaid(order);
    const balance = Math.max(total - paid, 0);
    const margin = total - materialCost;
    const marginPct = total > 0 ? (margin / total) * 100 : 0;

    const panel = document.createElement("div");
    panel.className = "highlight-panel";
    panel.innerHTML =
      "<div class='highlight-card'><p class='label'>Total</p><p class='value'>Rs " + total.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Material Cost</p><p class='value'>Rs " + materialCost.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Paid Amount</p><p class='value'>Rs " + paid.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Balance</p><p class='value'>Rs " + balance.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Margin</p><p class='value'>Rs " + margin.toFixed(0) + "</p></div>" +
      "<div class='highlight-card'><p class='label'>Margin %</p><p class='value'>" + marginPct.toFixed(1) + "%</p></div>";
    root.appendChild(panel);

    const shell = document.createElement("div");
    shell.className = "record-shell";

    const head = document.createElement("div");
    head.className = "record-head";
    head.innerHTML =
      "<h2>Order Record</h2>" +
      "<div class='record-actions'>" +
      "<button type='button' id='viewBillBtn' class='mini-btn ok-btn icon-only' aria-label='View invoice' title='View invoice'>" +
      "<span class='btn-icon' aria-hidden='true'>" + iconSvg("invoice") + "</span>" +
      "</button>" +
      "<button type='button' id='orderEditBtn' class='mini-btn icon-only' aria-label='" + (editMode ? "Cancel edit" : "Edit order") + "' title='" + (editMode ? "Cancel edit" : "Edit") + "'>" +
      "<span class='btn-icon' aria-hidden='true'>" + iconSvg(editMode ? "close" : "edit") + "</span>" +
      "</button>" +
      "<button type='button' id='orderDeleteBtn' class='mini-btn danger-btn icon-only' aria-label='Delete order' title='Delete'>" +
      "<span class='btn-icon' aria-hidden='true'>" + iconSvg("trash") + "</span>" +
      "</button>" +
      "</div>";
    shell.appendChild(head);

    const form = document.createElement("form");
    form.id = "orderEditForm";
    form.className = "field-form field-grid-2";

    form.appendChild(field("Order No", "orderNo", order.orderNo, false, "text"));
    form.appendChild(field("Customer", "customerName", order.customerName || "", false, "text"));
    form.appendChild(field("Phone", "customerPhone", order.customerPhone || "", false, "text"));
    form.appendChild(field("Status", "status", order.status || "", editMode, "select", statusOptions));
    form.appendChild(field("Due Date", "dueDate", order.dueDate || "", editMode, "date"));
    form.appendChild(field("Paid Amount", "paidAmount", String(paid), editMode, "number"));
    form.appendChild(field("Material Cost", "materialCost", String(order.materialCost || 0), editMode, "number"));
    form.appendChild(field("Total", "totalAmount", String(total.toFixed(0)), false, "number"));
    form.appendChild(field("Notes", "notes", order.notes || "", editMode, "textarea", null, "full"));

    shell.appendChild(form);

    if (editMode) {
      const saveBar = document.createElement("div");
      saveBar.className = "save-bar";
      saveBar.innerHTML =
        "<button type='button' id='orderSaveBtn' class='ok-btn'>Save</button>" +
        "<button type='button' id='orderCancelBtn' class='mini-btn'>Cancel</button>";
      shell.appendChild(saveBar);
    }

    root.appendChild(shell);

    root.appendChild(renderServicesSection(lineItems));

    document.getElementById("viewBillBtn").addEventListener("click", function () {
      window.location.href = "bill.html?id=" + encodeURIComponent(order.id);
    });

    document.getElementById("orderEditBtn").addEventListener("click", function () {
      editMode = !editMode;
      if (editMode) {
        buildEditServiceModel(order);
      } else {
        serviceQuery = "";
        editServiceState = {};
        editServices = [];
      }
      render();
    });

    document.getElementById("orderDeleteBtn").addEventListener("click", function () {
      const ok = window.confirm("Delete this order?");
      if (!ok) {
        return;
      }

      const deleted = TailorStorage.deleteOrder(order.id);
      if (!deleted) {
        return;
      }

      const syncPromise = TailorStorage.syncCloudNow ? TailorStorage.syncCloudNow() : Promise.resolve(true);
      const timeoutPromise = new Promise(function (resolve) {
        setTimeout(resolve, 1200);
      });

      Promise.race([syncPromise, timeoutPromise]).finally(function () {
        window.location.href = "index.html";
      });
    });

    if (editMode) {
      const serviceSearch = document.getElementById("editServiceSearch");
      if (serviceSearch) {
        serviceSearch.addEventListener("input", function () {
          serviceQuery = serviceSearch.value.trim().toLowerCase();
          render();
        });
      }

      root.querySelectorAll(".service-table tbody tr[data-service-id]").forEach(function (row) {
        const serviceId = row.getAttribute("data-service-id");
        const check = row.querySelector(".svc-edit-check");
        const price = row.querySelector(".svc-edit-price");
        const qty = row.querySelector(".svc-edit-qty");

        function applyRowToState() {
          if (!editServiceState[serviceId]) {
            const service = getServiceById(serviceId);
            editServiceState[serviceId] = {
              checked: false,
              price: service ? Math.max(0, Number(service.defaultPrice || 0)) : 0,
              qty: 1
            };
          }

          editServiceState[serviceId].checked = Boolean(check.checked);
          editServiceState[serviceId].price = Math.max(0, Number(price.value) || 0);
          editServiceState[serviceId].qty = Math.max(1, Math.round(Number(qty.value) || 1));
        }

        check.addEventListener("change", function () {
          applyRowToState();
          render();
        });

        price.addEventListener("input", function () {
          applyRowToState();
          render();
        });

        qty.addEventListener("input", function () {
          applyRowToState();
          render();
        });
      });

      document.getElementById("orderCancelBtn").addEventListener("click", function () {
        editMode = false;
        serviceQuery = "";
        editServiceState = {};
        editServices = [];
        render();
      });

      function saveOrderChanges() {
        const statusEl = form.querySelector('[name="status"]');
        const paidEl = form.querySelector('[name="paidAmount"]');
        const materialEl = form.querySelector('[name="materialCost"]');
        const dueEl = form.querySelector('[name="dueDate"]');
        const notesEl = form.querySelector('[name="notes"]');

        const updatedLines = collectLineItemsFromState();
        if (!updatedLines.length) {
          return;
        }

        const updated = {
          status: statusEl ? statusEl.value : "Pending",
          paidAmount: paidEl ? paidEl.value : "0",
          materialCost: materialEl ? materialEl.value : "0",
          dueDate: dueEl ? dueEl.value : "",
          notes: notesEl ? notesEl.value.trim() : "",
          lineItems: updatedLines,
          item: updatedLines[0] ? updatedLines[0].serviceName : order.item
        };

        TailorStorage.updateOrder(order.id, updated);
        editMode = false;
        serviceQuery = "";
        editServiceState = {};
        editServices = [];
        render();
      }

      const saveBtn = document.getElementById("orderSaveBtn");
      if (saveBtn) {
        saveBtn.addEventListener("click", saveOrderChanges);
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        saveOrderChanges();
      });
    }
  }

  function field(label, name, value, editable, type, options, extraClass) {
    const wrap = document.createElement("div");
    wrap.className = "field-item" + (extraClass ? " " + extraClass : "");

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

    if (type === "select") {
      const sel = document.createElement("select");
      sel.name = name;
      (options || []).forEach(function (opt) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        o.selected = opt === value;
        sel.appendChild(o);
      });
      wrap.appendChild(sel);
      return wrap;
    }

    const input = document.createElement("input");
    input.type = type || "text";
    input.name = name;
    if (type === "number") {
      input.min = "0";
    }
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

  function iconSvg(name) {
    const icons = {
      invoice:
        "<svg viewBox='0 0 24 24' role='img'><path d='M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z'></path><path d='M9 8h6'></path><path d='M9 12h6'></path><path d='M9 16h4'></path></svg>",
      edit:
        "<svg viewBox='0 0 24 24' role='img'><path d='M12 20h9'></path><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z'></path></svg>",
      close:
        "<svg viewBox='0 0 24 24' role='img'><path d='M18 6 6 18'></path><path d='M6 6l12 12'></path></svg>",
      trash:
        "<svg viewBox='0 0 24 24' role='img'><path d='M3 6h18'></path><path d='M8 6V4h8v2'></path><path d='M6.5 6l1 15h9l1-15'></path><path d='M10 11v6'></path><path d='M14 11v6'></path></svg>"
    };
    return icons[name] || "";
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    render();
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });
})();
