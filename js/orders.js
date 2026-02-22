(function () {
  const orderForm = document.getElementById("orderForm");
  const ordersContainer = document.getElementById("ordersContainer");

  if (orderForm) {
    setupOrderForm(orderForm);
  }

  if (ordersContainer) {
    setupOrdersList(ordersContainer);
  }

  function setupOrderForm(form) {
    const customerSelect = document.getElementById("orderCustomer");
    const customers = TailorStorage.getCustomers();

    if (customers.length === 0) {
      customerSelect.innerHTML = "<option value=''>No customers yet</option>";
    } else {
      customerSelect.innerHTML = "<option value=''>Select customer</option>";
      customers.forEach(function (customer) {
        const option = document.createElement("option");
        option.value = customer.id;
        option.textContent = customer.name + " (" + customer.phone + ")";
        customerSelect.appendChild(option);
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const customerId = customerSelect.value;
      const selectedOption = customerSelect.options[customerSelect.selectedIndex];
      const customerName = selectedOption ? selectedOption.textContent.split(" (")[0] : "";

      const item = document.getElementById("orderItem").value.trim();
      const totalAmount = document.getElementById("orderTotal").value;
      const advanceAmount = document.getElementById("orderAdvance").value;
      const dueDate = document.getElementById("orderDueDate").value;
      const status = document.getElementById("orderStatus").value;
      const notes = document.getElementById("orderNotes").value.trim();

      if (!customerId || !item || !totalAmount) {
        showOrderMessage("Customer, item and total are required.", true);
        return;
      }

      TailorStorage.addOrder({
        customerId: customerId,
        customerName: customerName,
        item: item,
        totalAmount: totalAmount,
        advanceAmount: advanceAmount,
        dueDate: dueDate,
        status: status,
        notes: notes
      });

      form.reset();
      document.getElementById("orderStatus").value = "Pending";
      showOrderMessage("Order saved.");
    });
  }

  function setupOrdersList(container) {
    const filter = document.getElementById("statusFilter");

    function renderOrders() {
      const orders = TailorStorage.getOrders();
      const selectedStatus = filter.value;

      const filteredOrders = orders.filter(function (order) {
        if (selectedStatus === "All") {
          return true;
        }
        return order.status === selectedStatus;
      });

      if (filteredOrders.length === 0) {
        container.innerHTML = "<p class='empty'>No orders found.</p>";
        return;
      }

      container.innerHTML = filteredOrders
        .map(function (order) {
          const balance = Math.max((Number(order.totalAmount) || 0) - (Number(order.advanceAmount) || 0), 0);
          return (
            "<div class='card order-card'>" +
            "<h3>" + order.customerName + " - " + order.item + "</h3>" +
            "<p>Total: Rs " + Number(order.totalAmount).toFixed(0) + "</p>" +
            "<p>Advance: Rs " + Number(order.advanceAmount).toFixed(0) + "</p>" +
            "<p>Balance: Rs " + balance.toFixed(0) + "</p>" +
            "<p>Due: " + (order.dueDate || "-") + "</p>" +
            "<label>Status</label>" +
            "<select data-order-id='" + order.id + "' class='order-status-select'>" +
            renderStatusOptions(order.status) +
            "</select>" +
            "</div>"
          );
        })
        .join("");

      container.querySelectorAll(".order-status-select").forEach(function (select) {
        select.addEventListener("change", function () {
          const orderId = select.getAttribute("data-order-id");
          TailorStorage.updateOrderStatus(orderId, select.value);
        });
      });
    }

    filter.addEventListener("change", renderOrders);
    renderOrders();
  }

  function renderStatusOptions(activeStatus) {
    const statuses = ["Pending", "Stitching", "Ready", "Delivered"];
    return statuses
      .map(function (status) {
        const selected = status === activeStatus ? "selected" : "";
        return "<option value='" + status + "' " + selected + ">" + status + "</option>";
      })
      .join("");
  }

  function showOrderMessage(text, isError) {
    const message = document.getElementById("orderMessage");
    if (!message) {
      return;
    }
    message.textContent = text;
    message.className = isError ? "message error" : "message success";
  }
})();
