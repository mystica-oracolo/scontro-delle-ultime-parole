import Trie from "./trie.js";
import { CATEGORIES } from "./categories/index.js";
import { generateGrid } from "./grid-generator.js";
import { areAdjacent, findAllWords, scoreForWord } from "./path-finder.js";
import audio from "./audio-manager.js";
import EXTRA_WORDS from "./dictionary-extra.js";

// Il vocabolario extra ora e' un dizionario italiano completo (~526.000
// forme flesse). Costruire un Trie da zero con tutte queste parole ad ogni
// round sarebbe troppo lento su mobile, quindi lo trasformiamo in un Set
// UNA SOLA VOLTA al caricamento del modulo: il controllo isWord() su un Set
// e' O(1) e non richiede prefissi (il trie serve solo per generare la
// griglia/trovare le parole di categoria, non per il vocabolario extra).
const EXTRA_WORDS_SET = new Set(EXTRA_WORDS);

// Moltiplicatore per le parole "bonus" della categoria: quelle NON piantate
// intenzionalmente ma comunque presenti nel vocabolario della categoria
// scelta, formatesi per caso nel riempimento della griglia.
const BONUS_MULTIPLIER = 3;

const TICK_START_SECONDS = 10; // da quando iniziano i tick del timer
const TICK_URGENT_SECONDS = 3; // da quando i tick diventano più acuti/urgenti
const DIFFICULTY_KEY = "scontro_difficulty";

const DIFFICULTIES = {
  facile: { size: 4, seconds: 75, wordsToPlant: 6, label: "Facile" },
  normale: { size: 5, seconds: 90, wordsToPlant: 8, label: "Normale" },
  difficile: { size: 6, seconds: 120, wordsToPlant: 10, label: "Difficile" },
};

function loadDifficulty() {
  const saved = localStorage.getItem(DIFFICULTY_KEY);
  return DIFFICULTIES[saved] ? saved : "normale";
}

function saveDifficulty(id) {
  localStorage.setItem(DIFFICULTY_KEY, id);
}

const app = document.getElementById("app");

let state = {
  screen: "category-select",
  difficulty: loadDifficulty(),
  category: null,
  trie: null, // trie "di gioco": categoria + vocabolario extra, usato per validare le parole
  categoryWordsSet: null, // Set delle parole della categoria (piantate + bonus)
  plantedSet: null, // Set delle parole effettivamente piantate in griglia
  grid: null,
  plantedWords: [],
  allFindableWords: null, // Map parola -> path (solo categoria), calcolato a inizio round
  foundWords: new Map(), // parola -> { points, type: "categoria" | "bonus" | "extra" }
  score: 0,
  roundSeconds: DIFFICULTIES[loadDifficulty()].seconds,
  timeLeft: DIFFICULTIES[loadDifficulty()].seconds,
  timerHandle: null,
  selection: [], // array di [r,c] durante il drag corrente
  pointerDown: false,
};

function render() {
  if (state.screen === "category-select") renderCategorySelect();
  else if (state.screen === "playing") renderGame();
  else if (state.screen === "results") renderResults();
}

// ---------- Schermata selezione categoria ----------

function renderCategorySelect() {
  app.innerHTML = `
    <header class="brand">
      ${renderSoundToggle()}
      <h1>Scontro delle Ultime Parole</h1>
      <p class="tagline">Trova le parole della categoria — le bonus valgono ×${BONUS_MULTIPLIER}! Vanno bene anche altre parole italiane.</p>
    </header>

    <div class="difficulty-select" role="group" aria-label="Difficoltà">
      ${Object.entries(DIFFICULTIES)
        .map(
          ([id, d]) => `
        <button
          class="difficulty-btn${state.difficulty === id ? " active" : ""}"
          data-diff="${id}"
        >${d.label}<small>${d.size}×${d.size} · ${d.seconds}s</small></button>`
        )
        .join("")}
    </div>

    <div class="category-grid">
      ${CATEGORIES.map(
        (c) => `
        <button class="category-card" data-id="${c.id}">
          <span class="category-icon">${c.icon}</span>
          <span class="category-label">${c.label}</span>
        </button>`
      ).join("")}
    </div>
  `;

  attachSoundToggle();

  app.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.difficulty = btn.dataset.diff;
      saveDifficulty(state.difficulty);
      app.querySelectorAll(".difficulty-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  app.querySelectorAll(".category-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.unlock();
      startRound(btn.dataset.id);
    });
  });
}

