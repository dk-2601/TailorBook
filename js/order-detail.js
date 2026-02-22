(function () {
  const root = document.getElementById("orderDetailRoot");
  const orderId = new URLSearchParams(window.location.search).get("id");

  const itemOptions = ["Shirt", "Pant", "Blouse", "Salwar", "Kurti", "Chudidhar", "Coat", "Uniform", "Alteration"];
  const statusOptions = ["Pending", "Stitching", "Ready", "Delivered"];

  if (!orderId) {
    root.innerHTML = "<p class='empty'>Invalid order.</p>";
    return;
  }

  function render() {
    root.innerHTML = "";

    const order = TailorStorage.getOrderById(orderId);
    if (!order) {
      root.innerHTML = "<p class='empty'>Order not found.</p>";
      return;
    }

    const balance = Math.max((Number(order.totalAmount) || 0) - (Number(order.advanceAmount) || 0), 0);

    const record = document.createElement("div");
    record.className = "record-card";

    const heading = document.createElement("h2");
    heading.textContent = "Order Record";
    record.appendChild(heading);

    record.appendChild(createReadOnlyRow("Order No", order.orderNo));
    record.appendChild(createReadOnlyRow("Customer", order.customerName));
    record.appendChild(createReadOnlyRow("Phone", order.customerPhone || "-"));

    record.appendChild(
      createEditableRow("Item", order.item, createSelectEditor(itemOptions, order.item), function (newValue) {
        return updateOrder(order, { item: newValue });
      })
    );
    record.appendChild(
      createEditableRow("Status", order.status, createSelectEditor(statusOptions, order.status), function (newValue) {
        return updateOrder(order, { status: newValue });
      })
    );
    record.appendChild(
      createEditableRow("Total", String(order.totalAmount), createInputEditor("number", String(order.totalAmount)), function (newValue) {
        return updateOrder(order, { totalAmount: newValue });
      }, function (value) {
        return "Rs " + (Number(value) || 0).toFixed(0);
      })
    );
    record.appendChild(
      createEditableRow("Advance", String(order.advanceAmount), createInputEditor("number", String(order.advanceAmount)), function (newValue) {
        return updateOrder(order, { advanceAmount: newValue });
      }, function (value) {
        return "Rs " + (Number(value) || 0).toFixed(0);
      })
    );
    record.appendChild(createReadOnlyRow("Balance", "Rs " + balance.toFixed(0)));
    record.appendChild(
      createEditableRow("Due Date", order.dueDate || "", createInputEditor("date", order.dueDate || ""), function (newValue) {
        return updateOrder(order, { dueDate: newValue });
      })
    );
    record.appendChild(
      createEditableRow("Notes", order.notes || "", createInputEditor("text", order.notes || ""), function (newValue) {
        return updateOrder(order, { notes: newValue });
      })
    );

    const actions = document.createElement("div");
    actions.className = "action-row";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger-btn";
    deleteBtn.textContent = "Delete Order";
    deleteBtn.addEventListener("click", function () {
      const ok = window.confirm("Delete this order?");
      if (!ok) {
        return;
      }
      TailorStorage.deleteOrder(order.id);
      window.location.href = "index.html";
    });

    actions.appendChild(deleteBtn);
    record.appendChild(actions);

    root.appendChild(record);
  }

  function updateOrder(order, patch) {
    TailorStorage.updateOrder(order.id, {
      item: patch.item !== undefined ? patch.item : order.item,
      totalAmount: patch.totalAmount !== undefined ? patch.totalAmount : order.totalAmount,
      advanceAmount: patch.advanceAmount !== undefined ? patch.advanceAmount : order.advanceAmount,
      dueDate: patch.dueDate !== undefined ? patch.dueDate : order.dueDate,
      status: patch.status !== undefined ? patch.status : order.status,
      notes: patch.notes !== undefined ? patch.notes : order.notes
    });
    render();
    return true;
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

  function createEditableRow(label, rawValue, editorNode, onSave, valueFormatter) {
    const displayValue = valueFormatter ? valueFormatter(rawValue) : rawValue || "-";
    const row = createReadOnlyRow(label, displayValue);

    const valueNode = row.querySelector(".field-value");
    const actions = row.querySelector(".field-actions");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "mini-btn";
    editBtn.textContent = "✎";

    const editor = document.createElement("div");
    editor.className = "inline-editor hidden";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "mini-btn ok-btn";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "mini-btn";
    cancelBtn.textContent = "Cancel";

    saveBtn.addEventListener("click", function () {
      const newValue = editorNode.value;
      const ok = onSave(newValue);
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
      editorNode.value = rawValue || "";
    });

    editBtn.addEventListener("click", function () {
      editBtn.classList.add("hidden");
      valueNode.classList.add("hidden");
      editor.classList.remove("hidden");
      editorNode.focus();
    });

    editor.appendChild(editorNode);
    editor.appendChild(saveBtn);
    editor.appendChild(cancelBtn);
    actions.appendChild(editBtn);
    actions.appendChild(editor);

    return row;
  }

  function createInputEditor(type, value) {
    const input = document.createElement("input");
    input.type = type;
    input.className = "inline-input";
    if (type === "number") {
      input.min = "0";
    }
    input.value = value || "";
    return input;
  }

  function createSelectEditor(options, value) {
    const select = document.createElement("select");
    select.className = "inline-input";
    options.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      option.selected = item === value;
      select.appendChild(option);
    });
    return select;
  }

  render();
})();
