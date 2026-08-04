(function initTrainingFirebase(global) {
  const firebaseConfig = global.TrainingFirebaseConfig;
  const hasFirebaseSdk = typeof global.firebase !== "undefined";
  const state = {
    app: null,
    auth: null,
    db: null,
    user: null,
    initPromise: null,
    authReadyPromise: null
  };

  function isConfigured() {
    return Boolean(
      hasFirebaseSdk &&
      firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
    );
  }

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(global.navigator?.userAgent || "");
  }

  async function ensureInitialized() {
    if (!isConfigured()) return null;
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async () => {
      state.app = global.firebase.apps.length
        ? global.firebase.app()
        : global.firebase.initializeApp(firebaseConfig);
      state.auth = global.firebase.auth();
      state.db = global.firebase.firestore();

      await state.auth.setPersistence(global.firebase.auth.Auth.Persistence.LOCAL);

      try {
        await state.auth.getRedirectResult();
      } catch (error) {
        console.error("Firebase redirect auth failed:", error);
      }

      state.user = state.auth.currentUser;
      return state;
    })().catch((error) => {
      console.error("Firebase initialization failed:", error);
      state.initPromise = null;
      return null;
    });

    return state.initPromise;
  }

  async function waitForAuthReady() {
    const initialized = await ensureInitialized();
    if (!initialized) return null;
    if (state.authReadyPromise) return state.authReadyPromise;

    state.authReadyPromise = new Promise((resolve) => {
      const unsubscribe = state.auth.onAuthStateChanged((user) => {
        state.user = user || null;
        unsubscribe();
        resolve(state.user);
      });
    });

    return state.authReadyPromise;
  }

  function createGoogleProvider() {
    const provider = new global.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }

  async function signInWithGoogle() {
    const initialized = await ensureInitialized();
    if (!initialized) return false;

    const provider = createGoogleProvider();

    if (isMobileDevice()) {
      await state.auth.signInWithRedirect(provider);
      return true;
    }

    const result = await state.auth.signInWithPopup(provider);
    state.user = result.user || state.auth.currentUser || null;
    return Boolean(state.user);
  }

  async function signOut() {
    const initialized = await ensureInitialized();
    if (!initialized) return false;

    await state.auth.signOut();
    state.user = null;
    return true;
  }

  function onAuthStateChanged(callback) {
    if (!isConfigured()) {
      callback(null);
      return () => {};
    }

    ensureInitialized().then((initialized) => {
      if (!initialized) {
        callback(null);
        return;
      }

      initialized.auth.onAuthStateChanged((user) => {
        state.user = user || null;
        callback(state.user);
      });
    });

    return () => {};
  }

  function getCurrentUser() {
    return state.user;
  }

  function getDocumentRef() {
    if (!state.db || !state.user) return null;
    return state.db.collection("users").doc(state.user.uid).collection("training").doc("appState");
  }

  async function loadState() {
    const initialized = await ensureInitialized();
    if (!initialized) return null;

    await waitForAuthReady();

    const docRef = getDocumentRef();
    if (!docRef) return null;

    const snapshot = await docRef.get();
    return snapshot.exists ? snapshot.data()?.state || null : null;
  }

  async function saveState(nextState) {
    const initialized = await ensureInitialized();
    if (!initialized) return false;

    await waitForAuthReady();

    const docRef = getDocumentRef();
    if (!docRef) return false;

    await docRef.set(
      {
        state: nextState,
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return true;
  }

  global.TrainingFirebase = {
    isConfigured,
    ensureInitialized,
    waitForAuthReady,
    signInWithGoogle,
    signOut,
    onAuthStateChanged,
    getCurrentUser,
    loadState,
    saveState
  };
})(window);
