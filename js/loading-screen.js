(function () {
  const SPLASH_ID = "tailorSplash";
  let hideTimer = null;

  function getShopName() {
    const cfg = window.TailorBookConfig || {};
    const shop = cfg.shop || {};
    return shop.name || "SRI LADIES DESIGNER";
  }

  function getRoot() {
    return document.getElementById(SPLASH_ID);
  }

  function ensureRoot() {
    let root = getRoot();
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = SPLASH_ID;
    root.className = "splash-screen";
    root.innerHTML =
      "<div class='splash-card'>" +
      "<div class='splash-logo' aria-hidden='true'>" +
      "<svg viewBox='0 0 96 96' role='img'>" +
      "<rect x='10' y='68' width='76' height='8' rx='4' class='mach-base'/>" +
      "<rect x='18' y='50' width='44' height='16' rx='4' class='mach-body'/>" +
      "<rect x='24' y='36' width='24' height='12' rx='3' class='mach-top'/>" +
      "<rect x='60' y='40' width='14' height='26' rx='3' class='mach-neck'/>" +
      "<rect x='70' y='54' width='3' height='14' rx='1.5' class='mach-needle'/>" +
      "<path d='M72 68 C72 72, 67 74, 58 74' class='mach-thread'/>" +
      "<circle cx='80' cy='60' r='8' class='mach-wheel'/>" +
      "<circle cx='80' cy='60' r='2.6' class='mach-wheel-center'/>" +
      "<circle cx='34' cy='42' r='3.2' class='mach-knob'/>" +
      "</svg>" +
      "</div>" +
      "<p class='splash-subtitle'>Preparing your workspace</p>" +
      "<h2 class='splash-shop-name'></h2>" +
      "<p class='splash-message' id='tailorSplashMessage'>Loading your data...</p>" +
      "<div class='splash-progress'><span></span></div>" +
      "</div>";

    document.body.appendChild(root);
    return root;
  }

  function updateText(message) {
    const root = ensureRoot();
    const shopNode = root.querySelector(".splash-shop-name");
    const messageNode = root.querySelector("#tailorSplashMessage");

    if (shopNode) {
      shopNode.textContent = getShopName();
    }

    if (messageNode && message) {
      messageNode.textContent = String(message);
    }
  }

  function show(message) {
    const root = ensureRoot();
    updateText(message);
    root.classList.add("visible");
    document.body.classList.add("splash-lock");

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hide() {
    const root = getRoot();
    if (!root) {
      return;
    }

    root.classList.remove("visible");
    document.body.classList.remove("splash-lock");

    hideTimer = setTimeout(function () {
      const current = getRoot();
      if (!current || current.classList.contains("visible")) {
        return;
      }
      current.remove();
    }, 220);
  }

  function init() {
    if (!document.body) {
      return;
    }

    show();

    setTimeout(function () {
      hide();
    }, 10000);
  }

  window.TailorSplash = {
    show: show,
    hide: hide,
    setMessage: updateText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
