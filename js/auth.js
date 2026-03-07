(function () {
  const REDIRECT_PENDING_KEY = "tailor_auth_redirect_pending";

  const state = {
    ready: false,
    user: null,
    readyResolve: null,
    readyPromise: null,
    authUnsub: null,
    resolvingRedirect: false
  };

  state.readyPromise = new Promise(function (resolve) {
    state.readyResolve = resolve;
  });

  function getConfig() {
    return window.TAILOR_FIREBASE_CONFIG || {};
  }

  function ensureFirebaseApp() {
    const cfg = getConfig();
    if (!cfg.enabled) {
      return false;
    }

    if (!window.firebase || !window.firebase.initializeApp) {
      return false;
    }

    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId
      });
    }

    return true;
  }

  function emitAuthChanged() {
    window.dispatchEvent(
      new CustomEvent("tailor-auth-changed", {
        detail: {
          user: state.user ? { uid: state.user.uid, email: state.user.email || null } : null
        }
      })
    );
  }

  function buildLoginScreen() {
    if (document.getElementById("loginScreen")) {
      return;
    }

    const screen = document.createElement("div");
    screen.id = "loginScreen";
    screen.className = "login-screen hidden";
    screen.innerHTML =
      "<div class='login-frame'>" +
      "  <section class='login-hero'>" +
      "    <div class='hero-glow hero-glow-one'></div>" +
      "    <div class='hero-glow hero-glow-two'></div>" +
      "    <div class='hero-content'>" +
      "      <p class='hero-kicker'>Tailor Book</p>" +
      "      <h2>Track orders, balance and delivery with confidence.</h2>" +
      "      <p id='loginSubtitle' class='hero-sub'>Simple order tracking for tailors</p>" +
      "    </div>" +
      "  </section>" +
      "  <section class='login-action'>" +
      "    <button id='googleSignInBtn' type='button'>Continue with Google</button>" +
      "    <p id='authErrorText' class='message error hidden'></p>" +
      "  </section>" +
      "</div>";

    document.body.appendChild(screen);
    document.getElementById("googleSignInBtn").addEventListener("click", signInWithGoogle);
  }

  function showLoginScreen(errorText, loadingText) {
    buildLoginScreen();

    const loginScreen = document.getElementById("loginScreen");
    const authErrorText = document.getElementById("authErrorText");
    const subtitle = document.getElementById("loginSubtitle");
    const signInBtn = document.getElementById("googleSignInBtn");

    loginScreen.classList.remove("hidden");
    document.body.classList.add("auth-locked");

    subtitle.textContent = loadingText || "Simple order tracking for tailors";
    signInBtn.disabled = Boolean(loadingText);

    if (errorText) {
      authErrorText.textContent = errorText;
      authErrorText.classList.remove("hidden");
    } else {
      authErrorText.textContent = "";
      authErrorText.classList.add("hidden");
    }
  }

  function hideLoginScreen() {
    const loginScreen = document.getElementById("loginScreen");
    if (loginScreen) {
      loginScreen.classList.add("hidden");
      const signInBtn = document.getElementById("googleSignInBtn");
      if (signInBtn) {
        signInBtn.disabled = false;
      }
    }
    document.body.classList.remove("auth-locked");
  }

  function updateWelcome(user) {
    const welcome = document.getElementById("welcomeText");
    if (!welcome) {
      return;
    }

    const name = user && (user.displayName || user.email || "User");
    welcome.textContent = name ? "Welcome, " + name : "Welcome";
  }

  function bindSignOutButton() {
    const signOutBtn = document.getElementById("signOutBtn");
    if (!signOutBtn) {
      return;
    }

    if (!signOutBtn.getAttribute("data-bound")) {
      signOutBtn.setAttribute("data-bound", "1");
      signOutBtn.addEventListener("click", signOut);
    }

    signOutBtn.classList.remove("hidden");
  }

  function setAuthUI(user, errorText) {
    if (errorText) {
      showLoginScreen(errorText, "");
      return;
    }

    if (user) {
      hideLoginScreen();
      updateWelcome(user);
      bindSignOutButton();
    } else {
      if (state.resolvingRedirect) {
        showLoginScreen("", "Completing sign in...");
      } else {
        showLoginScreen("", "");
      }
      updateWelcome(null);
      const signOutBtn = document.getElementById("signOutBtn");
      if (signOutBtn) {
        signOutBtn.classList.add("hidden");
      }
    }
  }

  function finishReady(user) {
    if (!state.ready) {
      state.ready = true;
      state.readyResolve(user || null);
    }
  }

  function onUserResolved(user) {
    state.user = user || null;
    setAuthUI(state.user, "");
    finishReady(state.user);

    window.__TAILOR_AUTH_STATUS__ = {
      ready: state.ready,
      user: state.user ? { uid: state.user.uid, email: state.user.email || null } : null
    };

    if (window.TailorStorage && window.TailorStorage.initCloud) {
      window.TailorStorage.initCloud();
    }

    emitAuthChanged();
  }

  function initAuth() {
    const cfg = getConfig();

    if (!cfg.enabled) {
      finishReady(null);
      return;
    }

    if (!ensureFirebaseApp()) {
      setAuthUI(null, "Firebase SDK not loaded.");
      finishReady(null);
      return;
    }

    if (!window.firebase.auth) {
      setAuthUI(null, "Firebase Auth SDK not loaded.");
      finishReady(null);
      return;
    }

    const auth = window.firebase.auth();
    auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function () {
      // ignore
    });

    if (state.authUnsub) {
      state.authUnsub();
    }

    const redirectPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1";
    if (redirectPending) {
      state.resolvingRedirect = true;
      showLoginScreen("", "Completing sign in...");
    }

    auth
      .getRedirectResult()
      .then(function (result) {
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        state.resolvingRedirect = false;
        if (result && result.user) {
          onUserResolved(result.user);
        } else {
          setAuthUI(auth.currentUser || null, "");
        }
      })
      .catch(function (error) {
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        state.resolvingRedirect = false;
        setAuthUI(null, "Google sign-in failed: " + String(error.message || error));
      });

    state.authUnsub = auth.onAuthStateChanged(function (user) {
      onUserResolved(user);
    });
  }

  function signInWithGoogle() {
    if (!window.firebase || !window.firebase.auth) {
      return;
    }

    showLoginScreen("", "Opening Google sign-in...");

    const provider = new window.firebase.auth.GoogleAuthProvider();
    window.firebase
      .auth()
      .signInWithPopup(provider)
      .then(function (result) {
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        state.resolvingRedirect = false;
        if (result && result.user) {
          onUserResolved(result.user);
        }
      })
      .catch(function (error) {
        const code = String(error && error.code ? error.code : "");
        if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
          sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
          state.resolvingRedirect = true;
          showLoginScreen("", "Redirecting to Google...");
          window.firebase.auth().signInWithRedirect(provider);
          return;
        }

        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        state.resolvingRedirect = false;
        setAuthUI(null, "Google sign-in failed: " + String(error.message || error));
      });
  }

  function signOut() {
    if (!window.firebase || !window.firebase.auth) {
      return;
    }

    localStorage.removeItem("tailor_customers_v1");
    localStorage.removeItem("tailor_orders_v1");
    localStorage.removeItem("tailor_active_uid");

    window.firebase
      .auth()
      .signOut()
      .then(function () {
        window.location.href = "index.html";
      })
      .catch(function () {
        window.location.href = "index.html";
      });
  }

  window.TailorAuth = {
    init: initAuth,
    waitForAuth: function () {
      return state.readyPromise;
    },
    getUser: function () {
      return state.user;
    },
    signInWithGoogle: signInWithGoogle,
    signOut: signOut
  };

  initAuth();
})();
