(function () {
  const root = document.getElementById("customerDetailRoot");
  const customerId = new URLSearchParams(window.location.search).get("id");

  if (!customerId) {
    root.innerHTML = "<p class='empty'>Invalid customer.</p>";
    return;
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
        const advance = Number(order.advanceAmount) || 0;
        acc.totalOrders += 1;
        acc.totalPaid += advance;
        acc.balance += Math.max(total - advance, 0);
        return acc;
      },
      { totalOrders: 0, totalPaid: 0, balance: 0 }
    );

    const panel = document.createElement("div");
    panel.className = "highlight-panel";
    panel.innerHTML =
      "<div class='highlight-card'><p class='label'>Total Orders</p><p class='value'></p></div>" +
      "<div class='highlight-card'><p class='label'>Total Paid</p><p class='value'></p></div>" +
      "<div class='highlight-card'><p class='label'>Balance</p><p class='value'></p></div>" +
      "<div class='highlight-card'><p class='label'>Phone</p><p class='value'></p></div>";

    const panelValues = panel.querySelectorAll(".value");
    panelValues[0].textContent = totals.totalOrders;
    panelValues[1].textContent = "Rs " + totals.totalPaid.toFixed(0);
    panelValues[2].textContent = "Rs " + totals.balance.toFixed(0);
    panelValues[3].textContent = customer.phone;
    root.appendChild(panel);

    const record = document.createElement("div");
    record.className = "record-card";

    const heading = document.createElement("h2");
    heading.textContent = "Customer Record";
    record.appendChild(heading);

    record.appendChild(createReadOnlyRow("Customer No", customer.customerNo));
    record.appendChild(
      createEditableRow("Name", customer.name, "text", function (newValue) {
        if (!newValue.trim()) {
          return false;
        }
        TailorStorage.updateCustomer(customer.id, {
          name: newValue.trim(),
          phone: customer.phone,
          notes: customer.notes || ""
        });
        render();
        return true;
      })
    );
    record.appendChild(
      createEditableRow("Phone", customer.phone, "text", function (newValue) {
        if (!newValue.trim()) {
          return false;
        }
        TailorStorage.updateCustomer(customer.id, {
          name: customer.name,
          phone: newValue.trim(),
          notes: customer.notes || ""
        });
        render();
        return true;
      })
    );
    record.appendChild(
      createEditableRow("Notes", customer.notes || "", "text", function (newValue) {
        TailorStorage.updateCustomer(customer.id, {
          name: customer.name,
          phone: customer.phone,
          notes: newValue.trim()
        });
        render();
        return true;
      })
    );

    const statusRow = createReadOnlyRow("Status", customer.isActive ? "Active" : "Inactive");
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = customer.isActive ? "mini-btn warn-btn" : "mini-btn ok-btn";
    toggleBtn.textContent = customer.isActive ? "Set Inactive" : "Set Active";
    toggleBtn.addEventListener("click", function () {
      TailorStorage.setCustomerActive(customer.id, !customer.isActive);
      render();
    });
    statusRow.querySelector(".field-actions").appendChild(toggleBtn);
    record.appendChild(statusRow);

    root.appendChild(record);

    const historyHeading = document.createElement("h2");
    historyHeading.textContent = "Order History";
    root.appendChild(historyHeading);

    if (orders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No orders for this customer.";
      root.appendChild(empty);
      return;
    }

    orders
      .slice()
      .reverse()
      .forEach(function (order) {
        const balance = Math.max((Number(order.totalAmount) || 0) - (Number(order.advanceAmount) || 0), 0);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "history-card";

        const title = document.createElement("strong");
        title.textContent = order.orderNo + " - " + order.item;

        const status = document.createElement("p");
        status.textContent = "Status: " + order.status;

        const money = document.createElement("p");
        money.textContent = "Balance: Rs " + balance.toFixed(0);

        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(money);

        card.addEventListener("click", function () {
          window.location.href = "order-detail.html?id=" + encodeURIComponent(order.id);
        });

        root.appendChild(card);
      });
  }

  function createReadOnlyRow(label, value) {
    const row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML =
      "<div class='field-meta'><p class='field-label'></p><p class='field-value'></p></div>" +
      "<div class='field-actions'></div>";
    row.querySelector(".field-label").textContent = label;
    row.querySelector(".field-value").textContent = value || "-";
    return row;
  }

  function createEditableRow(label, value, inputType, onSave) {
    const row = createReadOnlyRow(label, value || "-");
    const valueNode = row.querySelector(".field-value");
    const actions = row.querySelector(".field-actions");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "mini-btn";
    editBtn.textContent = "✎";

    const editor = document.createElement("div");
    editor.className = "inline-editor hidden";

    const input = document.createElement("input");
    input.type = inputType;
    input.className = "inline-input";
    input.value = value || "";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "mini-btn ok-btn";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "mini-btn";
    cancelBtn.textContent = "Cancel";

    saveBtn.addEventListener("click", function () {
      const ok = onSave(input.value);
      if (ok) {
        editor.classList.add("hidden");
        valueNode.classList.remove("hidden");
        editBtn.classList.remove("hidden");
      }
    });

    cancelBtn.addEventListener("click", function () {
      editor.classList.add("hidden");
      valueNode.classList.remove("hidden");
      editBtn.classList.remove("hidden");
      input.value = value || "";
    });

    editBtn.addEventListener("click", function () {
      editBtn.classList.add("hidden");
      valueNode.classList.add("hidden");
      editor.classList.remove("hidden");
      input.focus();
    });

    editor.appendChild(input);
    editor.appendChild(saveBtn);
    editor.appendChild(cancelBtn);

    actions.appendChild(editBtn);
    actions.appendChild(editor);

    return row;
  }

  render();
})();
