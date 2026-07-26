# Categorix

Ruzzle a tema: griglia 5x5 (una riga/colonna in più rispetto al Ruzzle classico 4x4), ma le parole valide sono solo quelle della categoria scelta (Animali, Città, Professioni, Frutta & Verdura, Sport).

## Come funziona

1. Alla scelta della categoria, viene generato un `Trie` con tutte le parole di quella categoria (`js/trie.js`).
2. `js/grid-generator.js` "pianta" 6-8 parole della categoria nella griglia come percorsi di celle adiacenti (8 direzioni, il percorso può girare a ogni passo — non solo linee rette come nel classico word-search). Le celle rimaste vuote vengono riempite con lettere pesate per frequenza italiana.
3. `js/path-finder.js` scansiona l'intera griglia con il Trie per trovare **tutte** le parole della categoria effettivamente presenti (comprese eventuali parole "bonus" formate per caso dal riempimento random) — usate poi nella schermata risultati per mostrare cosa non è stato trovato.
4. `js/game.js` gestisce input (drag/swipe via Pointer Events + fallback touch), timer, punteggio (tabella in stile Ruzzle: 3-4 lettere = 1pt, 5 = 2pt, 6 = 3pt, 7 = 5pt, 8+ = 11pt) e le tre schermate (selezione categoria, gioco, risultati).

## Deploy su GitHub Pages

1. Crea un repo, pusha questi file mantenendo la struttura (`index.html` alla root).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Nessuna build step: è tutto vanilla JS con ES modules, funziona diretto da statico.

## Database parole (aggiornato)

| Categoria | Parole |
|---|---|
| Animali | 204 |
| Città | 172 |
| Professioni | 132 |
| Frutta & Verdura | 107 |
| Sport | 96 |
| Colori | 67 |
| Nazioni | 94 |

Totale: 872 parole su 7 categorie (prima erano ~430 su 5).

## Aggiungere una categoria

Crea `js/categories/nuova-categoria.js`:

```js
export default ["PAROLA1", "PAROLA2", ...]; // maiuscole, senza accenti/spazi/apostrofi
```

Poi registrala in `js/categories/index.js` (import + aggiunta all'array `CATEGORIES`).

## Limiti noti / prossimi passi

- Le parole con spazi o apostrofi (es. città composte) sono escluse dalle liste attuali per semplicità del path-finder a singola parola.
- Nessun multiplayer/backend: è pensato come round singolo-giocatore, timer 90s.
- Le liste categoria sono partenza (60-100 parole ciascuna): vanno arricchite/curate a piacere.
- Su griglie "difficili" (parole che non si incastrano bene) può capitare di piantare meno delle 8 parole target — è normale e gestito, il gioco resta comunque giocabile perché lo scan finale conta tutte le parole realmente presenti.
