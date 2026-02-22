(function () {
  const form = document.getElementById("customerForm");

  if (!form) {
    return;
  }

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

  function showMessage(text, isError) {
    const message = document.getElementById("customerMessage");
    message.textContent = text;
    message.className = isError ? "message error" : "message success";
  }
})();
