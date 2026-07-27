// Genera una griglia NxN "piantando" un set di parole della categoria
// come percorsi liberi (8 direzioni, possono girare a ogni passo, non solo
// linee rette come nel classico word-search), poi riempie le celle vuote
// con lettere pesate per frequenza italiana.

export const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// Frequenza approssimativa delle lettere in italiano (pesi relativi).
const LETTER_WEIGHTS = {
  A: 11, E: 11, I: 10, O: 9, N: 7, T: 6, R: 6, L: 6, S: 5, C: 5,
  U: 3, D: 4, P: 3, M: 3, V: 2, G: 2, H: 1, F: 1, B: 1, Q: 1, Z: 1,
};
const WEIGHTED_POOL = Object.entries(LETTER_WEIGHTS).flatMap(([letter, w]) =>
  Array(w).fill(letter)
);

// Generatore pseudo-casuale seedabile (mulberry32). Usato in modalità
// Sfida/Multiplayer per far generare a due client indipendenti *esattamente*
// la stessa griglia a partire dallo stesso seed numerico condiviso via
// Firestore, senza dover trasmettere la griglia stessa. In singolo giocatore
// non viene passato alcun seed e si ricade su Math.random() (comportamento
// originale, invariato).
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomLetter(rng = Math.random) {
  return WEIGHTED_POOL[Math.floor(rng() * WEIGHTED_POOL.length)];
}

/**
 * Tenta di piazzare `word` nella griglia come percorso di celle adiacenti.
 * Muta `grid` in place se ha successo. Ritorna il path (array [r,c]) o null.
 */
function placeWord(grid, size, word, rng = Math.random) {
  const startCells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size]),
    rng
  );

  for (const [sr, sc] of startCells) {
    const visited = new Set();
    const path = [];

    if (dfs(sr, sc, 0)) return path.slice();

    function dfs(r, c, idx) {
      const letter = word[idx];
      const existing = grid[r][c];
      if (existing !== null && existing !== letter) return false;

      const key = `${r},${c}`;
      if (visited.has(key)) return false;

      visited.add(key);
      path.push([r, c]);
      const previous = grid[r][c];
      grid[r][c] = letter;

      if (idx === word.length - 1) return true;

      for (const [dr, dc] of shuffle(DIRECTIONS, rng)) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (dfs(nr, nc, idx + 1)) return true;
      }

      // backtrack
      visited.delete(key);
      path.pop();
      grid[r][c] = previous;
      return false;
    }
  }
  return null;
}

/**
 * Genera una griglia per una categoria.
 * @param {object} category - { words: string[] }
 * @param {number} size - dimensione lato griglia (default 5, una riga/colonna più di Ruzzle)
 * @param {number} targetWordCount - quante parole tentare di piazzare
 * @returns {{ grid: string[][], plantedWords: { word: string, path: number[][] }[] }}
 */
export function generateGrid(category, size = 5, targetWordCount = 8, rng = Math.random) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));

  // Filtra parole di lunghezza compatibile con la griglia e senza caratteri
  // non gestiti (spazi, apostrofi): la lista è già pulita a monte, ma per
  // sicurezza normalizziamo qui.
  const shuffled = shuffle(
    category.words.filter((w) => w.length >= 3 && w.length <= size + 3),
    rng
  );

  // Su griglie piccole (Facile, 4x4) le parole lunghe della categoria
  // occupano molto spazio e si incastrano peggio, lasciando meno parole
  // piantate rispetto al target. Su griglie piccole diamo quindi priorità
  // alle parole più corte (restano mescolate a parità di lunghezza grazie
  // allo shuffle sopra); su griglie normali/difficili l'ordine resta
  // puramente casuale come prima.
  const candidates =
    size <= 4 ? shuffled.slice().sort((a, b) => a.length - b.length) : shuffled;

  const plantedWords = [];
  for (const word of candidates) {
    if (plantedWords.length >= targetWordCount) break;
    const path = placeWord(grid, size, word, rng);
    if (path) plantedWords.push({ word, path });
  }

  // Riempi le celle rimaste vuote con lettere pesate per frequenza.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) grid[r][c] = randomLetter(rng);
    }
  }

  return { grid, plantedWords };
}
