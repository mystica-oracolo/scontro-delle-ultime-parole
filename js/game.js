import Trie from "./trie.js";
import { CATEGORIES } from "./categories/index.js";
import { generateGrid, createSeededRng } from "./grid-generator.js";
import { areAdjacent, findAllWords, scoreForWord } from "./path-finder.js";
import audio from "./audio-manager.js";
import EXTRA_WORDS from "./dictionary-extra.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import * as duel from "./multiplayer.js";

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
const COMBO_WINDOW_MS = 4000; // finestra entro cui due parole trovate contano come "combo"
const DIFFICULTY_KEY = "scontro_difficulty";
const HISTORY_KEY = "scontro_history";
const HISTORY_MAX = 50; // partite conservate
const WORD_STATS_KEY = "scontro_word_records"; // record assoluti (tutte le categorie/difficoltà)
const CATEGORY_BG_BASE = "img/backgrounds/"; // foto a tema per categoria (card + sfondo di gioco)

function categoryBgStyle(categoryId) {
  return `background-image: url('${CATEGORY_BG_BASE}${categoryId}.jpg')`;
}

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

// ---------- Storico partite (localStorage) ----------

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Miglior punteggio già registrato per una combinazione categoria+difficoltà
// (usato per rilevare un nuovo record PRIMA di salvare la partita appena
// conclusa, altrimenti la partita corrente "batterebbe" sempre se stessa).
function getBestScore(categoryId, difficulty) {
  const best = loadHistory()
    .filter((h) => h.categoryId === categoryId && h.difficulty === difficulty)
    .reduce((max, h) => Math.max(max, h.score), 0);
  return best;
}

function saveRoundToHistory(entry) {
  const history = loadHistory();
  history.unshift(entry); // più recenti in cima
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
}

// ---------- Record "parola migliore" / "parola più lunga" (assoluti, come
// nella schermata di recap di Ruzzle) ----------

function loadWordRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(WORD_STATS_KEY) || "{}");
    return {
      bestWord: raw.bestWord || null, // { word, points }
      longestWord: raw.longestWord || null, // { word, length }
    };
  } catch {
    return { bestWord: null, longestWord: null };
  }
}

// Confronta la migliore/più lunga parola di QUESTO round coi record salvati,
// aggiorna il localStorage se serve, e ritorna entrambi i valori (nuovi e
// precedenti) così la schermata risultati può mostrare "NUOVO RECORD!" solo
// quando è vero.
function updateWordRecords(bestWordThisRound, longestWordThisRound) {
  const current = loadWordRecords();
  const prevBest = current.bestWord;
  const prevLongest = current.longestWord;

  const isNewBest = !!bestWordThisRound && (!prevBest || bestWordThisRound.points > prevBest.points);
  const isNewLongest =
    !!longestWordThisRound && (!prevLongest || longestWordThisRound.word.length > prevLongest.length);

  const next = {
    bestWord: isNewBest ? bestWordThisRound : prevBest,
    longestWord: isNewLongest
      ? { word: longestWordThisRound.word, length: longestWordThisRound.word.length }
      : prevLongest,
  };
  localStorage.setItem(WORD_STATS_KEY, JSON.stringify(next));

  return { prevBest, prevLongest, isNewBest, isNewLongest };
}

function getGlobalStats() {
  const history = loadHistory();
  const gamesPlayed = history.length;
  const bestScore = history.reduce((max, h) => Math.max(max, h.score), 0);
  return { gamesPlayed, bestScore };
}

// ---------- AdSense ----------
//
// Chiara: sostituisci ADSENSE_CLIENT con il tuo publisher ID reale
// (es. "ca-pub-1234567890123456") e i due slot in ADSENSE_SLOTS con gli ID
// delle unità pubblicitarie create nel tuo account AdSense (una per la home,
// una per la schermata risultati — puoi anche usare lo stesso slot "auto"
// per entrambe se preferisci non crearne due). Finché ADSENSE_CLIENT
// contiene ancora "XXXX" il gioco non carica alcuno script né mostra alcun
// riquadro pubblicitario, quindi è sicuro consegnare/pubblicare così com'è
// e attivare gli annunci in un secondo momento senza toccare altro codice.
//
// Ricordati anche di aggiungere una riga in ads.txt nella root del sito
// (stesso formato già usato per mysticaoracoli):
//   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";
const ADSENSE_SLOTS = {
  home: "XXXXXXXXXX",
  results: "XXXXXXXXXX",
};
const ADSENSE_ENABLED = !ADSENSE_CLIENT.includes("XXXX");

function loadAdsenseScriptOnce() {
  if (!ADSENSE_ENABLED) return;
  if (document.getElementById("adsbygoogle-script")) return;
  const script = document.createElement("script");
  script.id = "adsbygoogle-script";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

// Riquadro pubblicitario "gentile": mai durante il round di gioco vero e
// proprio (solo su home e schermata risultati), per non interrompere
// l'esperienza mentre si gioca.
function renderAdSlot(placement) {
  if (!ADSENSE_ENABLED) return "";
  const slot = ADSENSE_SLOTS[placement];
  if (!slot) return "";
  return `
    <div class="ad-slot">
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="${ADSENSE_CLIENT}"
        data-ad-slot="${slot}"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    </div>`;
}

function pushAds() {
  if (!ADSENSE_ENABLED) return;
  document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])").forEach(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Script AdSense non ancora pronto o bloccato da adblock: non deve
      // mai bloccare il gioco.
    }
  });
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
  lastFoundWord: null, // ultima parola trovata, per animare il suo ingresso in lista
  score: 0,
  roundRecord: null, // { isNew, prevBest } calcolato a fine round
  roundSeconds: DIFFICULTIES[loadDifficulty()].seconds,
  timeLeft: DIFFICULTIES[loadDifficulty()].seconds,
  timerHandle: null,
  selection: [], // array di [r,c] durante il drag corrente
  pointerDown: false,

  // ---------- Stato modalità "Sfida un amico" (multiplayer 1v1) ----------
  duel: null, // { code, uid, isHost, categoryId, difficultyId, seed, unsubscribe, opponentUid, opponentName, opponentScore, opponentWordsFound, opponentFinished, myScore, myWordsFound, myFinished, isWinner, isTie, started }
  duelSetupError: "",
  duelSetupCreating: false,
  duelJoinError: "",
  duelJoining: false,
  duelJoinPrefill: "",
  duelCountdownMs: null,
};

