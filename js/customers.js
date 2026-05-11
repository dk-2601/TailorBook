(function () {
  const form = document.getElementById("customerForm");

  if (!form) {
    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
    return;
  }

  Promise.resolve(TailorStorage.initCloud ? TailorStorage.initCloud() : false).finally(function () {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const name = document.getElementById("customerName").value.trim();
      const phone = document.getElementById("customerPhone").value.trim();
      const notes = document.getElementById("customerNotes").value.trim();

      if (!name || !phone) {
        showMessage("Name and phone are required.", true);
        return;
      }

      TailorStorage.addCustomer({
        name: name,
        phone: phone,
        notes: notes
      });

      form.reset();
      showMessage("Customer saved.");
    });

    if (window.TailorSplash && window.TailorSplash.hide) {
      window.TailorSplash.hide();
    }
  });

  function showMessage(text, isError) {
    const message = document.getElementById("customerMessage");
    message.textContent = text;
    message.className = isError ? "message error" : "message success";
  }
})();
