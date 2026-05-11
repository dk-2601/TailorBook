(function () {
  const CUSTOMER_KEY = "tailor_customers_v1";
  const ORDER_KEY = "tailor_orders_v1";
  const SERVICE_KEY = "tailor_services_v1";
  const ACTIVE_UID_KEY = "tailor_active_uid";

  let cloudInitPromise = null;
  let cloudReady = false;
  let suppressCloudPush = false;

  function safeParse(raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function loadList(key) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    return safeParse(raw);
  }

  function saveList(key, list, options) {
    localStorage.setItem(key, JSON.stringify(list));

    const skipCloud = options && options.skipCloud;
    if (!skipCloud) {
      scheduleCloudSync();
    }
  }

  function toNonNegativeNumber(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return Number(fallback) || 0;
    }
    return n;
  }

  function scheduleCloudSync() {
    if (suppressCloudPush) {
      return;
    }

    if (window.TailorAuth && window.TailorAuth.getUser && !window.TailorAuth.getUser()) {
      return;
    }
    if (!window.FirestoreSync || !window.FirestoreSync.queueSync) {
      return;
    }

    window.FirestoreSync.queueSync({
      customers: loadList(CUSTOMER_KEY),
      orders: loadList(ORDER_KEY),
      services: loadList(SERVICE_KEY)
    });
  }

  function syncCloudNow() {
    if (suppressCloudPush) {
      return Promise.resolve(false);
    }

    if (window.TailorAuth && window.TailorAuth.getUser && !window.TailorAuth.getUser()) {
      return Promise.resolve(false);
    }

    if (!window.FirestoreSync || !window.FirestoreSync.queueSync) {
      return Promise.resolve(false);
    }

    const result = window.FirestoreSync.queueSync(
      {
        customers: loadList(CUSTOMER_KEY),
        orders: loadList(ORDER_KEY),
        services: loadList(SERVICE_KEY)
      },
      { immediate: true }
    );

    if (result && typeof result.then === "function") {
      return result;
    }

    return Promise.resolve(true);
  }

  function createId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  function padNumber(n) {
    return String(n).padStart(4, "0");
  }

  function extractCounter(value, prefix) {
    const text = String(value || "");
    const match = text.match(new RegExp("^" + prefix + "-(\\d+)$"));
    return match ? Number(match[1]) : 0;
  }

  function ensureCustomerNumbers(customers) {
    let maxCounter = customers.reduce(function (max, customer) {
      return Math.max(max, extractCounter(customer.customerNo, "CUST"));
    }, 0);

    let changed = false;
    const mapped = customers.map(function (customer) {
      let next = customer;

      if (!customer.customerNo) {
        maxCounter += 1;
        next = Object.assign({}, next, { customerNo: "CUST-" + padNumber(maxCounter) });
        changed = true;
      }

      if (typeof next.isActive !== "boolean") {
        next = Object.assign({}, next, { isActive: true });
        changed = true;
      }

      return next;
    });

    return { list: mapped, changed: changed };
  }

  function normalizeService(service) {
    const name = String(service.name || "").trim();
    return {
      id: service.id || createId("svc"),
      name: name,
      defaultPrice: toNonNegativeNumber(service.defaultPrice, 0),
      isActive: typeof service.isActive === "boolean" ? service.isActive : true,
      createdAt: service.createdAt || new Date().toISOString()
    };
  }

  function ensureServices(services) {
    let changed = false;

    const mapped = services
      .map(function (service) {
        const raw = service || {};
        const next = normalizeService(raw);
        if (
          next.id !== raw.id ||
          next.name !== raw.name ||
          next.defaultPrice !== Number(raw.defaultPrice) ||
          next.isActive !== raw.isActive
        ) {
          changed = true;
        }
        return next;
      })
      .filter(function (service) {
        if (!service.name) {
          changed = true;
          return false;
        }
        return true;
      });

    return { list: mapped, changed: changed };
  }

  function getServices() {
    const services = loadList(SERVICE_KEY);
    const result = ensureServices(services);
    const sorted = result.list
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

    if (result.changed || JSON.stringify(sorted) !== JSON.stringify(services)) {
      saveList(SERVICE_KEY, sorted);
    }

    return sorted;
  }

  function getActiveServices() {
    return getServices().filter(function (service) {
      return service.isActive;
    });
  }

  function addService(data) {
    const name = String(data.name || "").trim();
    if (!name) {
      return null;
    }

    const services = getServices();
    const next = normalizeService({
      id: createId("svc"),
      name: name,
      defaultPrice: data.defaultPrice,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    services.push(next);
    saveList(SERVICE_KEY, services);
    return next;
  }

  function updateService(serviceId, data) {
    const services = getServices();
    let found = null;

    const updated = services.map(function (service) {
      if (service.id !== serviceId) {
        return service;
      }

      const next = Object.assign({}, service, {
        name: String(data.name || service.name || "").trim(),
        defaultPrice: toNonNegativeNumber(data.defaultPrice, service.defaultPrice)
      });

      if (!next.name) {
        return service;
      }

      found = next;
      return next;
    });

    if (!found) {
      return null;
    }

    saveList(SERVICE_KEY, updated, { skipCloud: true });

    const orders = getOrders();
    const syncedOrders = orders.map(function (order) {
      if (!Array.isArray(order.lineItems) || order.lineItems.length === 0) {
        return order;
      }

      const changedItems = order.lineItems.map(function (line) {
        if (line.serviceId !== serviceId) {
          return line;
        }

        const qty = toNonNegativeNumber(line.qty, 1) || 1;
        const unitPrice = toNonNegativeNumber(line.unitPrice, found.defaultPrice);
        return {
          serviceId: serviceId,
          serviceName: found.name,
          qty: qty,
          unitPrice: unitPrice,
          amount: qty * unitPrice
        };
      });

      const totalAmount = changedItems.reduce(function (sum, line) {
        return sum + line.amount;
      }, 0);

      return Object.assign({}, order, {
        lineItems: changedItems,
        totalAmount: totalAmount,
        item: changedItems[0] ? changedItems[0].serviceName : order.item
      });
    });

    saveList(ORDER_KEY, syncedOrders, { skipCloud: true });
    scheduleCloudSync();
    return found;
  }

  function setServiceActive(serviceId, isActive) {
    const services = getServices();
    let changed = false;

    const updated = services.map(function (service) {
      if (service.id !== serviceId) {
        return service;
      }
      changed = true;
      return Object.assign({}, service, { isActive: Boolean(isActive) });
    });

    if (changed) {
      saveList(SERVICE_KEY, updated);
    }

    return changed;
  }

  function getServiceMap() {
    return getServices().reduce(function (acc, service) {
      acc[service.id] = service;
      return acc;
    }, {});
  }

  function sanitizeLineItems(items, serviceMap) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map(function (line) {
        const raw = line || {};
        const mappedService = raw.serviceId ? serviceMap[raw.serviceId] : null;
        const serviceName = String(raw.serviceName || (mappedService ? mappedService.name : "")).trim();
        const qty = Math.max(1, Math.round(toNonNegativeNumber(raw.qty, 1) || 1));
        const fallbackPrice = mappedService ? mappedService.defaultPrice : 0;
        const unitPrice = toNonNegativeNumber(raw.unitPrice, fallbackPrice);

        if (!serviceName) {
          return null;
        }

        return {
          serviceId: raw.serviceId || "",
          serviceName: serviceName,
          qty: qty,
          unitPrice: unitPrice,
          amount: qty * unitPrice
        };
      })
      .filter(function (line) {
        return line !== null;
      });
  }

  function getCustomers() {
    const customers = loadList(CUSTOMER_KEY);
    const result = ensureCustomerNumbers(customers);
    if (result.changed) {
      saveList(CUSTOMER_KEY, result.list);
    }
    return result.list;
  }

  function getCustomerById(customerId) {
    const customers = getCustomers();
    return (
      customers.find(function (customer) {
        return customer.id === customerId;
      }) || null
    );
  }

  function addCustomer(customer) {
    const customers = getCustomers();
    const maxCounter = customers.reduce(function (max, item) {
      return Math.max(max, extractCounter(item.customerNo, "CUST"));
    }, 0);

    customers.push({
      id: createId("cust"),
      customerNo: "CUST-" + padNumber(maxCounter + 1),
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes || "",
      isActive: true,
      createdAt: new Date().toISOString()
    });

    saveList(CUSTOMER_KEY, customers);
  }

  function updateCustomer(customerId, data) {
    const customers = getCustomers();
    let updatedCustomer = null;

    const updatedCustomers = customers.map(function (customer) {
      if (customer.id !== customerId) {
        return customer;
      }

      updatedCustomer = Object.assign({}, customer, {
        name: data.name,
        phone: data.phone,
        notes: data.notes || ""
      });

      return updatedCustomer;
    });

    if (!updatedCustomer) {
      return null;
    }

    saveList(CUSTOMER_KEY, updatedCustomers, { skipCloud: true });

    const orders = getOrders();
    const syncedOrders = orders.map(function (order) {
      if (order.customerId !== customerId) {
        return order;
      }
      return Object.assign({}, order, {
        customerName: updatedCustomer.name,
        customerPhone: updatedCustomer.phone
      });
    });

    saveList(ORDER_KEY, syncedOrders, { skipCloud: true });
    scheduleCloudSync();

    return updatedCustomer;
  }

  function setCustomerActive(customerId, isActive) {
    const customers = getCustomers();
    let changed = false;

    const updated = customers.map(function (customer) {
      if (customer.id !== customerId) {
        return customer;
      }
      changed = true;
      return Object.assign({}, customer, { isActive: Boolean(isActive) });
    });

    if (changed) {
      saveList(CUSTOMER_KEY, updated);
    }

    return changed;
  }

  function findCustomerByName(name) {
    const query = String(name || "").trim().toLowerCase();
    if (!query) {
      return null;
    }

    const customers = getCustomers();
    return (
      customers.find(function (customer) {
        return customer.isActive && String(customer.name || "").trim().toLowerCase() === query;
      }) || null
    );
  }

  function ensureOrderNumbers(orders) {
    let maxCounter = orders.reduce(function (max, order) {
      return Math.max(max, extractCounter(order.orderNo, "ORD"));
    }, 0);

    let changed = false;
    const serviceMap = getServiceMap();

    const mapped = orders.map(function (order) {
      let next = Object.assign({}, order || {});

      if (!next.orderNo) {
        maxCounter += 1;
        next.orderNo = "ORD-" + padNumber(maxCounter);
        changed = true;
      }

      const materialCost = toNonNegativeNumber(next.materialCost, 0);
      if (materialCost !== Number(next.materialCost)) {
        next.materialCost = materialCost;
        changed = true;
      }

      const paidRaw = Number(next.paidAmount);
      const legacyAdvance = toNonNegativeNumber(next.advanceAmount, 0);
      const paidAmount = Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : legacyAdvance;
      if (paidAmount !== Number(next.paidAmount)) {
        next.paidAmount = paidAmount;
        changed = true;
      }

      const lineItems = sanitizeLineItems(next.lineItems, serviceMap);
      if (JSON.stringify(lineItems) !== JSON.stringify(next.lineItems || [])) {
        next.lineItems = lineItems;
        changed = true;
      }

      const totalFromLines = lineItems.reduce(function (sum, line) {
        return sum + line.amount;
      }, 0);

      if (lineItems.length > 0) {
        if (totalFromLines !== Number(next.totalAmount)) {
          next.totalAmount = totalFromLines;
          changed = true;
        }
        if (!next.item) {
          next.item = lineItems[0].serviceName;
          changed = true;
        }
      } else {
        const totalAmount = toNonNegativeNumber(next.totalAmount, 0);
        if (totalAmount !== Number(next.totalAmount)) {
          next.totalAmount = totalAmount;
          changed = true;
        }
      }

      if (!next.customerName) {
        next.customerName = "-";
        changed = true;
      }
      if (!next.customerPhone) {
        next.customerPhone = "";
        changed = true;
      }
      if (!next.status) {
        next.status = "Pending";
        changed = true;
      }

      return next;
    });

    return { list: mapped, changed: changed };
  }

  function getOrders() {
    const orders = loadList(ORDER_KEY);
    const result = ensureOrderNumbers(orders);
    if (result.changed) {
      saveList(ORDER_KEY, result.list);
    }
    return result.list;
  }

  function getOrderById(orderId) {
    const orders = getOrders();
    return (
      orders.find(function (order) {
        return order.id === orderId;
      }) || null
    );
  }

  function getOrdersByCustomerId(customerId) {
    const orders = getOrders();
    return orders.filter(function (order) {
      return order.customerId === customerId;
    });
  }

  function addOrder(order) {
    const orders = getOrders();
    const maxCounter = orders.reduce(function (max, item) {
      return Math.max(max, extractCounter(item.orderNo, "ORD"));
    }, 0);

    const serviceMap = getServiceMap();
    const lineItems = sanitizeLineItems(order.lineItems, serviceMap);
    const totalFromLines = lineItems.reduce(function (sum, line) {
      return sum + line.amount;
    }, 0);

    orders.push({
      id: createId("ord"),
      orderNo: "ORD-" + padNumber(maxCounter + 1),
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone || "",
      item: String(order.item || (lineItems[0] ? lineItems[0].serviceName : "Order")).trim(),
      lineItems: lineItems,
      totalAmount: lineItems.length > 0 ? totalFromLines : toNonNegativeNumber(order.totalAmount, 0),
      advanceAmount: 0,
      paidAmount: toNonNegativeNumber(order.paidAmount, 0),
      materialCost: toNonNegativeNumber(order.materialCost, 0),
      dueDate: order.dueDate || "",
      status: order.status || "Pending",
      notes: order.notes || "",
      createdAt: new Date().toISOString()
    });

    saveList(ORDER_KEY, orders);
  }

  function updateOrder(orderId, data) {
    const orders = getOrders();
    let found = null;
    const serviceMap = getServiceMap();

    const updated = orders.map(function (order) {
      if (order.id !== orderId) {
        return order;
      }

      const lineItems = Array.isArray(data.lineItems) ? sanitizeLineItems(data.lineItems, serviceMap) : sanitizeLineItems(order.lineItems, serviceMap);
      const totalFromLines = lineItems.reduce(function (sum, line) {
        return sum + line.amount;
      }, 0);

      found = Object.assign({}, order, {
        item: String(data.item || (lineItems[0] ? lineItems[0].serviceName : order.item || "Order")).trim(),
        lineItems: lineItems,
        totalAmount: lineItems.length > 0 ? totalFromLines : toNonNegativeNumber(data.totalAmount, order.totalAmount),
        advanceAmount: 0,
        paidAmount: toNonNegativeNumber(data.paidAmount, order.paidAmount),
        materialCost: toNonNegativeNumber(data.materialCost, order.materialCost),
        dueDate: data.dueDate || "",
        status: data.status || "Pending",
        notes: data.notes || ""
      });

      return found;
    });

    if (!found) {
      return null;
    }

    saveList(ORDER_KEY, updated);
    return found;
  }

  function updateOrderStatus(orderId, status) {
    const orders = getOrders();
    let changed = false;

    const updated = orders.map(function (order) {
      if (order.id !== orderId) {
        return order;
      }
      changed = true;
      return Object.assign({}, order, { status: status || "Pending" });
    });

    if (!changed) {
      return null;
    }

    saveList(ORDER_KEY, updated);
    return (
      updated.find(function (order) {
        return order.id === orderId;
      }) || null
    );
  }

  function deleteOrder(orderId) {
    const orders = getOrders();
    const updated = orders.filter(function (order) {
      return order.id !== orderId;
    });

    if (updated.length === orders.length) {
      return false;
    }

    saveList(ORDER_KEY, updated);
    return true;
  }

  function getSummary() {
    const customers = getCustomers();
    const orders = getOrders();

    const totalRevenue = orders.reduce(function (sum, order) {
      return sum + (Number(order.totalAmount) || 0);
    }, 0);

    const totalPaid = orders.reduce(function (sum, order) {
      return sum + toNonNegativeNumber(order.paidAmount, Number(order.advanceAmount) || 0);
    }, 0);

    const totalMaterialCost = orders.reduce(function (sum, order) {
      return sum + (Number(order.materialCost) || 0);
    }, 0);

    const totalMargin = totalRevenue - totalMaterialCost;

    const totalBalance = orders.reduce(function (sum, order) {
      const total = Number(order.totalAmount) || 0;
      const paid = toNonNegativeNumber(order.paidAmount, Number(order.advanceAmount) || 0);
      return sum + Math.max(total - paid, 0);
    }, 0);

    const pending = orders.filter(function (o) {
      return o.status === "Pending";
    }).length;

    const stitching = orders.filter(function (o) {
      return o.status === "Stitching";
    }).length;

    const ready = orders.filter(function (o) {
      return o.status === "Ready";
    }).length;

    const delivered = orders.filter(function (o) {
      return o.status === "Delivered";
    }).length;

    return {
      totalCustomers: customers.length,
      activeCustomers: customers.filter(function (c) {
        return c.isActive;
      }).length,
      totalOrders: orders.length,
      totalPaid: totalPaid,
      totalRevenue: totalRevenue,
      totalMaterialCost: totalMaterialCost,
      totalMargin: totalMargin,
      totalBalance: totalBalance,
      pending: pending,
      stitching: stitching,
      ready: ready,
      delivered: delivered
    };
  }

  async function initCloud() {
    if (cloudReady) {
      return true;
    }

    if (cloudInitPromise) {
      return cloudInitPromise;
    }

    cloudInitPromise = (async function () {
      if (!window.FirestoreSync || !window.FirestoreSync.init) {
        return false;
      }

      if (window.TailorAuth && window.TailorAuth.waitForAuth) {
        await window.TailorAuth.waitForAuth();
      }

      const authUser = window.TailorAuth && window.TailorAuth.getUser ? window.TailorAuth.getUser() : null;
      if (authUser && authUser.uid) {
        const activeUid = localStorage.getItem(ACTIVE_UID_KEY);
        if (activeUid !== authUser.uid) {
          saveList(CUSTOMER_KEY, [], { skipCloud: true });
          saveList(ORDER_KEY, [], { skipCloud: true });
          saveList(SERVICE_KEY, [], { skipCloud: true });
          localStorage.setItem(ACTIVE_UID_KEY, authUser.uid);
        }
      }

      const ready = await window.FirestoreSync.init();
      if (!ready) {
        cloudInitPromise = null;
        cloudReady = false;
        return false;
      }

      suppressCloudPush = true;
      try {
        const remote = await window.FirestoreSync.pullToLocal();
        if (remote) {
          if (Array.isArray(remote.customers)) {
            saveList(CUSTOMER_KEY, remote.customers, { skipCloud: true });
          }
          if (Array.isArray(remote.orders)) {
            saveList(ORDER_KEY, remote.orders, { skipCloud: true });
          }
          if (Array.isArray(remote.services)) {
            saveList(SERVICE_KEY, remote.services, { skipCloud: true });
          }
        }

        // Normalize old records and sync back once.
        const normalizedCustomers = getCustomers();
        const normalizedOrders = getOrders();
        const normalizedServices = getServices();
        saveList(CUSTOMER_KEY, normalizedCustomers, { skipCloud: true });
        saveList(ORDER_KEY, normalizedOrders, { skipCloud: true });
        saveList(SERVICE_KEY, normalizedServices, { skipCloud: true });
      } finally {
        suppressCloudPush = false;
      }

      scheduleCloudSync();
      cloudReady = true;
      return true;
    })().catch(function () {
      suppressCloudPush = false;
      cloudReady = false;
      cloudInitPromise = null;
      return false;
    });

    return cloudInitPromise.finally(function () {
      if (!cloudReady) {
        cloudInitPromise = null;
      }
    });
  }

  window.TailorStorage = {
    initCloud: initCloud,
    syncCloudNow: syncCloudNow,
    getCustomers: getCustomers,
    getCustomerById: getCustomerById,
    addCustomer: addCustomer,
    updateCustomer: updateCustomer,
    setCustomerActive: setCustomerActive,
    findCustomerByName: findCustomerByName,
    getServices: getServices,
    getActiveServices: getActiveServices,
    addService: addService,
    updateService: updateService,
    setServiceActive: setServiceActive,
    getOrders: getOrders,
    getOrderById: getOrderById,
    getOrdersByCustomerId: getOrdersByCustomerId,
    addOrder: addOrder,
    updateOrder: updateOrder,
    updateOrderStatus: updateOrderStatus,
    deleteOrder: deleteOrder,
    getSummary: getSummary
  };
})();