function render() {
  updateScreenBackground();
  if (state.screen === "category-select") renderCategorySelect();
  else if (state.screen === "playing") renderGame();
  else if (state.screen === "results") renderResults();
  else if (state.screen === "duel-setup") renderDuelSetup();
  else if (state.screen === "duel-join") renderDuelJoin();
  else if (state.screen === "duel-lobby") renderDuelLobby();
  pushAds();
}

// Durante la partita e nella schermata risultati, lo sfondo della pagina
// diventa la foto a tema della categoria in corso invece del gradiente
// scuro generico. L'URL viene impostato per intero qui via JS (non tramite
// variabile CSS referenziata da style.css) perché un url() dentro una CSS
// custom property si risolve rispetto al foglio di stile che la referenzia
// (css/style.css), non rispetto alla pagina — con un percorso relativo
// come "img/backgrounds/..." questo cercherebbe (sbagliando) dentro
// "css/img/backgrounds/...". Impostandolo come inline style sull'elemento,
// invece, si risolve correttamente rispetto all'URL della pagina, esattamente
// come già succede per le foto sulle category-card.
function updateScreenBackground() {
  const showPhoto = (state.screen === "playing" || state.screen === "results") && state.category;
  if (showPhoto) {
    const url = `${CATEGORY_BG_BASE}${state.category.id}.jpg`;
    document.body.style.backgroundImage = `linear-gradient(180deg, rgba(23,15,28,0.5) 0%, rgba(23,15,28,0.82) 45%, var(--ink-deep) 100%), url('${url}')`;
    document.body.classList.add("has-bg-photo");
  } else {
    document.body.style.backgroundImage = "";
    document.body.classList.remove("has-bg-photo");
  }
}

// ---------- Schermata selezione categoria ----------

