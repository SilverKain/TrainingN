const {
  createExerciseId,
  loadState,
  saveState: saveTrainingState
} = window.TrainingData;

let state = loadState();
let currentMonth = startOfMonth(new Date());
const todayKey = toDateKey(new Date());
let selectedDate = todayKey;
let currentPage = "home";

let activeRestTimerId = null;
let restTimerInterval = null;
let restSecondsLeft = 30;

let activeExerciseTimerId = null;
let exerciseTimerInterval = null;
let exerciseSecondsLeft = 0;

const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const dayExercises = document.getElementById("dayExercises");
const exerciseList = document.getElementById("exerciseList");
const exerciseSelect = document.getElementById("exerciseSelect");
const recentExercises = document.getElementById("recentExercises");
const progressHistory = document.getElementById("progressHistory");
const workoutSessionCard = document.getElementById("workoutSessionCard");
const workoutTodayList = document.getElementById("workoutTodayList");
const workoutSummary = document.getElementById("workoutSummary");
const pageButtons = document.querySelectorAll("[data-page-btn]");
const pages = document.querySelectorAll("[data-page]");
const exerciseForm = document.getElementById("exerciseForm");

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById("nextMonthBtn").addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  selectedDate = todayKey;
  currentMonth = startOfMonth(new Date());
  renderAll();
});

document.getElementById("goTodayBtn").addEventListener("click", () => switchPage("calendar"));

document.querySelectorAll("[data-open-page]").forEach((button) => {
  button.addEventListener("click", () => switchPage(button.getAttribute("data-open-page")));
});

pageButtons.forEach((button) => {
  button.addEventListener("click", () => switchPage(button.getAttribute("data-page-btn")));
});

exerciseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("exerciseNameInput").value.trim();
  const image = document.getElementById("exerciseImageInput").value.trim();
  const group = document.getElementById("exerciseGroupInput").value.trim();
  const equipment = document.getElementById("exerciseEquipmentInput").value.trim();
  const sets = document.getElementById("exerciseSetsInput").value.trim();
  const reps = document.getElementById("exerciseRepsInput").value.trim();
  const timerSeconds = document.getElementById("exerciseTimerInput").value.trim();
  const description = document.getElementById("exerciseDescriptionInput").value.trim();

  if (!name) return;

  state.exercises.unshift({
    id: createExerciseId(state.exercises),
    name,
    image,
    group,
    muscles: "",
    level: "custom",
    equipment,
    sets: String(Math.max(1, Number(sets) || 1)),
    reps,
    timerSeconds: Math.max(0, Number(timerSeconds) || 0),
    description
  });

  saveState();
  exerciseForm.reset();
  renderAll();
  switchPage("library");
});

document.getElementById("scheduleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const exerciseId = exerciseSelect.value;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;

  state.schedule[selectedDate] ??= [];
  state.schedule[selectedDate].push({
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    name: exercise.name,
    image: exercise.image || "",
    sets: exercise.sets || "1",
    totalSets: Math.max(1, Number(exercise.sets) || 1),
    completedSets: 0,
    reps: exercise.reps || "",
    timerSeconds: Math.max(0, Number(exercise.timerSeconds) || 0),
    note: document.getElementById("noteInput").value.trim(),
    completed: false
  });

  saveState();
  event.target.reset();
  renderAll();
  switchPage("calendar");
});

document.getElementById("clearDayBtn").addEventListener("click", () => {
  delete state.schedule[selectedDate];
  stopRestTimer();
  stopExerciseTimer();
  saveState();
  renderAll();
});

