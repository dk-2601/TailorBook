(function () {
  const state = {
    ready: false,
    docRef: null,
    timer: null,
    lastError: null
  };

  function setError(error) {
    state.lastError = error;
    window.__TAILOR_FIRESTORE_STATUS__ = {
      ready: state.ready,
      lastError: error ? String(error.message || error) : null
    };
    if (error) {
      console.error("[TailorBook][Firestore]", error);
    }
  }

  function getConfig() {
    return window.TAILOR_FIREBASE_CONFIG || null;
  }

  function hasValidConfig(cfg) {
    return cfg && cfg.enabled === true && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId;
  }

  function getCurrentUser() {
    if (window.TailorAuth && window.TailorAuth.getUser) {
      return window.TailorAuth.getUser();
    }
    if (window.firebase && window.firebase.auth) {
      return window.firebase.auth().currentUser || null;
    }
    return null;
  }

  async function init() {
    try {
      const cfg = getConfig();
      if (!hasValidConfig(cfg)) {
        setError("Firebase config missing or disabled (check js/cloud-config.js).");
        return false;
      }

      if (!window.firebase || !window.firebase.initializeApp) {
        setError("Firebase SDK not loaded.");
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

      if (cfg.requireAuth) {
        const user = getCurrentUser();
        if (!user) {
          state.ready = false;
          setError("Not signed in.");
          return false;
        }

        const db = window.firebase.firestore();
        state.docRef = db.collection(cfg.collection || "tailorbook_users").doc(user.uid);
      } else {
        const db = window.firebase.firestore();
        state.docRef = db.collection(cfg.collection || "tailorbook").doc(cfg.document || "main");
      }

      state.ready = true;
      setError(null);
      return true;
    } catch (error) {
      state.ready = false;
      setError(error);
      return false;
    }
  }

  async function pullToLocal() {
    if (!state.ready || !state.docRef) {
      return null;
    }

    try {
      const snap = await state.docRef.get();
      if (!snap.exists) {
        return null;
      }

      const data = snap.data() || {};
      return {
        customers: Array.isArray(data.customers) ? data.customers : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        services: Array.isArray(data.services) ? data.services : []
      };
    } catch (error) {
      setError(error);
      return null;
    }
  }

  function pushPayload(payload) {
    const user = getCurrentUser();

    return state.docRef
      .set({
        customers: Array.isArray(payload.customers) ? payload.customers : [],
        orders: Array.isArray(payload.orders) ? payload.orders : [],
        services: Array.isArray(payload.services) ? payload.services : [],
        userEmail: user ? user.email || null : null,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      })
      .then(function () {
        setError(null);
        return true;
      })
      .catch(function (error) {
        setError(error);
        return false;
      });
  }

  function queueSync(payload, options) {
    if (!state.ready || !state.docRef) {
      return Promise.resolve(false);
    }

    const immediate = options && options.immediate === true;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (immediate) {
      return pushPayload(payload);
    }

    state.timer = setTimeout(function () {
      pushPayload(payload);
      state.timer = null;
    }, 600);

    return Promise.resolve(true);
  }

  window.FirestoreSync = {
    init: init,
    pullToLocal: pullToLocal,
    queueSync: queueSync
  };
})();
