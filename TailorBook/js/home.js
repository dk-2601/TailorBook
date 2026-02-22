(function () {
  const state = {
    customers: [],
    orders: [],
    selectedOrderCustomerId: "",
    activeTab: "overview"
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

    customerModal: document.getElementById("customerModal"),
    closeCustomerModal: document.getElementById("closeCustomerModal"),
    customerForm: document.getElementById("customerForm"),
    customerMessage: document.getElementById("customerMessage"),

    orderModal: document.getElementById("orderModal"),
    closeOrderModal: document.getElementById("closeOrderModal"),
    orderForm: document.getElementById("orderForm"),
    orderMessage: document.getElementById("orderMessage"),
    orderCustomerName: document.getElementById("orderCustomerName"),
    orderCustomerPhone: document.getElementById("orderCustomerPhone"),
    orderItem: document.getElementById("orderItem"),
    customerSuggestions: document.getElementById("customerSuggestions")
  };

  init();

  function init() {
    loadData();
    setupTabs();
    setupCustomerSearch();
    setupOrderFilter();
    setupCustomerModal();
    setupOrderModal();
    setupCustomerForm();
    setupOrderForm();
    renderAll();
    updateFabVisibility();
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

        closeModal(refs.customerModal);
        closeModal(refs.orderModal);
        updateFabVisibility();
      });
    });
  }

  function updateFabVisibility() {
    refs.fabCustomer.classList.toggle("hidden", state.activeTab !== "customers");
    refs.fabOrder.classList.toggle("hidden", state.activeTab !== "orders");
  }

  function renderOverview() {
    const summary = TailorStorage.getSummary();
    document.getElementById("sumCustomers").textContent = summary.activeCustomers + " / " + summary.totalCustomers;
    document.getElementById("sumOrders").textContent = summary.totalOrders;
    document.getElementById("sumPending").textContent = summary.pending;
    document.getElementById("sumBalance").textContent = "Rs " + summary.totalBalance.toFixed(0);
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
        const balance = Math.max((Number(order.totalAmount) || 0) - (Number(order.advanceAmount) || 0), 0);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "order-card";

        const title = document.createElement("h3");
        title.textContent = order.orderNo + " - " + order.customerName;

        const item = document.createElement("p");
        item.textContent = "Item: " + order.item;

        const status = document.createElement("p");
        status.textContent = "Status: " + order.status;

        const balanceText = document.createElement("p");
        balanceText.textContent = "Balance: Rs " + balance.toFixed(0);

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

  function setupCustomerModal() {
    refs.fabCustomer.addEventListener("click", function () {
      openModal(refs.customerModal);
    });

    refs.closeCustomerModal.addEventListener("click", function () {
      closeModal(refs.customerModal);
    });

    refs.customerModal.addEventListener("click", function (event) {
      if (event.target === refs.customerModal) {
        closeModal(refs.customerModal);
      }
    });
  }

  function setupOrderModal() {
    refs.fabOrder.addEventListener("click", function () {
      openModal(refs.orderModal);
    });

    refs.closeOrderModal.addEventListener("click", function () {
      closeModal(refs.orderModal);
    });

    refs.orderModal.addEventListener("click", function (event) {
      if (event.target === refs.orderModal) {
        closeModal(refs.orderModal);
      }
    });
  }

  function setupCustomerForm() {
    refs.customerForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const name = document.getElementById("customerName").value.trim();
      const phone = document.getElementById("customerPhone").value.trim();
      const notes = document.getElementById("customerNotes").value.trim();

      if (!name || !phone) {
        showMessage(refs.customerMessage, "Name and phone are required.", true);
        return;
      }

      TailorStorage.addCustomer({ name: name, phone: phone, notes: notes });
      refs.customerForm.reset();
      showMessage(refs.customerMessage, "Customer saved.");

      loadData();
      renderOverview();
      renderCustomerList();
      clearOrderCustomerSelection();

      window.setTimeout(function () {
        closeModal(refs.customerModal);
        refs.customerMessage.textContent = "";
      }, 350);
    });
  }

  function setupOrderForm() {
    refs.orderCustomerName.addEventListener("input", function () {
      state.selectedOrderCustomerId = "";
      refs.orderCustomerPhone.value = "";
      renderSuggestions(refs.orderCustomerName.value);
    });

    refs.orderCustomerName.addEventListener("blur", function () {
      window.setTimeout(function () {
        autoSelectExactCustomer();
        refs.customerSuggestions.innerHTML = "";
      }, 120);
    });

    refs.orderForm.addEventListener("submit", function (event) {
      event.preventDefault();

      autoSelectExactCustomer();
      const customer = getSelectedOrderCustomer();

      const item = refs.orderItem.value;
      const totalAmount = document.getElementById("orderTotal").value;
      const advanceAmount = document.getElementById("orderAdvance").value;
      const dueDate = document.getElementById("orderDueDate").value;
      const status = document.getElementById("orderStatus").value;
      const notes = document.getElementById("orderNotes").value.trim();

      if (!customer) {
        showMessage(refs.orderMessage, "Select a valid active customer from suggestions.", true);
        return;
      }

      if (!item || !totalAmount) {
        showMessage(refs.orderMessage, "Item and total are required.", true);
        return;
      }

      TailorStorage.addOrder({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        item: item,
        totalAmount: totalAmount,
        advanceAmount: advanceAmount,
        dueDate: dueDate,
        status: status,
        notes: notes
      });

      refs.orderForm.reset();
      document.getElementById("orderStatus").value = "Pending";
      clearOrderCustomerSelection();
      refs.customerSuggestions.innerHTML = "";
      showMessage(refs.orderMessage, "Order saved.");

      loadData();
      renderOverview();
      renderOrdersList();

      window.setTimeout(function () {
        closeModal(refs.orderModal);
        refs.orderMessage.textContent = "";
      }, 350);
    });
  }

  function renderSuggestions(query) {
    refs.customerSuggestions.innerHTML = "";
    const trimmed = String(query || "").trim().toLowerCase();

    if (!trimmed) {
      return;
    }

    const matches = state.customers.filter(function (customer) {
      return customer.isActive && String(customer.name || "").toLowerCase().includes(trimmed);
    });

    matches.slice(0, 8).forEach(function (customer) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-item";
      button.textContent = customer.name + " - " + customer.phone;

      button.addEventListener("click", function () {
        selectOrderCustomer(customer);
      });

      refs.customerSuggestions.appendChild(button);
    });
  }

  function autoSelectExactCustomer() {
    const typed = refs.orderCustomerName.value.trim();
    if (!typed) {
      clearOrderCustomerSelection();
      return;
    }

    const exact = TailorStorage.findCustomerByName(typed);
    if (exact) {
      selectOrderCustomer(exact);
    }
  }

  function selectOrderCustomer(customer) {
    state.selectedOrderCustomerId = customer.id;
    refs.orderCustomerName.value = customer.name;
    refs.orderCustomerPhone.value = customer.phone;
    refs.customerSuggestions.innerHTML = "";
  }

  function clearOrderCustomerSelection() {
    state.selectedOrderCustomerId = "";
    refs.orderCustomerName.value = "";
    refs.orderCustomerPhone.value = "";
  }

  function getSelectedOrderCustomer() {
    return (
      state.customers.find(function (customer) {
        return customer.id === state.selectedOrderCustomerId && customer.isActive;
      }) || null
    );
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
  }

  function showMessage(node, text, isError) {
    node.textContent = text;
    node.className = isError ? "message error" : "message success";
  }
})();