function renderCategorySelect() {
  const { gamesPlayed, bestScore } = getGlobalStats();
  const recent = loadHistory().slice(0, 5);

  app.innerHTML = `
    <header class="brand">
      ${renderSoundToggle()}
      <h1>Scontro delle Ultime Parole</h1>
      <p class="tagline">Trova le parole della categoria — le bonus valgono ×${BONUS_MULTIPLIER}! Vanno bene anche altre parole italiane.</p>
    </header>

    ${
      gamesPlayed > 0
        ? `<div class="stats-bar">
            <span>${gamesPlayed} partit${gamesPlayed === 1 ? "a" : "e"} giocat${gamesPlayed === 1 ? "a" : "e"}</span>
            <span>Miglior punteggio: ${bestScore}</span>
          </div>
          <ul class="history-list">
            ${recent
              .map(
                (h) =>
                  `<li><span>${h.categoryIcon} ${h.categoryLabel}</span><span class="history-diff">${DIFFICULTIES[h.difficulty]?.label ?? h.difficulty}</span><strong>${h.score}pt</strong></li>`
              )
              .join("")}
          </ul>`
        : ""
    }

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
        <button class="category-card" data-id="${c.id}" style="${categoryBgStyle(c.id)}">
          <span class="category-icon">${c.icon}</span>
          <span class="category-label">${c.label}</span>
        </button>`
      ).join("")}
    </div>

    <div class="duel-entry">
      <button id="duel-create-btn" class="duel-btn">⚔️ Sfida un amico</button>
      <button id="duel-join-btn" class="duel-btn secondary">🔑 Ho un codice sfida</button>
    </div>

    ${renderAdSlot("home")}
  `;

  attachSoundToggle();

  document.getElementById("duel-create-btn").addEventListener("click", () => {
    state.duelSetupError = "";
    state.screen = "duel-setup";
    render();
  });
  document.getElementById("duel-join-btn").addEventListener("click", () => {
    state.duelJoinError = "";
    state.screen = "duel-join";
    render();
  });

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

// Calcola tutti i campi di stato necessari per un round (griglia, trie,
// parole piantate/trovabili) a partire da categoria+difficoltà. Condiviso
// tra la partita singola (startRound, rng = Math.random) e la modalità
// Sfida (startDuelRound, rng seedato in modo che entrambi i giocatori
// vedano esattamente la stessa griglia).
function buildRoundFields(category, diff, rng = Math.random) {
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

  const { grid, plantedWords } = generateGrid(category, diff.size, diff.wordsToPlant, rng);
  const allFindableWords = findAllWords(grid, categoryTrie, diff.size, diff.size + 3);

  return {
    category,
    trie,
    categoryWordsSet,
    plantedSet: new Set(plantedWords.map((p) => p.word)),
    grid,
    gridSize: diff.size,
    plantedWords,
    allFindableWords,
    foundWords: new Map(),
    lastFoundWord: null,
    score: 0,
    attemptsTotal: 0, // tentativi con selezione >=3 lettere, per la stat "Precisione"
    attemptsValid: 0, // di cui parole realmente valide (nuove o già trovate)
    comboCount: 0, // parole nuove trovate consecutivamente entro COMBO_WINDOW_MS
    lastFoundAt: null,
    roundSeconds: diff.seconds,
    timeLeft: diff.seconds,
    selection: [],
    pointerDown: false,
  };
}

function startRound(categoryId) {
  const diff = DIFFICULTIES[state.difficulty];
  const category = CATEGORIES.find((c) => c.id === categoryId);

  state = {
    ...state,
    screen: "playing",
    duel: null,
    ...buildRoundFields(category, diff),
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

  const { category, difficulty, score } = state;
  const prevBest = getBestScore(category.id, difficulty);
  state.roundRecord = { isNew: score > 0 && score > prevBest, prevBest };
  saveRoundToHistory({
    ts: Date.now(),
    categoryId: category.id,
    categoryLabel: category.label,
    categoryIcon: category.icon,
    difficulty,
    score,
    wordsFound: state.foundWords.size,
  });

  // Parola migliore/più lunga di questo round (per la mini-anteprima griglia
  // e le due statistiche in stile Ruzzle nella schermata risultati).
  let bestWordThisRound = null;
  let longestWordThisRound = null;
  for (const [word, info] of state.foundWords) {
    if (!bestWordThisRound || info.points > bestWordThisRound.points) {
      bestWordThisRound = { word, points: info.points, path: info.path };
    }
    if (!longestWordThisRound || word.length > longestWordThisRound.word.length) {
      longestWordThisRound = { word, path: info.path };
    }
  }
  const wordRecords = updateWordRecords(bestWordThisRound, longestWordThisRound);

  state.roundStats = {
    precision: state.attemptsTotal > 0 ? Math.round((state.attemptsValid / state.attemptsTotal) * 100) : 100,
    bestWordThisRound,
    longestWordThisRound,
    ...wordRecords,
  };

  if (state.duel) {
    state.duel.myScore = score;
    state.duel.myWordsFound = state.foundWords.size;
    state.duel.myFinished = true;
    duel
      .finishMyRound(state.duel.code, { score, wordsFound: state.foundWords.size })
      .catch(() => {
        // Se la scrittura fallisce (rete assente, stanza cancellata, ecc.)
        // il giocatore vede comunque il proprio punteggio finale; l'unica
        // conseguenza è che l'avversario potrebbe non vedere il verdetto
        // finale in tempo reale.
      });
  }

  state.screen = "results";
  render();
}

// ---------- Schermata di gioco ----------

function renderGame() {
  const { category, grid } = state;
  const d = state.duel;

  app.innerHTML = `
    <header class="game-header">
      <div class="category-pill">${category.icon} ${category.label}</div>
      <div class="difficulty-pill">${DIFFICULTIES[state.difficulty].label}</div>
      <div class="timer">
        <div class="timer-bar-track"><div id="time-bar" class="timer-bar-fill"></div></div>
        <span id="time-left">${state.timeLeft}</span>s
      </div>
      <div class="score">Punti: <span id="score-value">${state.score}</span></div>
      ${
        d
          ? `<div class="duel-opponent-pill" title="Punteggio live di ${d.opponentName || "avversario"}">⚔️ ${d.opponentName || "Avversario"}: <span id="opponent-score">${d.opponentScore}</span>${d.opponentFinished ? " ✅" : ""}</div>`
          : ""
      }
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

  if (word.length >= 3) {
    state.attemptsTotal++;
    if (isValid) state.attemptsValid++;
  }

  if (isNew) {
    const { points, type } = classifyWord(word);
    state.foundWords.set(word, { points, type, path: state.selection.slice() });
    state.score += points;
    state.lastFoundWord = word;

    // Combo: se questa parola arriva entro COMBO_WINDOW_MS dall'ultima
    // trovata, lo streak cresce; altrimenti riparte da 1. Da 2 in su
    // scatta il feedback combo (audio + popup), per premiare chi trova
    // parole in rapida successione senza esitare.
    const now = Date.now();
    state.comboCount = state.lastFoundAt && now - state.lastFoundAt <= COMBO_WINDOW_MS ? state.comboCount + 1 : 1;
    state.lastFoundAt = now;

    audio.playFound(points);
    if (type === "bonus") {
      audio.playBonusSparkle();
      spawnSparkleBurst(cellsEls);
    }
    if (state.comboCount >= 2) {
      audio.playCombo(state.comboCount);
      showComboPopup(state.comboCount);
    }
    flashCells(cellsEls, type === "bonus" ? "bonus" : "correct");
    showScorePopup(cellsEls, points, type);
    updateFoundList();
    pulseScore();
    if (state.duel) {
      duel
        .updateMyProgress(state.duel.code, { score: state.score, wordsFound: state.foundWords.size })
        .catch(() => {
          // Connessione instabile: il gioco locale continua comunque, si
          // riprova ad ogni parola successiva.
        });
    }
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
  cellsEls.forEach((el) => el.classList.add(className, "cell-pop"));
  setTimeout(() => cellsEls.forEach((el) => el.classList.remove(className, "cell-pop")), 400);
}