function renderSoundToggle() {
  return `<button id="sound-toggle" class="sound-toggle" aria-label="Attiva/disattiva suoni">${
    audio.isMuted() ? "🔇" : "🔊"
  }</button>`;
}

function attachSoundToggle() {
  const btn = document.getElementById("sound-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    audio.unlock();
    const muted = audio.toggleMute();
    btn.textContent = muted ? "🔇" : "🔊";
  });
}

// ---------- Avvio round ----------

function startRound(categoryId) {
  const diff = DIFFICULTIES[state.difficulty];
  const category = CATEGORIES.find((c) => c.id === categoryId);

  // Trie della sola categoria: usato per generare la griglia e per la
  // schermata risultati (rivela solo le parole in tema, non tutto il
  // vocabolario extra).
  const categoryTrie = new Trie();
  category.words.forEach((w) => categoryTrie.insert(w));

  // "Trie" di gioco: categoria + vocabolario extra + parole delle ALTRE
  // categorie (es. mentre giochi "Colori" contano anche le parole di
  // "Animali", "Sport", ecc.) — così il vocabolario disponibile è molto
  // più ampio di quello della sola categoria scelta. Qui serve solo
  // isWord() (mai hasPrefix), quindi usiamo Set invece di un vero Trie:
  // con ~526.000 parole extra è molto più leggero da ricostruire ad ogni
  // round (l'unico pezzo pesante, EXTRA_WORDS_SET, è già pronto una volta
  // sola a livello di modulo).
  const categoryWordsSet = new Set(category.words);
  const otherCategoriesSet = new Set();
  CATEGORIES.forEach((c) => {
    if (c.id !== category.id) c.words.forEach((w) => otherCategoriesSet.add(w));
  });
  const trie = {
    isWord: (w) =>
      categoryWordsSet.has(w) ||
      otherCategoriesSet.has(w) ||
      EXTRA_WORDS_SET.has(w),
  };

  const { grid, plantedWords } = generateGrid(category, diff.size, diff.wordsToPlant);
  const allFindableWords = findAllWords(grid, categoryTrie, diff.size, diff.size + 3);

  state = {
    ...state,
    screen: "playing",
    category,
    trie,
    categoryWordsSet,
    plantedSet: new Set(plantedWords.map((p) => p.word)),
    grid,
    gridSize: diff.size,
    plantedWords,
    allFindableWords,
    foundWords: new Map(),
    score: 0,
    roundSeconds: diff.seconds,
    timeLeft: diff.seconds,
    selection: [],
    pointerDown: false,
  };

  render();
  startTimer();
}

/**
 * Classifica una parola valida trovata dal giocatore e ne calcola il punteggio.
 * - "categoria": una delle parole piantate intenzionalmente -> punteggio normale
 * - "bonus": parola della categoria presente per caso ma non piantata -> punteggio triplo
 * - "extra": parola del vocabolario generale, fuori tema -> punteggio normale
 */
function classifyWord(word) {
  const base = scoreForWord(word);
  if (state.categoryWordsSet.has(word)) {
    if (state.plantedSet.has(word)) return { points: base, type: "categoria" };
    return { points: base * BONUS_MULTIPLIER, type: "bonus" };
  }
  return { points: base, type: "extra" };
}