document.getElementById("startWorkoutBtn").addEventListener("click", () => {
  if (!(state.schedule[selectedDate] ?? []).length) return;
  switchPage("calendar");
  workoutSessionCard.classList.add("visible");
  renderWorkoutSession();
  workoutSessionCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

function switchPage(pageName) {
  currentPage = pageName;
  pages.forEach((page) => page.classList.toggle("active", page.getAttribute("data-page") === pageName));
  pageButtons.forEach((button) => button.classList.toggle("active", button.getAttribute("data-page-btn") === pageName));
}

function saveState() {
  saveTrainingState(state);
}

function renderAll() {
  renderCalendar();
  renderDayPlan();
  renderExerciseLibrary();
  renderExerciseOptions();
  renderSummary();
  renderProgress();
  renderWorkoutSession();
  selectedDateLabel.textContent = formatFullDate(selectedDate);
}

function renderSummary() {
  const todayItems = state.schedule[todayKey] ?? [];
  const activeDays = Object.values(state.schedule).filter((items) => items.length).length;
  document.getElementById("todaySummaryCount").textContent = `${todayItems.length} упражнений`;
  document.getElementById("exerciseSummaryCount").textContent = `${state.exercises.length} упражнений`;
  document.getElementById("activeDaysCount").textContent = `${activeDays} дней`;
}

function renderProgress() {
  const todayItems = state.schedule[todayKey] ?? [];
  const plannedDays = Object.keys(state.schedule).filter((key) => (state.schedule[key] ?? []).length).length;
  const completedDays = getCompletedHistoryByDate();

  document.getElementById("metricExercises").textContent = state.exercises.length;
  document.getElementById("metricToday").textContent = todayItems.length;
  document.getElementById("metricDays").textContent = plannedDays;

  if (!state.exercises.length) {
    recentExercises.innerHTML = '<div class="empty-state">Пока нет упражнений в базе.</div>';
  } else {
    recentExercises.innerHTML = getOrderedExercises().slice(0, 3).map(renderExerciseCard).join("");
    bindExerciseRemoveButtons(recentExercises);
  }

  if (!completedDays.length) {
    progressHistory.innerHTML = '<div class="empty-state">Пока нет завершённых упражнений по дням.</div>';
    return;
  }

  progressHistory.innerHTML = completedDays.map(({ dateKey, items }) => `
    <article class="progress-day-card">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(formatFullDate(dateKey))}</strong>
          <div class="planned-meta">${items.length} ${pluralizeExercises(items.length)}</div>
        </div>
        <span class="status-badge status-done">Сделано</span>
      </div>
      <div class="progress-day-list">
        ${items.map((item) => `
          <div class="progress-day-item">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="muted">
              Подходы: ${item.completedSets}/${item.totalSets}
              ${item.reps ? ` · Повторы: ${escapeHtml(item.reps)}` : ""}
            </span>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderCalendar() {
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
  monthLabel.textContent = capitalize(formatter.format(currentMonth));
  calendarGrid.innerHTML = "";

  const firstDay = startOfMonth(currentMonth);
  const month = firstDay.getMonth();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - startOffset);

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + i);
    const key = toDateKey(day);
    const plannedCount = state.schedule[key]?.length ?? 0;

    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    if (day.getMonth() !== month) dayButton.classList.add("muted-day");
    if (key === selectedDate) dayButton.classList.add("selected");
    if (key === todayKey) dayButton.classList.add("today");

    dayButton.innerHTML = `
      <div class="calendar-day-number">${day.getDate()}</div>
      ${plannedCount ? `<div class="calendar-day-count">${plannedCount} упр.</div>` : ""}
    `;

    dayButton.addEventListener("click", () => {
      selectedDate = key;
      stopRestTimer();
      stopExerciseTimer();
      renderAll();
    });

    calendarGrid.appendChild(dayButton);
  }
}

function renderDayPlan() {
  const items = state.schedule[selectedDate] ?? [];

  if (!items.length) {
    dayExercises.innerHTML = '<div class="empty-state">На выбранный день пока ничего не запланировано.</div>';
    return;
  }

  dayExercises.innerHTML = items.map((item) => `
    <article class="planned-card ${item.completed ? "done-card" : ""}">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="planned-meta">
            Подходы: ${item.completedSets}/${item.totalSets}
            ${item.reps ? ` · Повторы: ${escapeHtml(item.reps)}` : ""}
            ${item.timerSeconds ? ` · Таймер: ${item.timerSeconds} сек` : ""}
          </div>
        </div>
        <span class="status-badge ${item.completed ? "status-done" : "status-pending"}">
          ${item.completed ? "Сделано" : "Осталось"}
        </span>
      </div>
      ${item.image ? `<img class="exercise-image" src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.name)}">` : ""}
      ${item.note ? `<p class="exercise-description">${escapeHtml(item.note)}</p>` : ""}
      <div class="card-actions">
        <button class="text-btn" type="button" data-remove-schedule="${item.id}">Удалить</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-remove-schedule]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-schedule");
      state.schedule[selectedDate] = (state.schedule[selectedDate] ?? []).filter((item) => item.id !== id);
      if (!state.schedule[selectedDate].length) delete state.schedule[selectedDate];
      saveState();
      renderAll();
    });
  });
}