// Numero "+N" (o "×3 +N" per le bonus) che sale e sfuma sopra le celle della
// parola appena trovata, per un feedback più celebrativo del solo flash colore.
function showScorePopup(cellsEls, points, type) {
  const boardWrap = document.querySelector(".board-wrap");
  if (!boardWrap || !cellsEls.length) return;

  const wrapRect = boardWrap.getBoundingClientRect();
  let cx = 0;
  let cy = 0;
  cellsEls.forEach((el) => {
    const r = el.getBoundingClientRect();
    cx += r.left + r.width / 2;
    cy += r.top + r.height / 2;
  });
  cx /= cellsEls.length;
  cy /= cellsEls.length;

  const popup = document.createElement("div");
  popup.className = `score-popup score-popup-${type}`;
  popup.textContent = type === "bonus" ? `×${BONUS_MULTIPLIER} +${points}` : `+${points}`;
  popup.style.left = `${cx - wrapRect.left}px`;
  popup.style.top = `${cy - wrapRect.top}px`;
  boardWrap.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
  // Fallback nel caso animationend non scatti (es. tab in background).
  setTimeout(() => popup.remove(), 1200);
}

function pulseScore() {
  const el = document.getElementById("score-value");
  if (!el) return;
  el.textContent = state.score;
  el.classList.remove("pulse");
  // forza il reflow così l'animazione riparte anche se già in corso
  void el.offsetWidth;
  el.classList.add("pulse");
}

// Effetto "speciale" per le parole bonus (x3): una manciata di stelline
// che si irradiano dalle celle della parola in direzioni casuali e
// sfumano mentre volano via. Accompagna audio.playBonusSparkle().
function spawnSparkleBurst(cellsEls) {
  const boardWrap = document.querySelector(".board-wrap");
  if (!boardWrap || !cellsEls.length) return;
  const wrapRect = boardWrap.getBoundingClientRect();

  cellsEls.forEach((cellEl) => {
    const r = cellEl.getBoundingClientRect();
    const cx = r.left + r.width / 2 - wrapRect.left;
    const cy = r.top + r.height / 2 - wrapRect.top;

    const sparkleCount = 3;
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement("span");
      sparkle.className = "sparkle";
      sparkle.textContent = "✦";
      const angle = Math.random() * Math.PI * 2;
      const distance = 26 + Math.random() * 22;
      sparkle.style.left = `${cx}px`;
      sparkle.style.top = `${cy}px`;
      sparkle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      sparkle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      sparkle.style.animationDelay = `${Math.random() * 0.12}s`;
      boardWrap.appendChild(sparkle);
      sparkle.addEventListener("animationend", () => sparkle.remove());
      setTimeout(() => sparkle.remove(), 900);
    }
  });
}

// Popup "COMBO ×N" al centro sopra la griglia quando si trovano parole in
// rapida successione (vedi COMBO_WINDOW_MS). Colore e dimensione crescono
// con lo streak per dare un senso di escalation, fino a un tetto.
function showComboPopup(level) {
  const boardWrap = document.querySelector(".board-wrap");
  if (!boardWrap) return;

  const tier = Math.min(level - 1, 4); // 0..4, usato per la classe colore/dimensione
  const popup = document.createElement("div");
  popup.className = `combo-popup combo-tier-${tier}`;
  popup.textContent = `COMBO ×${level}`;
  boardWrap.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
  setTimeout(() => popup.remove(), 1000);
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
        `<li class="word-${type}${w === state.lastFoundWord ? " just-found" : ""}"><span>${w}${wordBadge(type)}</span><strong>+${points}</strong></li>`
    )
    .join("");
  document.getElementById("found-count").textContent = words.length;
}

// ---------- Schermata risultati ----------

function renderResults() {
  const { category, allFindableWords, foundWords, score, roundRecord, roundStats } = state;
  const missed = [...allFindableWords.keys()]
    .filter((w) => !foundWords.has(w))
    .sort((a, b) => b.length - a.length);

  const isCelebration = roundRecord?.isNew || roundStats?.isNewBest || roundStats?.isNewLongest;

  const recordLine = roundRecord?.isNew
    ? `<p class="results-record new">🏆 Nuovo record per ${category.label} (${DIFFICULTIES[state.difficulty].label})!</p>`
    : `<p class="results-record">Record ${category.label} (${DIFFICULTIES[state.difficulty].label}): ${Math.max(roundRecord?.prevBest ?? 0, score)} punti</p>`;

  app.innerHTML = `
    <div class="results">
      <h1 class="reveal" style="--i:0">Tempo scaduto!</h1>
      <p class="results-category reveal" style="--i:1">${category.icon} ${category.label}</p>
      <div class="results-score reveal${isCelebration ? " score-celebration" : ""}" style="--i:2"><span id="score-countup" data-target="${score}">0</span> punti</div>
      <div class="reveal" style="--i:3">${recordLine}</div>
      ${renderDuelResultBanner()}

      ${renderMiniGridSnapshot()}

      ${renderRoundStatCards()}

      <div class="results-columns reveal" style="--i:6">
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

      <div class="results-actions reveal" style="--i:7">
        ${
          state.duel
            ? `<button id="duel-rematch">Rivincita (nuova sfida)</button>`
            : `<button id="play-again">Rigioca (stessa categoria)</button>`
        }
        <button id="change-category" class="secondary">${state.duel ? "Torna alla home" : "Cambia categoria"}</button>
      </div>

      ${renderAdSlot("results")}
    </div>
  `;

  if (state.duel) {
    document.getElementById("duel-rematch").addEventListener("click", () => {
      teardownDuel();
      state.duelSetupError = "";
      state.screen = "duel-setup";
      render();
    });
  } else {
    document.getElementById("play-again").addEventListener("click", () => startRound(state.category.id));
  }

  document.getElementById("change-category").addEventListener("click", () => {
    teardownDuel();
    state.screen = "category-select";
    render();
  });

  animateResultsReveal();
}

