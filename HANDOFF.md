# Scontro delle Ultime Parole (ex Categorix) — Handoff

Ruzzle a tema: griglia 5x5, parole valide solo se appartengono alla categoria scelta (Animali, Città, Professioni, Frutta & Verdura, Sport, Colori, Nazioni).

**Nome progetto:** rinominato da "Categorix" a "Scontro delle Ultime Parole" (luglio 2026).
**Repo:** `mystica-oracolo/scontro-delle-ultime-parole` (creato su GitHub, file già caricati).
**Link:** `https://mystica-oracolo.github.io/scontro-delle-ultime-parole/` — **live e funzionante**.

## Cosa è stato fatto

**Architettura (vanilla JS, ES modules, nessuna build step):**
- `js/trie.js` — Trie per validazione rapida parola/prefisso
- `js/grid-generator.js` — genera la griglia 5x5 piantando parole della categoria come percorsi liberi a 8 direzioni (non linee rette come il word-search classico), poi riempie le celle vuote con lettere pesate per frequenza italiana
- `js/path-finder.js` — scan completo della griglia a fine generazione per trovare tutte le parole realmente presenti (piantate + bonus casuali), usato per la schermata risultati
- `js/game.js` — stato di gioco, 3 schermate (selezione categoria → gioco → risultati), timer 90s, input drag/swipe (Pointer Events + fallback touch), punteggio stile Ruzzle. Titolo in `<h1>` aggiornato a "Scontro delle Ultime Parole"
- `css/style.css` — identità visiva "quaderno/inchiostro": palette verde inchiostro + parchment + accenti teal/oro/corallo, font Fraunces/Work Sans/IBM Plex Mono, tessere con bevel, trail SVG sul drag. `.brand h1` reso responsive (`clamp(1.7rem, 6.5vw, 3rem)`) per via del titolo più lungo

**Database parole:** 872 parole totali su 7 categorie (Animali 204, Città 172, Professioni 132, Frutta & Verdura 107, Sport 96, Colori 67, Nazioni 94). Liste pulite, deduplicate, solo lettere A-Z, 3-12 caratteri.

**Testato:** generazione griglia su tutte le 7 categorie, 0 errori di piazzamento, tempo di generazione 1-33ms, 5-8 parole piantate su 8 target per round (varia in base a quanto le parole si incastrano).

**Favicon / meta OG / PWA (luglio 2026):**
- `favicon.ico` (16/32/48) + `icons/icon-master.svg` — tessera parchment con bevel, trail teal→corallo, lettera "C" in serif, palette del progetto
- `icons/apple-touch-icon.png` (180×180)
- `manifest.json` — nome "Scontro delle Ultime Parole", short_name "Scontro Parole", theme_color `#12241c`, icone 192/512 + variante maskable
- `icons/og-image.png` (1200×630) — immagine di condivisione social con titolo, tagline e mini-griglia grafica, rigenerata col nuovo nome
- Meta tag OG + Twitter Card in `index.html`, con URL puntati al repo `scontro-delle-ultime-parole`

**Deploy GitHub Pages:**
- Repo creato su GitHub (`mystica-oracolo/scontro-delle-ultime-parole`), file caricati via upload manuale (icons/, css/, js/, index.html, manifest.json, favicon.ico, README.md, HANDOFF.md)
- Settings → Pages configurato: Source = "Deploy from a branch", branch `main`, cartella `/root` — salvato correttamente ("GitHub Pages source saved")
- **Risolto**: il 404 iniziale era solo propagazione del deploy. Sito live e funzionante su `https://mystica-oracolo.github.io/scontro-delle-ultime-parole/`

## Da risolvere subito

_(nessun blocco aperto al momento)_

