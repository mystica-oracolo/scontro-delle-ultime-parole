import { DIRECTIONS } from "./grid-generator.js";

export function areAdjacent([r1, c1], [r2, c2]) {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

/**
 * Scansiona l'intera griglia e ritorna TUTTE le parole della categoria
 * (Trie) formabili con un percorso di celle adiacenti, incluse quelle
 * "piantate" e quelle bonus formate per caso dal riempimento random.
 * @returns {Map<string, number[][]>} parola -> path (prima occorrenza trovata)
 */
export function findAllWords(grid, trie, size, maxLen = 8) {
  const found = new Map();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      dfs(r, c, "", new Set(), []);
    }
  }

  function dfs(r, c, prefix, visited, path) {
    const letter = grid[r][c];
    const newPrefix = prefix + letter;
    if (!trie.hasPrefix(newPrefix)) return;

    const key = `${r},${c}`;
    visited.add(key);
    path.push([r, c]);

    if (newPrefix.length >= 3 && trie.isWord(newPrefix) && !found.has(newPrefix)) {
      found.set(newPrefix, path.slice());
    }

    if (newPrefix.length < maxLen) {
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const k2 = `${nr},${nc}`;
        if (visited.has(k2)) continue;
        dfs(nr, nc, newPrefix, visited, path);
      }
    }

    visited.delete(key);
    path.pop();
  }

  return found;
}

/** Punteggio in stile Ruzzle in base alla lunghezza della parola. */
export function scoreForWord(word) {
  const table = { 3: 1, 4: 1, 5: 2, 6: 3, 7: 5 };
  return table[word.length] ?? 11;
}