function renderWorkoutSession() {
  const items = state.schedule[selectedDate] ?? [];

  if (!items.length) {
    workoutSessionCard.classList.remove("visible");
    workoutTodayList.innerHTML = "";
    workoutSummary.textContent = "Сделано 0 • Осталось 0";
    return;
  }

  const completedCount = items.filter((item) => item.completed).length;
  const remainingCount = items.length - completedCount;
  workoutSummary.textContent = `Сделано ${completedCount} • Осталось ${remainingCount}`;

  workoutTodayList.innerHTML = items.map((item) => `
    <article class="planned-card ${item.completed ? "done-card" : ""}">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="planned-meta">
            Подходы: ${item.completedSets}/${item.totalSets}
            ${item.reps ? ` · Повторы: ${escapeHtml(item.reps)}` : ""}
            ${item.timerSeconds ? ` · Таймер: ${item.timerSeconds} сек` : ""}
          </div>
        </div>
        <span class="status-badge ${item.completed ? "status-done" : "status-pending"}">
          ${item.completed ? "Упражнение завершено" : "В процессе"}
        </span>
      </div>
      ${item.image ? `<img class="exercise-image" src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.name)}">` : ""}
      ${item.note ? `<p class="exercise-description">${escapeHtml(item.note)}</p>` : ""}
      ${renderSetsProgress(item)}
      ${renderExerciseInnerTimer(item)}
      <div class="exercise-timer-note muted">
        ${item.completed ? "Все подходы завершены." : `Выполнено подходов: ${item.completedSets} из ${item.totalSets}.`}
      </div>
      <div class="card-actions-center">
        <button
          class="${item.completed ? "btn-secondary" : "btn-success"}"
          type="button"
          data-complete-set="${item.id}"
          ${item.completed ? "disabled" : ""}
        >
          ${item.completed ? "Упражнение завершено" : "Выполнить подход"}
        </button>
      </div>
      ${item.completedSets > 0 ? `
        <div class="card-actions-center">
          <button class="text-btn" type="button" data-reset-exercise="${item.id}">Сбросить прогресс упражнения</button>
        </div>
      ` : ""}
    </article>
  `).join("");

  workoutTodayList.querySelectorAll("[data-complete-set]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-complete-set");
      const target = (state.schedule[selectedDate] ?? []).find((item) => item.id === id);
      if (!target) return;

      target.completedSets = Math.min(target.totalSets, target.completedSets + 1);
      target.completed = target.completedSets >= target.totalSets;

      if (target.timerSeconds > 0) {
        startExerciseTimer(id, target.timerSeconds);
      }

      if (!target.completed) {
        startRestTimer(id);
      } else if (activeRestTimerId === id) {
        stopRestTimer();
      }

      saveState();
      renderAll();
      workoutSessionCard.classList.add("visible");
    });
  });

  workoutTodayList.querySelectorAll("[data-reset-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-reset-exercise");
      const target = (state.schedule[selectedDate] ?? []).find((item) => item.id === id);
      if (!target) return;

      target.completedSets = 0;
      target.completed = false;
      if (activeRestTimerId === id) stopRestTimer();
      if (activeExerciseTimerId === id) stopExerciseTimer();
      saveState();
      renderAll();
      workoutSessionCard.classList.add("visible");
    });
  });

  workoutTodayList.querySelectorAll("[data-skip-rest]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-skip-rest");
      if (activeRestTimerId === id) {
        stopRestTimer();
        renderWorkoutSession();
      }
    });
  });

  workoutTodayList.querySelectorAll("[data-start-exercise-timer]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-start-exercise-timer");
      const target = (state.schedule[selectedDate] ?? []).find((item) => item.id === id);
      if (!target) return;
      startExerciseTimer(id, target.timerSeconds || getExerciseDuration(target));
      renderWorkoutSession();
    });
  });
}

function renderSetsProgress(item) {
  const dots = Array.from({ length: item.totalSets }, (_, index) => {
    const setNumber = index + 1;
    const isDone = setNumber <= item.completedSets;
    const isCurrent = !item.completed && setNumber === item.completedSets + 1;
    return `
      <div class="set-dot ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
        ${isDone ? "✓" : setNumber}
      </div>
    `;
  }).join("");

  return `
    <div class="sets-progress">
      <div class="sets-progress-top">
        <span class="sets-progress-label">Подходы</span>
        <span class="sets-progress-value">${item.completedSets}/${item.totalSets}</span>
      </div>
      <div class="sets-dots">${dots}</div>
    </div>
  `;
}

function renderExerciseInnerTimer(item) {
  const parts = [];

  if (activeRestTimerId === item.id && restSecondsLeft > 0) {
    parts.push(`
      <div class="rest-timer">
        <div>
          <strong>Отдых между подходами</strong>
          <p class="muted">Следующий подход можно начинать через ${restSecondsLeft} сек.</p>
        </div>
        <div class="rest-timer-side">
          <div class="rest-timer-value">${restSecondsLeft}</div>
          <button class="btn-secondary" type="button" data-skip-rest="${item.id}">Пропустить</button>
        </div>
      </div>
    `);
  }

  if (Number(item.timerSeconds) > 0) {
    const duration = getExerciseDuration(item);
    const isActive = activeExerciseTimerId === item.id && exerciseSecondsLeft > 0;
    parts.push(`
      <div class="rest-timer">
        <div>
          <strong>Таймер упражнения</strong>
          <p class="muted">Для этого упражнения можно запустить встроенный таймер.</p>
        </div>
        <div class="rest-timer-side">
          <div class="rest-timer-value">${isActive ? exerciseSecondsLeft : duration}</div>
          <button class="${isActive ? "btn-secondary" : "btn-primary"}" type="button" data-start-exercise-timer="${item.id}">
            ${isActive ? "Идёт таймер" : "Запустить таймер"}
          </button>
        </div>
      </div>
    `);
  }

  return parts.join("");
}

function startRestTimer(itemId) {
  stopRestTimer(false);
  activeRestTimerId = itemId;
  restSecondsLeft = 30;
  renderWorkoutSession();

  restTimerInterval = setInterval(() => {
    restSecondsLeft -= 1;
    renderWorkoutSession();
    if (restSecondsLeft <= 0) {
      stopRestTimer();
      renderWorkoutSession();
    }
  }, 1000);
}

function stopRestTimer(resetValue = true) {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = null;
  if (resetValue) restSecondsLeft = 30;
  activeRestTimerId = null;
}

function startExerciseTimer(itemId, duration) {
  if (!duration) return;
  stopExerciseTimer(false);
  activeExerciseTimerId = itemId;
  exerciseSecondsLeft = duration;
  renderWorkoutSession();

  exerciseTimerInterval = setInterval(() => {
    exerciseSecondsLeft -= 1;
    renderWorkoutSession();
    if (exerciseSecondsLeft <= 0) {
      stopExerciseTimer();
      renderWorkoutSession();
    }
  }, 1000);
}

function stopExerciseTimer(resetValue = true) {
  if (exerciseTimerInterval) clearInterval(exerciseTimerInterval);
  exerciseTimerInterval = null;
  if (resetValue) exerciseSecondsLeft = 0;
  activeExerciseTimerId = null;
}

function renderExerciseLibrary() {
  if (!state.exercises.length) {
    exerciseList.innerHTML = '<div class="empty-state">База упражнений пока пуста.</div>';
    return;
  }

  exerciseList.innerHTML = getExercisesSortedById().map(renderExerciseCard).join("");
  bindExerciseRemoveButtons(exerciseList);
}

function renderExerciseCard(exercise) {
  const levelLabel = getLevelLabel(exercise.level);
  const equipmentLabel = exercise.equipment
    ? `Инвентарь: ${escapeHtml(exercise.equipment)}`
    : "Инвентарь не указан";
  const musclesLabel = exercise.muscles ? `Мышцы: ${escapeHtml(exercise.muscles)}` : "";
  const removableAction = isCustomExercise(exercise)
    ? `<button class="text-btn" type="button" data-remove-exercise="${escapeAttribute(exercise.id)}">Удалить</button>`
    : '<span class="seed-badge">Базовое упражнение</span>';

  return `
    <article class="exercise-card">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(exercise.name)}</strong>
          <div class="exercise-id">ID: ${escapeHtml(exercise.id)}</div>
        </div>
        <div class="card-tags">
          <span class="tag">${escapeHtml(exercise.group || "Без группы")}</span>
          ${levelLabel ? `<span class="tag">${escapeHtml(levelLabel)}</span>` : ""}
        </div>
      </div>
      <div class="exercise-meta">
        ${equipmentLabel}
        · Подходы: ${escapeHtml(exercise.sets)}
        ${exercise.reps ? ` · Повторы: ${escapeHtml(exercise.reps)}` : ""}
        ${exercise.timerSeconds ? ` · Таймер: ${exercise.timerSeconds} сек` : ""}
      </div>
      ${musclesLabel ? `<p class="exercise-muscles">${musclesLabel}</p>` : ""}
      ${exercise.image ? `<img class="exercise-image" src="${escapeAttribute(exercise.image)}" alt="${escapeAttribute(exercise.name)}">` : ""}
      ${exercise.description ? `<p class="exercise-description">${escapeHtml(exercise.description)}</p>` : ""}
      <div class="card-actions">
        ${removableAction}
      </div>
    </article>
  `;
}

function bindExerciseRemoveButtons(scope) {
  scope.querySelectorAll("[data-remove-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-exercise");
      const targetExercise = state.exercises.find((exercise) => exercise.id === id);
      if (!targetExercise) return;

      state.exercises = state.exercises.filter((exercise) => exercise.id !== id);
      if (!isCustomExercise(targetExercise)) {
        state.removedExerciseIds ??= [];
        if (!state.removedExerciseIds.includes(id)) state.removedExerciseIds.push(id);
      }

      for (const [date, items] of Object.entries(state.schedule)) {
        const filtered = items.filter((item) => item.exerciseId !== id);
        if (filtered.length) state.schedule[date] = filtered;
        else delete state.schedule[date];
      }

      saveState();
      renderAll();
    });
  });
}

function renderExerciseOptions() {
  if (!state.exercises.length) {
    exerciseSelect.innerHTML = '<option value="">Сначала добавьте упражнение в базу</option>';
    return;
  }

  exerciseSelect.innerHTML = getExercisesSortedById()
    .map((exercise) => `<option value="${exercise.id}">ID ${escapeHtml(exercise.id)} — ${escapeHtml(exercise.name)}</option>`)
    .join("");
}

function getExercisesSortedById() {
  return state.exercises
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "ru", { numeric: true }));
}

function getOrderedExercises() {
  return state.exercises.slice().sort((a, b) =>
    String(a.group || "").localeCompare(String(b.group || ""), "ru") ||
    String(a.name || "").localeCompare(String(b.name || ""), "ru")
  );
}

function getCompletedHistoryByDate() {
  return Object.entries(state.schedule)
    .map(([dateKey, items]) => ({
      dateKey,
      items: items.filter((item) => item.completed)
    }))
    .filter(({ items }) => items.length)
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}

function getLevelLabel(level) {
  const labels = {
    easy: "Лёгкий",
    medium: "Средний",
    hard: "Сложный",
    custom: "Свое"
  };

  return labels[level] || "";
}

function isCustomExercise(exercise) {
  return /^c\d+$/i.test(String(exercise?.id || ""));
}

function getExerciseDuration(item) {
  if (Number(item.timerSeconds) > 0) return Number(item.timerSeconds);
  const combinedText = `${String(item.reps || "").trim()} ${String(item.note || "").trim()}`;
  const match = combinedText.match(/(\d+)/);
  return match ? Number(match[1]) : 30;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pluralizeExercises(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return "упражнение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "упражнения";
  return "упражнений";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

renderAll();
switchPage(currentPage);