**Dizionario extra sostituito con dizionario italiano completo (luglio 2026):**
- `js/dictionary-extra.js` non è più una lista scritta a mano (1797 parole) ma un dizionario italiano reale di **525.836 parole** (forme flesse incluse: plurali, coniugazioni verbali, ecc.), filtrato dal file fornito da te (`660000_parole_italiane.txt`, ~661.500 forme) tenendo solo A-Z maiuscole, lunghezza 3-12 (limiti del gioco), deduplicato
- Formato cambiato per leggerezza: non più array di stringhe con virgolette ma un'unica stringa CSV, `.split(",")` all'uso — file passato da ~194 righe a **~5,3 MB** (dizionario reale, non c'è modo di comprimerlo molto di più restando testo leggibile; con gzip lato server, come fa GitHub Pages, il trasferimento reale è ~1,3 MB)
- **Rifattorizzato `game.js` per le prestazioni**: con mezzo milione di parole, ricostruire un Trie da zero ad ogni round (come si faceva con le 1797 parole manuali) sarebbe stato troppo lento su mobile. Ora: `EXTRA_WORDS_SET` (un `Set`) è costruito **una sola volta** al caricamento del modulo, e in `startRound` il controllo parola-valida usa direttamente `Set.has()` (O(1)) invece di inserire tutto in un Trie ad ogni partita — nessun cambio di comportamento per chi gioca, solo di velocità
- **Testato**: caricamento del dizionario + costruzione del Set ~250-300ms in Node (una tantum, al primo avvio dell'app); lookup di parole singole istantaneo; `node --check` ok su entrambi i file
- Nota: essendo un dizionario reale con tutte le flessioni, ora in griglia possono comparire per caso moltissime più parole "extra" trovabili rispetto a prima (~21 medie con la lista manuale, molte di più ora) — nessuna di queste vale mai bonus ×3, solo punteggio normale, come da regola originale
- Non fatto: nessuna deduplica esplicita tra questo dizionario e le parole di categoria (ci sono ~872 parole di categoria probabilmente già presenti anche qui) — non è un problema perché `classifyWord` controlla prima `categoryWordsSet`/`plantedSet`, quindi una parola di categoria continua a valere sempre come categoria/bonus, mai come "extra", indipendentemente da questa sovrapposizione

**Punti tripli sulle bonus + vocabolario esteso (luglio 2026):**
- `js/dictionary-extra.js` — vocabolario generico italiano (**1797 parole**, fuori tema), usato SOLO per validare parole trovate in gioco, non per piantare/generare la griglia né per la schermata risultati. Ampliato due volte su richiesta (648 → 1239 → 1797) dopo feedback "poche parole"
- `js/game.js` `startRound`: il trie "di gioco" ora include anche **tutte le parole delle ALTRE categorie** (es. mentre giochi "Colori" valgono anche le parole di "Animali", "Sport", ecc., sempre a punteggio extra normale, mai bonus) — modo "gratuito" per ampliare ulteriormente il vocabolario senza doverlo scrivere a mano. Vocabolario extra effettivo per round ≈ 1797 + (872 − parole della categoria in corso) ≈ 2400-2650 parole, media **~21 parole extra trovabili per griglia** (era ~14 con solo il dizionario manuale, ~8 alla prima versione)
- `js/game.js`: `startRound` ora costruisce due Trie — `categoryTrie` (solo categoria, usato per generare la griglia e per `allFindableWords`/schermata risultati) e `trie` "di gioco" (categoria + extra, usato da `submitSelection` per validare ciò che il giocatore seleziona)
- Nuova funzione `classifyWord(word)`: distingue 3 casi —
  - **categoria**: parola piantata intenzionalmente → punteggio normale (Ruzzle-style)
  - **bonus**: parola della categoria presente per caso in griglia ma non piantata → punteggio **×3** (`BONUS_MULTIPLIER`)
  - **extra**: parola del vocabolario generico, fuori tema → punteggio normale
- `state.foundWords` è passato da `Map<parola, punti>` a `Map<parola, {points, type}>` — aggiornati `submitSelection`, `updateFoundList`, `renderResults`
- Feedback visivo: flash dorato/corallo (`.cell.bonus`) sulle celle di una parola bonus trovata, tag "×3" o "extra" accanto alla parola in lista trovate e nei risultati (CSS in `style.css`: `.tag`, `.tag-bonus`, `.tag-extra`, `.cell.bonus`, `.word-bonus`)
- Tagline home aggiornata per spiegare la nuova regola
- **Testato**: simulazione di più round su categoria "Animali" — bonus trovate correttamente triplicate (es. RATTO 2pt→6pt, CROTALO 5pt→15pt); su "Colori" verificate parole extra aggiuntive trovabili (BERE, PANE, ESSERE, ecc.) non presenti nel vocabolario categoria
- Nota: il vocabolario extra è compilato a mano (non da un dizionario di terzi), quindi andrebbe rivisto/ampliato ulteriormente da un madrelingua se si vuole coprire ancora più parole

**Suoni (luglio 2026):**
- `js/audio-manager.js` — classe `AudioManager` procedurale via Web Audio API (oscillatori sine/triangle/square/sawtooth), **nessun file audio esterno** da ospitare/caricare
- Suoni implementati: parola trovata (arpeggio a due note, pitch scala con i punti), parola duplicata (click neutro), parola non valida (thud discendente), tick timer (ultimi 10s, più acuto/urgente negli ultimi 3s), fine round (sequenza discendente a 3 note)
- `unlock()` chiamato al primo tap (su categoria o sulla griglia) per sbloccare l'`AudioContext` su iOS/Safari secondo le policy di autoplay
- Toggle mute (🔊/🔇) in alto a destra sia nella home sia nell'header di gioco, stato persistito in `localStorage` (`scontro_sound_muted`)
- Testato con jsdom + `AudioContext` fittizia: rendering categorie, transizione a `playing`, toggle mute e persistenza — nessuna eccezione

**Livelli di difficoltà (luglio 2026):**
- Tre livelli configurabili in `js/game.js` (oggetto `DIFFICULTIES`): **Facile** 4×4 / 75s / 6 parole, **Normale** 5×5 / 90s / 8 parole (default, comportamento originale), **Difficile** 6×6 / 120s / 10 parole
- Selettore a 3 pulsanti nella home, sopra la griglia categorie, con etichetta e formato "size × size · secondi"
- Scelta persistita in `localStorage` (`scontro_difficulty`) e riportata automaticamente all'apertura successiva
- `grid-generator.js` e `path-finder.js` erano già parametrici sulla dimensione, quindi non hanno richiesto modifiche — solo `game.js` ora passa `diff.size`/`diff.wordsToPlant`/`diff.seconds` invece delle vecchie costanti fisse
- Badge difficoltà aggiunto nell'header di gioco accanto alla categoria
- **Testato**: generazione griglia su tutte le 7 categorie × 3 difficoltà (21 combinazioni), 0 errori, 0-1ms di generazione. Nota: su **Facile (4×4) con Professioni** si piantano solo 2 parole su 6 target (parole della categoria mediamente più lunghe di quelle che entrano in una griglia così piccola) — resta giocabile ma è la combinazione più "povera"; se vuoi la miglioriamo filtrando parole più corte quando la difficoltà è facile

## Cosa manca / prossimi passi

**Prima di andare live:**
- [ ] Test reale su mobile (il drag è testato solo in logica, non su device touch reali — verificare sensibilità/hit-area delle celle su schermi piccoli, specialmente sulla griglia 6x6 di Difficile)
- [ ] Verificare che tutte le 872 parole siano corrette/senza errori — le liste sono compilate da me, andrebbero riviste da un madrelingua prima del lancio (soprattutto Nazioni/Città meno comuni)

**Miglioramenti gameplay:**
- [x] Livelli di difficoltà (griglia 4x4/5x5/6x6, timer variabile) — vedi sopra
- [ ] Punteggio persistente / storico partite (localStorage, come fatto per mysticaoracoli)
- [x] Suoni (trovata parola, tick timer, fine round) — implementati proceduralmente, vedi sopra
- [ ] Animazione feedback più ricca su parola trovata (al momento solo flash colore tessera)
- [ ] Categorie extra: potenziale AdSense-friendly se lo rendi un sito standalone con più contenuto (regole, curiosità per categoria, ecc.)
- [ ] (Opzionale) Su Facile, dare priorità a parole più corte nel pool candidate per piantarne di più

**Non fatto per scelta (da tua richiesta):**
- Multiplayer/backend — resta single-player, nessun server. Se lo vuoi in futuro serve Firebase/Supabase per sync griglia in tempo reale tra 2 giocatori (hai già Firestore su mysticaoracoli, potresti riusarlo)

**Monetizzazione (se rilevante):**
- [ ] Se pubblichi su dominio proprio: AdSense come gli altri progetti, o Stripe per skin/categorie premium
- [ ] Se resta un side-tool: nessuna azione necessaria

**Piccola cosa rimasta indietro:**
- [ ] `README.md` nel repo mostra ancora "Categorix" come titolo — solo cosmetico, non impatta il funzionamento

## File di riferimento
- Zip più recente consegnato: `scontro-delle-ultime-parole.zip` — progetto completo con rebranding, favicon/PWA/OG e suoni procedurali
- `README.md` (dentro lo zip) — istruzioni deploy + come estendere categorie (titolo da aggiornare)

