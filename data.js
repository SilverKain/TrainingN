window.TrainingData = (() => {
  const STORAGE_KEY = "training-planner-v5";
  const LEGACY_STORAGE_KEYS = ["training-planner-v4"];
  const LEGACY_SAMPLE_IDS = new Set(["1", "2", "3"]);
  const seededExercises = Array.isArray(window.ExerciseDatabase) ? window.ExerciseDatabase : [];
  const AUGUST_2026_PLAN_ID = "august-2026-mon-wed-fri-balanced-10";
  const AUGUST_2026_PLAN_DATES = [
    "2026-08-05",
    "2026-08-07",
    "2026-08-10",
    "2026-08-12",
    "2026-08-14",
    "2026-08-17",
    "2026-08-19",
    "2026-08-21",
    "2026-08-24",
    "2026-08-26",
    "2026-08-28",
    "2026-08-31"
  ];
  const AUGUST_2026_PLAN_TEMPLATES = [
    [
      { exerciseId: "49", note: "Разминка 1/5: общий разогрев" },
      { exerciseId: "43", note: "Разминка 2/5: плечи и грудной отдел" },
      { exerciseId: "41", note: "Разминка 3/5: ноги и колени" },
      { exerciseId: "44", note: "Разминка 4/5: задняя линия" },
      { exerciseId: "37", note: "Разминка 5/5: корпус" },
      { exerciseId: "01", note: "Основной блок 1/5: грудь, трицепс, передняя дельта" },
      { exerciseId: "05", note: "Основной блок 2/5: спина, бицепс, задняя дельта" },
      { exerciseId: "13", note: "Основной блок 3/5: ноги и ягодицы" },
      { exerciseId: "18", note: "Основной блок 4/5: ягодицы и таз" },
      { exerciseId: "21", note: "Основной блок 5/5: кор и пресс" }
    ],
    [
      { exerciseId: "33", note: "Разминка 1/5: лёгкое кардио" },
      { exerciseId: "34", note: "Разминка 2/5: шея" },
      { exerciseId: "46", note: "Разминка 3/5: таз и ноги" },
      { exerciseId: "42", note: "Разминка 4/5: ягодицы и тазобедренные" },
      { exerciseId: "54", note: "Разминка 5/5: грудные и плечи" },
      { exerciseId: "07", note: "Основной блок 1/5: плечи и трицепс" },
      { exerciseId: "04", note: "Основной блок 2/5: спина и задняя цепь" },
      { exerciseId: "14", note: "Основной блок 3/5: ноги, ягодицы, кор" },
      { exerciseId: "10", note: "Основной блок 4/5: руки, бицепс" },
      { exerciseId: "20", note: "Основной блок 5/5: пресс" }
    ],
    [
      { exerciseId: "50", note: "Разминка 1/5: высокий шаг и кор" },
      { exerciseId: "35", note: "Разминка 2/5: локти и предплечья" },
      { exerciseId: "38", note: "Разминка 3/5: таз и поясница" },
      { exerciseId: "48", note: "Разминка 4/5: ягодицы и задняя линия" },
      { exerciseId: "55", note: "Разминка 5/5: широчайшие и бока" },
      { exerciseId: "02", note: "Основной блок 1/5: грудь и трицепс" },
      { exerciseId: "06", note: "Основной блок 2/5: верх спины и задние дельты" },
      { exerciseId: "17", note: "Основной блок 3/5: ягодицы и задняя поверхность бедра" },
      { exerciseId: "16", note: "Основной блок 4/5: голень" },
      { exerciseId: "24", note: "Основной блок 5/5: косые и поперечная мышца живота" }
    ]
  ];
  const firebaseStore = window.TrainingFirebase || null;

  const defaultData = {
    exercises: seededExercises,
    removedExerciseIds: [],
    schedule: {},
    appliedPlanIds: []
  };

  function createExerciseId(exercises = []) {
    const maxId = exercises.reduce((max, exercise) => {
      const match = String(exercise?.id || "").match(/^c(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    return `c${maxId + 1}`;
  }

  function compareExerciseIds(left, right) {
    const normalize = (value) => {
      const match = String(value || "").match(/^([a-z]+)(\d+)$/i);
      if (!match) return { prefix: "z", number: Number.MAX_SAFE_INTEGER, raw: String(value || "") };

      return {
        prefix: match[1].toLowerCase(),
        number: Number(match[2]),
        raw: String(value)
      };
    };

    const leftId = normalize(left);
    const rightId = normalize(right);

    if (leftId.prefix !== rightId.prefix) return leftId.prefix.localeCompare(rightId.prefix, "ru");
    if (leftId.number !== rightId.number) return leftId.number - rightId.number;
    return leftId.raw.localeCompare(rightId.raw, "ru");
  }

  function normalizeExercise(exercise) {
    return {
      id: String(exercise?.id || "").trim(),
      name: exercise?.name || "Без названия",
      image: exercise?.image || "",
      group: exercise?.group || "",
      muscles: exercise?.muscles || "",
      level: exercise?.level || "",
      equipment: exercise?.equipment || "",
      sets: String(Math.max(1, Number(exercise?.sets) || 1)),
      reps: exercise?.reps || "",
      timerSeconds: Math.max(0, Number(exercise?.timerSeconds) || 0),
      description: exercise?.description || ""
    };
  }

  function createPlannedScheduleItem(dateKey, entry, index) {
    const linked = seededExercises.find((exercise) => String(exercise?.id) === String(entry.exerciseId));
    if (!linked) return null;

    const totalSets = Math.max(1, Number(linked?.sets) || 1);

    return {
      id: `${AUGUST_2026_PLAN_ID}-${dateKey}-${index + 1}`,
      exerciseId: String(linked.id),
      name: linked.name || "Без названия",
      image: linked.image || "",
      sets: String(totalSets),
      totalSets,
      completedSets: 0,
      reps: linked.reps || "",
      timerSeconds: Math.max(0, Number(linked.timerSeconds) || 0),
      note: entry.note || "",
      completed: false
    };
  }

  function buildAugust2026PlanSchedule() {
    const schedule = {};

    AUGUST_2026_PLAN_DATES.forEach((dateKey, dateIndex) => {
      const template = AUGUST_2026_PLAN_TEMPLATES[dateIndex % AUGUST_2026_PLAN_TEMPLATES.length];
      schedule[dateKey] = template
        .map((entry, itemIndex) => createPlannedScheduleItem(dateKey, entry, itemIndex))
        .filter(Boolean);
    });

    return schedule;
  }

  function applySeededPlans(normalized) {
    normalized.appliedPlanIds = Array.isArray(normalized.appliedPlanIds) ? normalized.appliedPlanIds : [];
    if (normalized.appliedPlanIds.includes(AUGUST_2026_PLAN_ID)) return normalized;

    const augustPlanSchedule = buildAugust2026PlanSchedule();

    for (const [dateKey, items] of Object.entries(augustPlanSchedule)) {
      const existingItems = Array.isArray(normalized.schedule[dateKey]) ? normalized.schedule[dateKey] : [];
      if (!existingItems.length) {
        normalized.schedule[dateKey] = items.map((item) => ({ ...item }));
      }
    }

    normalized.appliedPlanIds.push(AUGUST_2026_PLAN_ID);
    return normalized;
  }

  function mergeExercises(savedExercises = [], removedExerciseIds = []) {
    const removedIds = new Set(
      Array.isArray(removedExerciseIds)
        ? removedExerciseIds.map((value) => String(value || "").trim()).filter(Boolean)
        : []
    );

    const merged = new Map(
      seededExercises
        .filter((exercise) => !removedIds.has(String(exercise.id)))
        .map((exercise) => [exercise.id, normalizeExercise(exercise)])
    );

    savedExercises.forEach((exercise) => {
      const normalized = normalizeExercise(exercise);
      if (LEGACY_SAMPLE_IDS.has(normalized.id)) return;
      if (!normalized.id) {
        normalized.id = createExerciseId(Array.from(merged.values()));
      }

      const previous = merged.get(normalized.id);
      merged.set(normalized.id, previous ? { ...previous, ...normalized } : normalized);
    });

    return Array.from(merged.values()).sort((a, b) => compareExerciseIds(a.id, b.id));
  }

  function normalizeState(source) {
    const normalized = {
      removedExerciseIds: Array.isArray(source?.removedExerciseIds)
        ? source.removedExerciseIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
      exercises: [],
      schedule: source?.schedule && typeof source.schedule === "object" ? source.schedule : {},
      appliedPlanIds: Array.isArray(source?.appliedPlanIds)
        ? source.appliedPlanIds.map((value) => String(value || "").trim()).filter(Boolean)
        : []
    };

    normalized.exercises = mergeExercises(
      Array.isArray(source?.exercises) ? source.exercises : [],
      normalized.removedExerciseIds
    );

    for (const [date, items] of Object.entries(normalized.schedule)) {
      normalized.schedule[date] = Array.isArray(items)
        ? items
            .map((item) => {
              const linked = normalized.exercises.find((exercise) => exercise.id === String(item?.exerciseId));
              if (!linked) return null;

              const totalSets = Math.max(1, Number(item?.totalSets || item?.sets || linked.sets) || 1);
              const completedSets = Math.min(totalSets, Math.max(0, Number(item?.completedSets) || 0));

              return {
                id: item?.id || crypto.randomUUID(),
                exerciseId: linked.id,
                name: linked.name,
                image: linked.image,
                sets: String(totalSets),
                totalSets,
                completedSets,
                reps: item?.reps || linked.reps || "",
                timerSeconds: Math.max(0, Number(item?.timerSeconds ?? linked.timerSeconds) || 0),
                note: item?.note || "",
                completed: completedSets >= totalSets
              };
            })
            .filter(Boolean)
        : [];
    }

    return applySeededPlans(normalized);
  }

  function getStoredPayload() {
    try {
      return (
        localStorage.getItem(STORAGE_KEY) ||
        LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
      );
    } catch {
      return null;
    }
  }

  function loadLocalState() {
    try {
      const saved = getStoredPayload();
      const parsed = saved ? JSON.parse(saved) : structuredClone(defaultData);
      return normalizeState(parsed);
    } catch {
      return normalizeState(structuredClone(defaultData));
    }
  }

  function saveLocalState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Unable to save state to localStorage:", error);
    }
  }

  async function loadState() {
    const localState = loadLocalState();

    if (!firebaseStore?.isConfigured?.()) {
      return localState;
    }

    try {
      const remoteState = await firebaseStore.loadState();
      if (!remoteState) {
        await firebaseStore.saveState(localState);
        return localState;
      }

      const normalizedRemoteState = normalizeState(remoteState);
      saveLocalState(normalizedRemoteState);
      return normalizedRemoteState;
    } catch (error) {
      console.error("Unable to load state from Firebase. Falling back to localStorage:", error);
      return localState;
    }
  }

  async function saveState(state) {
    saveLocalState(state);

    if (!firebaseStore?.isConfigured?.()) return false;

    try {
      await firebaseStore.saveState(state);
      return true;
    } catch (error) {
      console.error("Unable to save state to Firebase. Local copy is preserved:", error);
      return false;
    }
  }

  return {
    STORAGE_KEY,
    defaultData,
    createExerciseId,
    normalizeState,
    loadState,
    saveState
  };
})();
