# Scontro delle Ultime Parole

Ruzzle a tema: griglia 4x4/5x5/6x6 a seconda della difficoltà, ma le parole valide "di categoria" sono solo quelle della categoria scelta (Animali, Città, Professioni, Frutta & Verdura, Sport, Colori, Nazioni, Corpo Umano, Mezzi di Trasporto). Sono valide anche parole extra fuori tema (punteggio normale, mai bonus), grazie a un dizionario italiano completo.

## Come funziona

1. Alla scelta della categoria, viene generato un `Trie` con tutte le parole di quella categoria (`js/trie.js`), usato per generare la griglia e per la schermata risultati.
2. `js/grid-generator.js` "pianta" le parole della categoria nella griglia come percorsi di celle adiacenti (8 direzioni, il percorso può girare a ogni passo — non solo linee rette come nel classico word-search). Le celle rimaste vuote vengono riempite con lettere pesate per frequenza italiana.
3. `js/path-finder.js` scansiona l'intera griglia per trovare **tutte** le parole di categoria effettivamente presenti (comprese eventuali parole "bonus" formate per caso dal riempimento random, punteggio ×3) — usate poi nella schermata risultati per mostrare cosa non è stato trovato.
4. `js/game.js` gestisce input (drag/swipe via Pointer Events + fallback touch), timer, punteggio (tabella in stile Ruzzle: 3-4 lettere = 1pt, 5 = 2pt, 6 = 3pt, 7 = 5pt, 8+ = 11pt), le tre schermate (selezione categoria, gioco, risultati), i tre livelli di difficoltà e la validazione delle parole extra tramite `js/dictionary-extra.js` (525.836 parole, forme flesse incluse).
5. **Sfida un amico** (multiplayer 1v1 in tempo reale, opzionale): `js/multiplayer.js` + `js/firebase-config.js`, via Firestore. Un giocatore crea una stanza (codice a 5 caratteri + seed condiviso), l'altro entra col codice: entrambi generano la stessa identica griglia in locale grazie a `createSeededRng` in `js/grid-generator.js` (nessuna griglia trasmessa in rete, solo punteggi). Vedi `js/firebase-config.js` per come attivarlo (serve un progetto Firebase, 5 minuti). Finché non è configurato, i pulsanti relativi mostrano un messaggio invece di dare errore.
6. **AdSense** (opzionale): costanti `ADSENSE_CLIENT`/`ADSENSE_SLOTS` in cima a `js/game.js`. Finché contengono i placeholder, nessuno script viene caricato e nessun riquadro pubblicitario è mostrato. Ricordati anche `ads.txt` nella root quando attivi l'account.


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
| Nazioni | 94 |
| Corpo Umano | 99 |
| Mezzi di Trasporto | 64 |
| Colori | 67 |

Totale: 1035 parole su 9 categorie (prima erano 872 su 7). Tutte verificate contro il dizionario italiano completo (`dictionary-extra.js`, 525.836 forme).

## Aggiungere una categoria

Crea `js/categories/nuova-categoria.js`:

```js
export default ["PAROLA1", "PAROLA2", ...]; // maiuscole, senza accenti/spazi/apostrofi
```

Poi registrala in `js/categories/index.js` (import + aggiunta all'array `CATEGORIES`).

## Limiti noti / prossimi passi

- Le parole con spazi o apostrofi (es. città composte) sono escluse dalle liste attuali per semplicità del path-finder a singola parola.
- Multiplayer "Sfida un amico" implementato ma richiede un progetto Firebase configurato (vedi `js/firebase-config.js`) per funzionare davvero — finché non è collegato, resta disponibile solo il round singolo-giocatore.
- Le liste categoria sono partenza (64-204 parole ciascuna): vanno arricchite/curate a piacere.
- Su griglie "difficili" (parole che non si incastrano bene) può capitare di piantare meno delle parole target — è normale e gestito, il gioco resta comunque giocabile perché lo scan finale conta tutte le parole realmente presenti.