// Piccola anteprima della griglia giocata con evidenziato il percorso della
// parola migliore di questo round (o quella più lunga se non ce n'è una a
// punteggio), in stile "cartolina" come il recap di fine partita di Ruzzle.
function renderMiniGridSnapshot() {
  const stats = state.roundStats;
  const showcase = stats?.bestWordThisRound || stats?.longestWordThisRound;
  if (!showcase || !showcase.path?.length) return "";

  const highlighted = new Set(showcase.path.map(([r, c]) => `${r},${c}`));
  const label = stats.bestWordThisRound
    ? `${showcase.word} · +${stats.bestWordThisRound.points} punti`
    : showcase.word;

  const gridHtml = state.grid
    .map((row, r) =>
      row
        .map((letter, c) => {
          const isHi = highlighted.has(`${r},${c}`);
          return `<div class="mini-cell${isHi ? " hi" : ""}">${letter}</div>`;
        })
        .join("")
    )
    .join("");

  return `
    <div class="mini-grid-card reveal" style="--i:4">
      <div class="mini-grid" style="--size:${state.gridSize}">${gridHtml}</div>
      <p class="mini-grid-label">${label}</p>
    </div>`;
}

// Le tre "stat card" in stile recap Ruzzle: precisione (% di parole valide
// sui tentativi), parola più lunga e parola migliore — queste ultime due
// confrontate col record assoluto salvato in localStorage, con nastrino
// "NUOVO RECORD" quando il round appena giocato lo ha battuto.
function renderRoundStatCards() {
  const stats = state.roundStats;
  if (!stats) return "";

  const { precision, longestWordThisRound, bestWordThisRound, isNewLongest, isNewBest, prevLongest, prevBest } = stats;

  const longestLen = longestWordThisRound?.word.length || 0;
  const longestRecordLen = Math.max(longestLen, prevLongest?.length || 0);
  const longestPct = longestRecordLen > 0 ? Math.round((longestLen / longestRecordLen) * 100) : 0;

  const bestPoints = bestWordThisRound?.points || 0;
  const bestRecordPoints = Math.max(bestPoints, prevBest?.points || 0);
  const bestPct = bestRecordPoints > 0 ? Math.round((bestPoints / bestRecordPoints) * 100) : 0;

  return `
    <div class="stat-grid reveal" style="--i:5">
      <div class="stat-card">
        <h3>Precisione</h3>
        <div class="stat-bar-track"><div class="stat-bar-fill" data-target-pct="${precision}"></div></div>
        <span class="stat-value" id="precision-countup" data-target="${precision}" data-suffix="%">0%</span>
      </div>
      <div class="stat-card">
        <h3>Parole trovate</h3>
        <div class="stat-bar-track"><div class="stat-bar-fill" data-target-pct="100"></div></div>
        <span class="stat-value" id="words-countup" data-target="${state.foundWords.size}">0</span>
      </div>
      <div class="stat-card${isNewLongest ? " is-record" : ""}">
        ${isNewLongest ? `<span class="record-ribbon">NUOVO<br>RECORD!</span>` : ""}
        <h3>Parola più lunga</h3>
        <div class="stat-bar-track"><div class="stat-bar-fill" data-target-pct="${longestPct}"></div></div>
        <span class="stat-value">${longestWordThisRound ? `${longestLen} <small>(record ${longestRecordLen})</small>` : "—"}</span>
      </div>
      <div class="stat-card${isNewBest ? " is-record" : ""}">
        ${isNewBest ? `<span class="record-ribbon">NUOVO<br>RECORD!</span>` : ""}
        <h3>Parola migliore</h3>
        <div class="stat-bar-track"><div class="stat-bar-fill" data-target-pct="${bestPct}"></div></div>
        <span class="stat-value">${bestWordThisRound ? `${bestWordThisRound.word} <small>(${bestPoints}pt)</small>` : "—"}</span>
      </div>
    </div>`;
}

// Innesca le animazioni della schermata risultati dopo che l'HTML è già nel
// DOM: le sezioni "reveal" partono in sequenza (via --i e CSS), le barre
// stat si riempiono e i numeri chiave salgono da 0 al valore finale. Se il
// round ha battuto un record (punteggio, parola più lunga o migliore),
// aggiunge coriandoli dorati + una fanfara più ricca — il momento "speciale"
// riservato ai risultati davvero degni di nota.
function animateResultsReveal() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".stat-bar-fill[data-target-pct]").forEach((el) => {
      const pct = Number(el.dataset.targetPct) || 0;
      requestAnimationFrame(() => {
        el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      });
    });
  });

  document.querySelectorAll("[data-target]").forEach((el) => {
    const target = Number(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || "";
    animateCountUp(el, target, suffix);
  });

  const stats = state.roundStats;
  const isCelebration = state.roundRecord?.isNew || stats?.isNewBest || stats?.isNewLongest;
  if (isCelebration) {
    setTimeout(() => {
      spawnConfetti();
      audio.playRecordFanfare();
    }, 300); // dopo il suono di fine round (playRoundEnd), per non sovrapporsi
  }
}

