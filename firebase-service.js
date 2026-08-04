(function initTrainingFirebase(global) {
  const firebaseConfig = global.TrainingFirebaseConfig;
  const hasFirebaseSdk = typeof global.firebase !== "undefined";
  const state = {
    app: null,
    auth: null,
    db: null,
    user: null,
    initPromise: null
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

  async function ensureInitialized() {
    if (!isConfigured()) return null;
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async () => {
      state.app = global.firebase.apps.length
        ? global.firebase.app()
        : global.firebase.initializeApp(firebaseConfig);
      state.auth = global.firebase.auth();
      state.db = global.firebase.firestore();

      if (!state.auth.currentUser) {
        await state.auth.signInAnonymously();
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

  function getDocumentRef() {
    if (!state.db || !state.user) return null;
    return state.db.collection("users").doc(state.user.uid).collection("training").doc("appState");
  }

  async function loadState() {
    const initialized = await ensureInitialized();
    if (!initialized) return null;

    const docRef = getDocumentRef();
    if (!docRef) return null;

    const snapshot = await docRef.get();
    return snapshot.exists ? snapshot.data()?.state || null : null;
  }

  async function saveState(nextState) {
    const initialized = await ensureInitialized();
    if (!initialized) return false;

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
    loadState,
    saveState
  };
})(window);