function startTimer() {
  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(() => {
    state.timeLeft -= 1;
    updateTimerDisplay();
    if (state.timeLeft <= TICK_START_SECONDS && state.timeLeft > 0) {
      audio.playTick(state.timeLeft <= TICK_URGENT_SECONDS);
    }
    if (state.timeLeft <= 0) {
      clearInterval(state.timerHandle);
      endRound();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById("time-left");
  if (el) el.textContent = state.timeLeft;
  const bar = document.getElementById("time-bar");
  if (bar) bar.style.width = `${(state.timeLeft / state.roundSeconds) * 100}%`;
}

function endRound() {
  audio.playRoundEnd();
  state.screen = "results";
  render();
}

// ---------- Schermata di gioco ----------

function renderGame() {
  const { category, grid } = state;

  app.innerHTML = `
    <header class="game-header">
      <div class="category-pill">${category.icon} ${category.label}</div>
      <div class="difficulty-pill">${DIFFICULTIES[state.difficulty].label}</div>
      <div class="timer">
        <div class="timer-bar-track"><div id="time-bar" class="timer-bar-fill"></div></div>
        <span id="time-left">${state.timeLeft}</span>s
      </div>
      <div class="score">Punti: <span id="score-value">${state.score}</span></div>
      ${renderSoundToggle()}
    </header>

    <div class="board-wrap">
      <svg id="trail" class="trail-svg"></svg>
      <div id="grid" class="grid" style="--size:${state.gridSize}">
        ${grid
          .map((row, r) =>
            row
              .map(
                (letter, c) =>
                  `<div class="cell" data-r="${r}" data-c="${c}"><span>${letter}</span></div>`
              )
              .join("")
          )
          .join("")}
      </div>
    </div>

    <div class="found-panel">
      <h2>Trovate (<span id="found-count">0</span>)</h2>
      <ul id="found-list"></ul>
    </div>
  `;

  updateTimerDisplay();
  attachBoardEvents();
  attachSoundToggle();
}

function attachBoardEvents() {
  const gridEl = document.getElementById("grid");

  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const cellEl = el && el.closest(".cell");
    if (!cellEl) return null;
    return [Number(cellEl.dataset.r), Number(cellEl.dataset.c)];
  };

  const onDown = (x, y) => {
    audio.unlock();
    const cell = cellFromPoint(x, y);
    if (!cell) return;
    state.pointerDown = true;
    state.selection = [cell];
    renderSelection();
  };

  const onMove = (x, y) => {
    if (!state.pointerDown) return;
    const cell = cellFromPoint(x, y);
    if (!cell) return;

    const last = state.selection[state.selection.length - 1];
    if (last && last[0] === cell[0] && last[1] === cell[1]) return;

    const alreadyIn = state.selection.some((s) => s[0] === cell[0] && s[1] === cell[1]);
    if (alreadyIn) {
      // Permette di "tornare indietro" sul percorso già tracciato.
      const idx = state.selection.findIndex((s) => s[0] === cell[0] && s[1] === cell[1]);
      state.selection = state.selection.slice(0, idx + 1);
      renderSelection();
      return;
    }

    if (!last || !areAdjacent(last, cell)) return;
    state.selection.push(cell);
    renderSelection();
  };

  const onUp = () => {
    if (!state.pointerDown) return;
    state.pointerDown = false;
    submitSelection();
  };

  gridEl.addEventListener("pointerdown", (e) => onDown(e.clientX, e.clientY));
  gridEl.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("pointerup", onUp);
  gridEl.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  gridEl.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  window.addEventListener("touchend", onUp);
}

function renderSelection() {
  document.querySelectorAll(".cell.selected").forEach((el) => el.classList.remove("selected"));
  state.selection.forEach(([r, c]) => {
    const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (el) el.classList.add("selected");
  });
  drawTrail();
}

function drawTrail() {
  const svg = document.getElementById("trail");
  if (!svg) return;
  if (state.selection.length < 2) {
    svg.innerHTML = "";
    return;
  }
  const points = state.selection.map(([r, c]) => {
    const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    const rect = el.getBoundingClientRect();
    const boardRect = document.getElementById("grid").getBoundingClientRect();
    return [
      rect.left + rect.width / 2 - boardRect.left,
      rect.top + rect.height / 2 - boardRect.top,
    ];
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  svg.innerHTML = `<path d="${d}" class="trail-path" />`;
}

function currentWord() {
  return state.selection.map(([r, c]) => state.grid[r][c]).join("");
}

function submitSelection() {
  const word = currentWord();
  const cellsEls = document.querySelectorAll(".cell.selected");

  const isValid = word.length >= 3 && state.trie.isWord(word);
  const isNew = isValid && !state.foundWords.has(word);

  if (isNew) {
    const { points, type } = classifyWord(word);
    state.foundWords.set(word, { points, type });
    state.score += points;
    audio.playFound(points);
    flashCells(cellsEls, type === "bonus" ? "bonus" : "correct");
    updateFoundList();
    document.getElementById("score-value").textContent = state.score;
  } else if (isValid && !isNew) {
    audio.playDuplicate();
    flashCells(cellsEls, "duplicate");
  } else {
    audio.playInvalid();
    flashCells(cellsEls, "invalid");
  }

  state.selection = [];
  setTimeout(() => {
    document.querySelectorAll(".cell.selected").forEach((el) => el.classList.remove("selected"));
    const svg = document.getElementById("trail");
    if (svg) svg.innerHTML = "";
  }, 250);
}

function flashCells(cellsEls, className) {
  cellsEls.forEach((el) => el.classList.add(className));
  setTimeout(() => cellsEls.forEach((el) => el.classList.remove(className)), 400);
}

function wordBadge(type) {
  if (type === "bonus") return ` <span class="tag tag-bonus">×${BONUS_MULTIPLIER}</span>`;
  if (type === "extra") return ` <span class="tag tag-extra">extra</span>`;
  return "";
}

function updateFoundList() {
  const list = document.getElementById("found-list");
  const words = [...state.foundWords.entries()].sort((a, b) => b[1].points - a[1].points);
  list.innerHTML = words
    .map(
      ([w, { points, type }]) =>
        `<li class="word-${type}"><span>${w}${wordBadge(type)}</span><strong>+${points}</strong></li>`
    )
    .join("");
  document.getElementById("found-count").textContent = words.length;
}

// ---------- Schermata risultati ----------

function renderResults() {
  const { category, allFindableWords, foundWords, score } = state;
  const missed = [...allFindableWords.keys()]
    .filter((w) => !foundWords.has(w))
    .sort((a, b) => b.length - a.length);

  app.innerHTML = `
    <div class="results">
      <h1>Tempo scaduto!</h1>
      <p class="results-category">${category.icon} ${category.label}</p>
      <div class="results-score">${score} punti</div>

      <div class="results-columns">
        <div>
          <h2>Trovate (${foundWords.size})</h2>
          <ul class="results-list found">
            ${[...foundWords.entries()]
              .map(
                ([w, { points, type }]) =>
                  `<li class="word-${type}">${w}${wordBadge(type)} <strong>+${points}</strong></li>`
              )
              .join("") || "<li class='empty'>Nessuna parola trovata</li>"}
          </ul>
        </div>
        <div>
          <h2>Non trovate (${missed.length})</h2>
          <ul class="results-list missed">
            ${missed.map((w) => `<li>${w}</li>`).join("") || "<li class='empty'>Le hai trovate tutte!</li>"}
          </ul>
        </div>
      </div>

      <div class="results-actions">
        <button id="play-again">Rigioca (stessa categoria)</button>
        <button id="change-category" class="secondary">Cambia categoria</button>
      </div>
    </div>
  `;

  document.getElementById("play-again").addEventListener("click", () => startRound(state.category.id));
  document.getElementById("change-category").addEventListener("click", () => {
    state.screen = "category-select";
    render();
  });
}

render();
