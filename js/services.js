(function () {
  const refs = {
    serviceForm: document.getElementById("serviceForm"),
    serviceFormTitle: document.getElementById("serviceFormTitle"),
    serviceId: document.getElementById("serviceId"),
    serviceName: document.getElementById("serviceName"),
    servicePrice: document.getElementById("servicePrice"),
    serviceMessage: document.getElementById("serviceMessage"),
    cancelServiceEditBtn: document.getElementById("cancelServiceEditBtn"),
    serviceSearch: document.getElementById("serviceSearch"),
    serviceList: document.getElementById("serviceList")
  };

  let services = [];

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    loadServices();
    setupEvents();
    renderServices();
  });

  function setupEvents() {
    refs.serviceForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const id = refs.serviceId.value;
      const name = refs.serviceName.value.trim();
      const defaultPrice = refs.servicePrice.value;

      if (!name) {
        showMessage("Service name is required.", true);
        return;
      }

      if (id) {
        TailorStorage.updateService(id, {
          name: name,
          defaultPrice: defaultPrice
        });
        showMessage("Service updated.");
      } else {
        TailorStorage.addService({
          name: name,
          defaultPrice: defaultPrice
        });
        showMessage("Service added.");
      }

      resetForm();
      loadServices();
      renderServices();
    });

    refs.cancelServiceEditBtn.addEventListener("click", function () {
      resetForm();
    });

    refs.serviceSearch.addEventListener("input", function () {
      renderServices();
    });

    document.addEventListener("click", function () {
      closeAllMenus();
    });
  }

  function loadServices() {
    services = TailorStorage.getServices ? TailorStorage.getServices() : [];
  }

  function renderServices() {
    const q = refs.serviceSearch.value.trim().toLowerCase();
    refs.serviceList.innerHTML = "";

    const filtered = services.filter(function (service) {
      const text = [service.name, String(service.defaultPrice), service.isActive ? "active" : "inactive"].join(" ").toLowerCase();
      return !q || text.includes(q);
    });

    if (filtered.length === 0) {
      refs.serviceList.innerHTML = "<p class='empty'>No services found.</p>";
      return;
    }

    const list = document.createElement("div");
    list.className = "service-list-rows";

    filtered.forEach(function (service) {
      const row = document.createElement("div");
      row.className = "service-row " + (service.isActive ? "active" : "inactive");

      const main = document.createElement("div");
      main.className = "service-row-main";

      const dot = document.createElement("span");
      dot.className = "service-state-dot";

      const name = document.createElement("span");
      name.className = "service-row-name";
      name.textContent = service.name;
      name.title = service.name;

      main.appendChild(dot);
      main.appendChild(name);

      const price = document.createElement("span");
      price.className = "service-row-price";
      price.textContent = formatMoney(service.defaultPrice);

      const menuWrap = document.createElement("div");
      menuWrap.className = "service-menu-wrap";

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "service-menu-toggle";
      menuBtn.setAttribute("aria-label", "Open actions");
      menuBtn.textContent = "⋮";

      const menu = document.createElement("div");
      menu.className = "service-menu";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "service-menu-item edit";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        refs.serviceId.value = service.id;
        refs.serviceName.value = service.name;
        refs.servicePrice.value = String(service.defaultPrice || 0);
        refs.serviceFormTitle.textContent = "Edit Service";
        refs.cancelServiceEditBtn.classList.remove("hidden");
        refs.serviceName.focus();
        closeAllMenus();
      });

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "service-menu-item " + (service.isActive ? "deactivate" : "activate");
      toggleBtn.textContent = service.isActive ? "Deactivate" : "Activate";
      toggleBtn.addEventListener("click", function () {
        TailorStorage.setServiceActive(service.id, !service.isActive);
        loadServices();
        renderServices();
      });

      menuBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (menuWrap.classList.contains("open")) {
          menuWrap.classList.remove("open");
          return;
        }
        closeAllMenus(menuWrap);
        menuWrap.classList.add("open");
      });

      menu.appendChild(editBtn);
      menu.appendChild(toggleBtn);
      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(menu);

      row.appendChild(main);
      row.appendChild(price);
      row.appendChild(menuWrap);
      list.appendChild(row);
    });

    refs.serviceList.appendChild(list);
  }

  function closeAllMenus(exceptNode) {
    refs.serviceList.querySelectorAll(".service-menu-wrap.open").forEach(function (node) {
      if (exceptNode && node === exceptNode) {
        return;
      }
      node.classList.remove("open");
    });
  }

  function formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount);
    return "₹" + formatted;
  }

  function resetForm() {
    refs.serviceId.value = "";
    refs.serviceName.value = "";
    refs.servicePrice.value = "";
    refs.serviceFormTitle.textContent = "Add Service";
    refs.cancelServiceEditBtn.classList.add("hidden");
  }

  function showMessage(text, isError) {
    refs.serviceMessage.textContent = text;
    refs.serviceMessage.className = isError ? "message error" : "message success";
  }
})();