function animateCountUp(el, target, suffix = "", duration = 700) {
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Pioggia di coriandoli dorati/corallo/teal dall'alto della schermata
// risultati, per i momenti di nuovo record. Puro CSS (una manciata di span
// posizionati e animati), niente canvas: leggero e sufficiente per un
// tocco di festa senza appesantire la pagina.
function spawnConfetti() {
  const colors = ["var(--gold)", "var(--coral)", "var(--teal)", "var(--parchment)"];
  const pieceCount = 36;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--fall-duration", `${1.6 + Math.random() * 1.2}s`);
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 140}px`);
    piece.style.setProperty("--spin", `${360 * (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random())}deg`);
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
    setTimeout(() => piece.remove(), 3200);
  }
}

// Se il round appena concluso era una sfida multiplayer, mostra un
// riquadro con entrambi i punteggi affiancati e chi ha vinto. Se
// l'avversario non ha ancora finito il proprio round, mostra un messaggio
// di attesa (l'aggiornamento arriva da solo via onSnapshot, vedi
// attachDuelResultsListener).
function renderDuelResultBanner() {
  if (!state.duel) return "";
  const { myScore, opponentScore, opponentName, opponentFinished, isWinner, isTie } = state.duel;

  if (!opponentFinished) {
    return `<div class="duel-banner duel-banner-waiting">⏳ In attesa che <strong>${opponentName || "l'avversario"}</strong> finisca la sua sfida…</div>`;
  }

  const resultLabel = isTie ? "🤝 Pareggio!" : isWinner ? "🏆 Hai vinto la sfida!" : "😅 Ha vinto l'avversario";

  return `
    <div class="duel-banner ${isTie ? "duel-tie" : isWinner ? "duel-win" : "duel-lose"}">
      <p class="duel-result-label">${resultLabel}</p>
      <div class="duel-scores">
        <div class="duel-score-you"><span>Tu</span><strong>${myScore}</strong></div>
        <div class="duel-vs">vs</div>
        <div class="duel-score-opp"><span>${opponentName || "Avversario"}</span><strong>${opponentScore}</strong></div>
      </div>
    </div>`;
}

// ---------- Modalità "Sfida un amico" (multiplayer 1v1) ----------

function duelUnavailableMessage(err) {
  if (err && err.code === "MULTIPLAYER_NOT_CONFIGURED") {
    return "Il multiplayer non è ancora attivo su questo sito (manca la configurazione Firebase in js/firebase-config.js). Nel frattempo puoi giocare in singolo!";
  }
  return (err && err.message) || "Qualcosa è andato storto, riprova tra un attimo.";
}

async function createDuelRoom(categoryId) {
  state.duelSetupError = "";
  state.duelSetupCreating = true;
  render();
  try {
    const { code, uid, seed } = await duel.createDuel({ categoryId, difficultyId: state.difficulty });
    state.duel = {
      code,
      uid,
      isHost: true,
      categoryId,
      difficultyId: state.difficulty,
      seed,
      unsubscribe: null,
      opponentUid: null,
      opponentName: "",
      opponentScore: 0,
      opponentWordsFound: 0,
      opponentFinished: false,
      myScore: 0,
      myWordsFound: 0,
      myFinished: false,
      isWinner: false,
      isTie: false,
      started: false,
    };
    state.duelSetupCreating = false;
    attachDuelListener();
    state.screen = "duel-lobby";
    render();
  } catch (err) {
    state.duelSetupCreating = false;
    state.duelSetupError = duelUnavailableMessage(err);
    render();
  }
}

async function joinDuelRoom(codeRaw) {
  const code = (codeRaw || "").toUpperCase().trim();
  if (code.length !== 5) {
    state.duelJoinError = "Il codice ha 5 caratteri, controlla di averlo copiato per intero.";
    render();
    return;
  }
  state.duelJoinError = "";
  state.duelJoining = true;
  render();
  try {
    const { uid, seed, categoryId, difficultyId } = await duel.joinDuel(code);
    state.difficulty = DIFFICULTIES[difficultyId] ? difficultyId : state.difficulty;
    state.duel = {
      code,
      uid,
      isHost: false,
      categoryId,
      difficultyId,
      seed,
      unsubscribe: null,
      opponentUid: null,
      opponentName: "",
      opponentScore: 0,
      opponentWordsFound: 0,
      opponentFinished: false,
      myScore: 0,
      myWordsFound: 0,
      myFinished: false,
      isWinner: false,
      isTie: false,
      started: false,
    };
    state.duelJoining = false;
    attachDuelListener();
    state.screen = "duel-lobby";
    render();
  } catch (err) {
    state.duelJoining = false;
    state.duelJoinError = duelUnavailableMessage(err);
    render();
  }
}

function attachDuelListener() {
  if (!state.duel) return;
  const myCode = state.duel.code;
  state.duel.unsubscribe = duel.listenToDuel(myCode, (data, err) => {
    // Ignora snapshot "orfani" se nel frattempo la sfida è stata abbandonata
    // o si è già passati a un'altra (es. rivincita con nuovo codice).
    if (!state.duel || state.duel.code !== myCode) return;
    if (err || !data) return;
    handleDuelSnapshot(data);
  });
}

function handleDuelSnapshot(data) {
  const d = state.duel;
  if (!d) return;

  const players = data.players || {};
  const opponentUid = Object.keys(players).find((id) => id !== d.uid) || null;
  d.opponentUid = opponentUid;
  const opp = opponentUid ? players[opponentUid] : null;
  if (opp) {
    d.opponentName = opp.name || "Avversario";
    d.opponentScore = opp.score || 0;
    d.opponentWordsFound = opp.wordsFound || 0;
    d.opponentFinished = !!opp.finished;
  }

  // Mentre si sta giocando non ridisegniamo l'intera schermata (romperebbe
  // il drag in corso sulla griglia): aggiorniamo solo il numero nel pillolo
  // avversario in alto, se presente nel DOM.
  if (state.screen === "playing") {
    const el = document.getElementById("opponent-score");
    if (el) el.textContent = d.opponentScore;
    return;
  }

  // Non appena la stanza passa a "ready" (secondo giocatore entrato), parte
  // per entrambi un piccolo countdown condiviso basato su data.startAt, così
  // i due dispositivi iniziano il round nello stesso istante pur leggendo
  // questo snapshot con qualche decina di millisecondi di scarto.
  if (!d.started && data.status === "ready" && data.startAt) {
    d.started = true;
    const category = CATEGORIES.find((c) => c.id === data.categoryId);
    const delay = Math.max(0, data.startAt - Date.now());
    state.duelCountdownMs = delay;
    if (state.screen === "duel-lobby") render();
    setTimeout(() => startDuelRound(category, data.difficultyId, data.seed), delay);
    return;
  }

  // Quando entrambi hanno finito il proprio round, calcola il verdetto.
  if (data.status === "finished" && opp) {
    d.isTie = d.myScore === d.opponentScore;
    d.isWinner = d.myScore > d.opponentScore;
  }

  if (state.screen === "results" || state.screen === "duel-lobby") render();
}

function startDuelRound(category, difficultyId, seed) {
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES[state.difficulty];
  const rng = createSeededRng(seed);

  state = {
    ...state,
    screen: "playing",
    difficulty: difficultyId || state.difficulty,
    duelCountdownMs: null,
    ...buildRoundFields(category, diff, rng),
  };

  render();
  startTimer();
}

// Stacca il listener realtime e, se eravamo host in attesa senza che
// nessuno si fosse ancora unito, elimina la stanza per non lasciarla in
// giro inutilmente. Va chiamata ogni volta che si esce dal flusso sfida
// prima della fine naturale (annulla, torna alla home, ecc.).
function teardownDuel() {
  const d = state.duel;
  if (!d) return;
  if (d.unsubscribe) {
    try {
      d.unsubscribe();
    } catch {
      // no-op
    }
  }
  if (d.isHost && !d.opponentUid && !d.myFinished) {
    duel.abandonDuel(d.code).catch(() => {});
  }
  state.duel = null;
  state.duelCountdownMs = null;
}

function copyToClipboard(text, btn) {
  if (!navigator.clipboard?.writeText) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const original = btn.textContent;
      btn.textContent = "✅ Copiato!";
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    })
    .catch(() => {});
}

function renderDuelNameField() {
  return `
    <div class="duel-name-field">
      <label for="duel-name-input">Il tuo nome (facoltativo, lo vede solo il tuo avversario)</label>
      <input id="duel-name-input" maxlength="18" placeholder="Es. Chiara" value="${duel.getMyName()}" />
    </div>`;
}

function attachDuelNameField() {
  const input = document.getElementById("duel-name-input");
  if (!input) return;
  input.addEventListener("change", () => duel.setMyName(input.value));
}

function renderDuelSetup() {
  app.innerHTML = `
    <header class="brand">
      ${renderSoundToggle()}
      <h1>⚔️ Sfida un amico</h1>
      <p class="tagline">Scegli categoria e difficoltà: il tuo amico giocherà sulla tua stessa identica griglia, in tempo reale!</p>
    </header>

    ${renderDuelNameField()}

    <div class="difficulty-select" role="group" aria-label="Difficoltà">
      ${Object.entries(DIFFICULTIES)
        .map(
          ([id, dd]) => `
        <button
          class="difficulty-btn${state.difficulty === id ? " active" : ""}"
          data-diff="${id}"
        >${dd.label}<small>${dd.size}×${dd.size} · ${dd.seconds}s</small></button>`
        )
        .join("")}
    </div>

    <div class="category-grid">
      ${CATEGORIES.map(
        (c) => `
        <button class="category-card" data-id="${c.id}" style="${categoryBgStyle(c.id)}" ${state.duelSetupCreating ? "disabled" : ""}>
          <span class="category-icon">${c.icon}</span>
          <span class="category-label">${c.label}</span>
        </button>`
      ).join("")}
    </div>

    ${state.duelSetupCreating ? `<p class="duel-status">⏳ Creo la stanza…</p>` : ""}
    ${state.duelSetupError ? `<p class="duel-error">${state.duelSetupError}</p>` : ""}

    <div class="duel-entry">
      <button id="duel-back-btn" class="duel-btn secondary">← Torna indietro</button>
    </div>
  `;

  attachSoundToggle();
  attachDuelNameField();

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
      if (state.duelSetupCreating) return;
      audio.unlock();
      createDuelRoom(btn.dataset.id);
    });
  });

  document.getElementById("duel-back-btn").addEventListener("click", () => {
    state.screen = "category-select";
    render();
  });
}

function renderDuelJoin() {
  const prefill = state.duelJoinPrefill || "";

  app.innerHTML = `
    <header class="brand">
      ${renderSoundToggle()}
      <h1>🔑 Entra in una sfida</h1>
      <p class="tagline">Inserisci il codice a 5 caratteri che ti ha mandato il tuo amico.</p>
    </header>

    ${renderDuelNameField()}

    <div class="duel-join-form">
      <input
        id="duel-code-input"
        class="duel-code-input"
        maxlength="5"
        placeholder="ABCDE"
        autocapitalize="characters"
        autocomplete="off"
        value="${prefill}"
      />
      <button id="duel-join-submit" ${state.duelJoining ? "disabled" : ""}>Entra nella sfida</button>
    </div>

    ${state.duelJoining ? `<p class="duel-status">⏳ Mi connetto…</p>` : ""}
    ${state.duelJoinError ? `<p class="duel-error">${state.duelJoinError}</p>` : ""}

    <div class="duel-entry">
      <button id="duel-back-btn" class="duel-btn secondary">← Torna indietro</button>
    </div>
  `;

  attachSoundToggle();
  attachDuelNameField();

  const input = document.getElementById("duel-code-input");
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinDuelRoom(input.value);
  });
  document.getElementById("duel-join-submit").addEventListener("click", () => joinDuelRoom(input.value));

  document.getElementById("duel-back-btn").addEventListener("click", () => {
    state.duelJoinPrefill = "";
    state.screen = "category-select";
    render();
  });

  if (prefill) input.focus();
}

function renderDuelLobby() {
  const d = state.duel;
  if (!d) {
    state.screen = "category-select";
    render();
    return;
  }

  const category = CATEGORIES.find((c) => c.id === d.categoryId);
  const diffInfo = DIFFICULTIES[d.difficultyId];
  const shareUrl = `${location.origin}${location.pathname}?duel=${d.code}`;
  const countdownSeconds = state.duelCountdownMs != null ? Math.max(0, Math.ceil(state.duelCountdownMs / 1000)) : null;

  app.innerHTML = `
    <header class="brand">
      ${renderSoundToggle()}
      <h1>⚔️ ${countdownSeconds !== null ? "Si comincia!" : "Sfida creata"}</h1>
    </header>

    <div class="duel-lobby">
      <p class="duel-lobby-category">${category?.icon || ""} ${category?.label || ""} · ${diffInfo?.label || ""}</p>

      ${
        countdownSeconds !== null
          ? `<div class="duel-countdown">${countdownSeconds > 0 ? countdownSeconds : "VIA!"}</div>
             <p class="duel-waiting">Il tuo avversario è entrato, si parte insieme tra un istante…</p>`
          : `
            <p class="duel-lobby-hint">Condividi questo codice (o il link qui sotto) con il tuo amico:</p>
            <div class="duel-code-display">${d.code}</div>
            <div class="duel-share-row">
              <button id="duel-copy-code">📋 Copia codice</button>
              <button id="duel-copy-link">🔗 Copia link</button>
            </div>
            <p class="duel-waiting">⏳ In attesa che l'amico entri nella stanza…</p>
          `
      }
    </div>

    <div class="duel-entry">
      <button id="duel-cancel-btn" class="duel-btn secondary">Annulla sfida</button>
    </div>
  `;

  attachSoundToggle();

  const copyCodeBtn = document.getElementById("duel-copy-code");
  if (copyCodeBtn) copyCodeBtn.addEventListener("click", () => copyToClipboard(d.code, copyCodeBtn));
  const copyLinkBtn = document.getElementById("duel-copy-link");
  if (copyLinkBtn) copyLinkBtn.addEventListener("click", () => copyToClipboard(shareUrl, copyLinkBtn));

  const cancelBtn = document.getElementById("duel-cancel-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      teardownDuel();
      state.screen = "category-select";
      render();
    });
  }
}

// Se il gioco viene aperto da un link di invito (?duel=CODICE, generato dal
// pulsante "Copia link" della lobby), porta direttamente alla schermata di
// join con il codice già precompilato, invece di passare dalla home.
function checkDuelInviteLink() {
  const params = new URLSearchParams(location.search);
  const code = (params.get("duel") || "").toUpperCase().trim();
  if (code.length === 5) {
    state.screen = "duel-join";
    state.duelJoinPrefill = code;
    // Ripulisce l'URL per non ritentare il join automatico ad ogni refresh.
    history.replaceState(null, "", location.pathname);
  }
}

checkDuelInviteLink();
loadAdsenseScriptOnce();
showSplashIntro(() => render());

// ---------- Splash iniziale animato ----------
//
// Overlay a schermo intero mostrato ad ogni avvio (come il logo animato di
// Ruzzle): le lettere-tile di "SCONTRO" entrano in scena una dopo l'altra
// con un piccolo rimbalzo, poi il sottotitolo sfuma dentro. Si chiude da
// solo dopo ~1.4s o subito se l'utente tocca lo schermo. Il vero contenuto
// (#app) resta invariato sotto e viene renderizzato solo a splash chiuso,
// così non c'è nessun flash del contenuto reale prima dell'animazione.
function showSplashIntro(onDone) {
  const letters = "SCONTRO".split("");
  const overlay = document.createElement("div");
  overlay.className = "splash-overlay";
  overlay.innerHTML = `
    <div class="splash-tiles">
      ${letters
        .map((l, i) => `<span class="splash-tile" style="--i:${i}">${l}</span>`)
        .join("")}
    </div>
    <p class="splash-tagline">delle Ultime Parole</p>
    <p class="splash-hint">tocca per iniziare</p>
  `;
  document.body.appendChild(overlay);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.classList.add("splash-out");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    // Fallback nel caso animationend non scatti (tab in background, ecc.)
    setTimeout(() => overlay.remove(), 500);
    onDone();
  };

  overlay.addEventListener("click", finish);
  setTimeout(finish, 1600);
}
