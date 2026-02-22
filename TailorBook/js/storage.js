(function () {
  const CUSTOMER_KEY = "tailor_customers_v1";
  const ORDER_KEY = "tailor_orders_v1";

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

  function saveList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
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

  function ensureOrderNumbers(orders) {
    let maxCounter = orders.reduce(function (max, order) {
      return Math.max(max, extractCounter(order.orderNo, "ORD"));
    }, 0);

    let changed = false;
    const mapped = orders.map(function (order) {
      if (order.orderNo) {
        return order;
      }

      maxCounter += 1;
      changed = true;
      return Object.assign({}, order, { orderNo: "ORD-" + padNumber(maxCounter) });
    });

    return { list: mapped, changed: changed };
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

    saveList(CUSTOMER_KEY, updatedCustomers);

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
    saveList(ORDER_KEY, syncedOrders);

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

    orders.push({
      id: createId("ord"),
      orderNo: "ORD-" + padNumber(maxCounter + 1),
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone || "",
      item: order.item,
      totalAmount: Number(order.totalAmount) || 0,
      advanceAmount: Number(order.advanceAmount) || 0,
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

    const updated = orders.map(function (order) {
      if (order.id !== orderId) {
        return order;
      }

      found = Object.assign({}, order, {
        item: data.item,
        totalAmount: Number(data.totalAmount) || 0,
        advanceAmount: Number(data.advanceAmount) || 0,
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
    return updated.find(function (order) {
      return order.id === orderId;
    }) || null;
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

    const totalAdvance = orders.reduce(function (sum, order) {
      return sum + (Number(order.advanceAmount) || 0);
    }, 0);

    const totalBalance = orders.reduce(function (sum, order) {
      const total = Number(order.totalAmount) || 0;
      const advance = Number(order.advanceAmount) || 0;
      return sum + Math.max(total - advance, 0);
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
      totalAdvance: totalAdvance,
      totalBalance: totalBalance,
      pending: pending,
      stitching: stitching,
      ready: ready,
      delivered: delivered
    };
  }

  window.TailorStorage = {
    getCustomers: getCustomers,
    getCustomerById: getCustomerById,
    addCustomer: addCustomer,
    updateCustomer: updateCustomer,
    setCustomerActive: setCustomerActive,
    findCustomerByName: findCustomerByName,
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
