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

**Due nuove categorie (luglio 2026):**
- **Corpo Umano** 🧍 — 99 parole (`js/categories/corpo-umano.js`)
- **Mezzi di Trasporto** 🚗 — 64 parole (`js/categories/mezzi-trasporto.js`)
- Totale ora **1035 parole su 9 categorie** (era 872 su 7)
- **Validazione**: ogni parola candidata controllata a script contro il dizionario italiano completo (`dictionary-extra.js`, 525.836 forme) — ha beccato 1 duplicato (MENTO in Corpo Umano) e 1 parola non presente nel dizionario (MINIBUS, rimossa per sicurezza); ho anche trovato e tolto a mano un errore semantico mio (MURETTO era finito per sbaglio tra i mezzi di trasporto — la validazione sul dizionario non lo becca perché "muretto" è comunque una parola italiana valida, solo non è un mezzo di trasporto)
- **Testato**: generazione griglia su entrambe le nuove categorie × 3 difficoltà, 0 errori, piazzamento parole in linea con le altre categorie (~5-10 su 6-10 target a seconda della difficoltà)
- `README.md` aggiornato con la tabella parole/categoria e i riferimenti a timer/target ormai variabili per difficoltà (erano rimasti al vecchio 90s/8 parole fisso)
- Nota: essendo liste compilate da me come le altre 7, valgono le stesse avvertenze — andrebbero riviste da un madrelingua prima del lancio

**Animazione feedback più ricca su parola trovata (luglio 2026):**
- Popup "+N punti" (o "×3 +N" per le bonus, colore diverso per bonus/extra/categoria) che sale e sfuma sopra le celle della parola appena trovata, posizionato dinamicamente sulla media delle coordinate delle celle selezionate
- Le celle della parola trovata ora fanno un piccolo "pop" (scala + lieve rotazione) oltre al flash colore già presente, per un feedback più tattile
- Il punteggio in header pulsa (scala su e giù) ad ogni parola trovata, non solo si aggiorna staticamente
- La parola appena aggiunta alla lista "Trovate" entra con una piccola animazione di comparsa invece di apparire di scatto nel refresh della lista
- **Testato**: `node --check` ok su `game.js`, graffe CSS bilanciate (91/91) in `style.css`; logica del popup verificata a mano (calcolo posizione da `getBoundingClientRect`, rimozione sia via `animationend` sia via timeout di sicurezza a 1200ms per evitare popup "fantasma" se l'evento non scatta)

**README + punteggio persistente + priorità parole corte su Facile (luglio 2026):**
- `README.md`: titolo aggiornato da "Categorix" a "Scontro delle Ultime Parole", descrizione aggiornata (difficoltà 4x4/5x5/6x6, dizionario extra, vocabolario esteso)
- **Storico partite persistente** (`localStorage`, chiave `scontro_history`, max 50 partite, più recenti in cima): ogni partita conclusa (`endRound`) salva categoria, difficoltà, punteggio, parole trovate. Home page mostra ora: partite giocate totali, miglior punteggio assoluto, e le ultime 5 partite in una mini-lista (categoria/difficoltà/punti)
- **Record per categoria+difficoltà**: a fine round si confronta il punteggio con il migliore già registrato per quella combinazione categoria/difficoltà (non un unico record globale) — schermata risultati mostra "🏆 Nuovo record!" oppure il record attuale. Il confronto avviene PRIMA di salvare la partita corrente nello storico, altrimenti una partita "batterebbe" sempre se stessa
- **Facile (4×4) pianta più parole**: `grid-generator.js` ora, solo su griglie ≤4×4, prova prima le parole più corte della categoria (a parità di lunghezza l'ordine resta casuale) — su Professioni la media è passata da ~2/6 a ~3,9/6 parole piantate; verificato che le altre difficoltà/categorie non hanno subito regressioni (test su tutte le 7 categorie × 3 difficoltà, 0 errori)
- **Testato**: sintassi `node --check` ok su `game.js`/`grid-generator.js`; logica storico/record testata con `localStorage` fittizio (rilevamento nuovo record, record separati per categoria+difficoltà, cap a 50 partite, ordine più-recente-in-cima) — tutti i casi passano
- Non fatto: nessuna UI per "azzerare lo storico" — se un giorno serve, basta aggiungere un pulsante che chiama `localStorage.removeItem("scontro_history")`
- Non fatto: animazione feedback più ricca su parola trovata (resta solo il flash colore tessera) — se vuoi la aggiungo in un prossimo giro

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

**Verifica dizionario su tutte le 9 categorie + Multiplayer "Sfida un amico" + AdSense (luglio 2026):**
- **Verifica dizionario completa**: script Node ad-hoc che confronta tutte le 1035 parole delle 9 categorie contro `dictionary-extra.js` (525.836 forme), controllando anche duplicati interni. Trovati e corretti 2 problemi reali: `BEROE` in Animali (genere scientifico oscuro di ctenoforo, non un animale riconoscibile) → sostituito con `SPIGOLA`; `SEDANORAPA` in Frutta & Verdura (composto non standard, e "sedano" era già presente da solo nella lista) → sostituito con `PORCINO`. Le altre "mancanze" segnalate dallo script (nomi propri in Città/Nazioni, `ALBATROS`/`SURICATO` come varianti valide, `ARCIERIA`, termini sportivi stranieri come `PADEL`/`FUTSAL`/`CROSSFIT`) sono falsi positivi verificati uno per uno: sono parole corrette, solo assenti dal dizionario generico perché nomi propri o termini rari/stranieri. Zero duplicati residui.
- **Multiplayer "Sfida un amico" (1v1 in tempo reale), implementato per intero:**
  - `js/grid-generator.js`: aggiunta `createSeededRng(seed)` (mulberry32) e parametro `rng` opzionale su `generateGrid`/`placeWord`/`shuffle`/`randomLetter` — con lo stesso seed due dispositivi generano *esattamente* la stessa griglia senza doverla trasmettere. Comportamento in singolo giocatore invariato (continua a usare `Math.random()`). Testato: stesso seed → griglia identica, seed diverso → griglia diversa.
  - `js/firebase-config.js` (nuovo): config Firebase con placeholder e istruzioni passo-passo nei commenti (può riusare lo stesso progetto Firebase di mysticaoracoli, basta aggiungere Firestore con le regole indicate nel file). Finché non viene compilata, `isFirebaseConfigured` è `false` e tutto il flusso multiplayer mostra un messaggio gentile invece di tentare connessioni o andare in errore.
  - `js/multiplayer.js` (nuovo): stanze duello su Firestore (collezione `duels`, un documento per stanza, codice a 5 caratteri). `createDuel`/`joinDuel`/`listenToDuel`/`updateMyProgress`/`finishMyRound`/`abandonDuel`. Nessuna autenticazione (gioco casual, uid locale generato e salvato in `localStorage`).
  - `js/game.js`: 3 nuove schermate — `duel-setup` (categoria+difficoltà, poi crea stanza), `duel-join` (inserimento codice a 5 caratteri, con campo nome facoltativo), `duel-lobby` (mostra codice/link da condividere, countdown condiviso 3-2-1 quando il secondo giocatore entra, calcolato da un `startAt` scritto su Firestore così i due dispositivi partono insieme). Durante il round, pillola "avversario" nell'header con punteggio live (aggiornato via `onSnapshot` senza ridisegnare tutta la griglia, per non rompere il drag in corso). A fine round, `endRound` invia il punteggio finale e la schermata risultati mostra un banner con entrambi i punteggi affiancati e il verdetto (vinto/perso/pareggio), aggiornato in tempo reale se l'avversario finisce dopo di te.
  - Link di invito diretto: il pulsante "Copia link" genera un URL `?duel=CODICE` che, se aperto, porta dritto alla schermata di join col codice precompilato.
  - **Testato** (senza un vero progetto Firebase collegato, quindi senza poter verificare la sincronizzazione reale a due dispositivi): `node --check` ok su tutti i nuovi file; test con Playwright headless — home, avvio partita singola, schermata "Sfida un amico" e schermata "Ho un codice" caricano senza errori JS e mostrano correttamente il messaggio "multiplayer non configurato" (comportamento atteso finché non viene collegato un progetto Firebase reale); nessun `pageerror` in nessuno dei flussi testati.
  - **Da fare tu per attivarlo davvero**: segui le istruzioni in `js/firebase-config.js` (5 minuti, puoi riusare il progetto Firebase di mysticaoracoli) e poi testa un duello reale tra due dispositivi/tab — questa parte non ho potuto verificarla end-to-end perché il sandbox in cui lavoro non ha accesso alla rete esterna.
- **AdSense, pronto ma disattivato finché non inserisci i tuoi ID:**
  - `js/game.js`: costanti `ADSENSE_CLIENT`/`ADSENSE_SLOTS` in cima al file — finché `ADSENSE_CLIENT` contiene ancora `XXXX` nessuno script viene caricato e nessun riquadro pubblicitario viene mostrato (verificato: 0 elementi `.ad-slot` nel DOM quando disattivato).
  - Due posizionamenti "gentili": home (sotto ai pulsanti sfida) e schermata risultati (in fondo, dopo le azioni) — **mai durante il round di gioco vero e proprio**, per non interrompere l'esperienza.
  - `ads.txt` aggiunto nella root (placeholder commentato, va scommentato col tuo publisher ID reale) e meta tag `google-adsense-account` commentato in `index.html`.
- Non fatto: nessun test con un vero account AdSense collegato (richiede il tuo publisher ID reale, non posso generarlo).

## Cosa manca / prossimi passi

**Splash iniziale animato + recap di fine round animato, in stile "colori/dettagli/animazioni" di Ruzzle (luglio 2026):**
- **Splash all'avvio**: overlay a schermo intero con le lettere-tile di "SCONTRO" che entrano una dopo l'altra con un rimbalzo (stesso look delle tile di gioco: parchment/oro/corallo, non blu come Ruzzle — coerente con l'identità visiva già esistente del progetto), sottotitolo e "tocca per iniziare" che sfumano dentro dopo. Si chiude da solo dopo ~1.6s o subito al tocco; il contenuto vero viene renderizzato solo a splash chiuso (nessun flash prima dell'animazione). Rispetta `prefers-reduced-motion` (chi ha "riduci animazioni" attivo nel sistema vede tutto subito, senza rimbalzi).
- **Schermata risultati riprogettata come "recap" animato**:
  - Punteggio con animazione count-up (sale da 0 al valore finale con easing, non compare più di colpo)
  - Mini-anteprima della griglia giocata con evidenziata in oro/corallo la parola migliore trovata (o la più lunga se nessuna ha dato punti), con etichetta "PAROLA - N punti" sotto — stessa idea della cartolina che Ruzzle mostra nel suo recap
  - 4 "stat card" con barra animata che si riempie: Precisione (% di parole valide sui tentativi con selezione ≥3 lettere — nuova statistica, tracciata durante il round), Parole trovate, Parola più lunga e Parola migliore — queste ultime due confrontate con un **record assoluto persistente** (nuovo `localStorage` key `scontro_word_records`, indipendente da categoria/difficoltà) e con nastrino "NUOVO RECORD!" quando il round li batte
  - Tutti i blocchi della schermata entrano in sequenza con un piccolo fade+slide-up scaglionato, invece di comparire tutti insieme
- **Testato**: `node --check` su tutti i file JS modificati; CSS con parentesi bilanciate verificate a parte; test end-to-end con Playwright (clock fake per avanzare il timer senza aspettare 90s reali) — splash che appare e si chiude al tocco, schermata categorie dopo lo splash, partita che parte, timer che scade, schermata risultati che compare con le 4 stat card e nessun errore JavaScript in console. Non ho potuto verificare via test automatico il caso "parola trovata con griglia mini evidenziata" (richiederebbe simulare un drag su un percorso valido specifico, che dipende dalla griglia generata casualmente ad ogni run) — verificato invece via lettura del codice, la logica è la stessa già testata per il resto del flusso (il percorso della parola trovata è la stessa selezione già usata per disegnare la scia sulla griglia durante il gioco).

**Tocchi "speciali" — combo, luccichio bonus e celebrazione da record (luglio 2026):**
- **Sistema di combo**: parole nuove trovate entro 4 secondi l'una dall'altra fanno crescere uno streak. Da 2 in su compare un popup "COMBO ×N" al centro della griglia (colore e dimensione crescono col livello, fino a un tetto) accompagnato da un arpeggio audio che aggiunge una nota per livello — premia chi trova parole senza esitare, senza toccare il punteggio reale (puramente feedback, zero rischio di sbilanciare la scoring table).
- **Luccichio sulle parole bonus (×3)**: oltre al flash oro/corallo già esistente, ora le celle emettono un piccolo sciame di stelline che volano via in direzioni casuali, insieme a un suono "sparkle" a 4 note acute (in `audio-manager.js`) — pensato per far sentire le parole bonus davvero speciali, in tema con l'estetica "tesoro" del gioco.
- **Celebrazione da nuovo record nella schermata risultati**: quando il round batte un record (punteggio, parola più lunga o parola migliore — vedi sezione precedente), parte una pioggia di coriandoli dorati/corallo/teal dall'alto dello schermo, il numero del punteggio pulsa con un bagliore dorato, e suona una fanfara più ricca (`playRecordFanfare`, arpeggio + accordo finale a tre voci) al posto del semplice suono di fine round — separata di 300ms per non sovrapporsi.
- Tutti gli effetti rispettano `prefers-reduced-motion` (disattivati per chi ha le animazioni ridotte a livello di sistema) e il toggle audio esistente (muti se il suono è disattivato).
- **Testato**: oltre a `node --check` su tutti i file e verifica parentesi CSS, ho scritto un test end-to-end che legge la griglia generata via DOM, calcola via codice un percorso reale per una parola della categoria (es. "CANE", "GATTO"), simula il drag reale con Playwright e verifica che la parola venga trovata, il punteggio si aggiorni e il popup combo compaia trovando due parole in rapida successione — nessun errore JavaScript in nessuno dei casi.

**Prima di andare live:**
- [ ] Test reale su mobile (il drag è testato solo in logica, non su device touch reali — verificare sensibilità/hit-area delle celle su schermi piccoli, specialmente sulla griglia 6x6 di Difficile)
- [x] Verificare che tutte le 1035 parole (9 categorie) siano corrette — vedi audit completo sopra, corretti i 2 errori reali trovati
- [ ] Collegare un progetto Firebase reale a `js/firebase-config.js` e testare un duello vero tra due dispositivi (vedi sopra)
- [ ] Inserire il publisher ID AdSense reale in `js/game.js` (`ADSENSE_CLIENT`/`ADSENSE_SLOTS`) e in `ads.txt` quando l'account è pronto

**Miglioramenti gameplay:**
- [x] Livelli di difficoltà (griglia 4x4/5x5/6x6, timer variabile) — vedi sopra
- [x] Punteggio persistente / storico partite (localStorage, come fatto per mysticaoracoli) — vedi sopra
- [x] Suoni (trovata parola, tick timer, fine round) — implementati proceduralmente, vedi sopra
- [x] Animazione feedback più ricca su parola trovata — popup punteggio, cell-pop, pulse punteggio, entrata animata in lista, vedi sopra
- [x] Categorie extra: aggiunte Corpo Umano e Mezzi di Trasporto (9 categorie totali) — vedi sopra. Il lato "sito standalone AdSense-friendly con più contenuto" resta da valutare a parte, vedi sezione Monetizzazione
- [x] Su Facile, priorità a parole più corte nel pool candidate per piantarne di più — vedi sopra
- [x] Multiplayer "Sfida un amico" — implementato per intero (Firestore, griglia condivisa via seed, punteggi live, countdown sincronizzato), manca solo che tu colleghi un progetto Firebase reale — vedi sopra

**Monetizzazione:**
- [x] AdSense integrato e pronto (script caricato dinamicamente solo se configurato, 2 slot non intrusivi su home e risultati, mai durante il round) — manca solo il tuo publisher ID reale, vedi sopra
- [ ] Se vuoi anche skin/categorie premium: Stripe, sullo stesso schema già usato su mysticaoracoli

**Piccola cosa rimasta indietro:**

_(nessuna al momento)_

## File di riferimento
- Zip più recente consegnato: `scontro-delle-ultime-parole.zip` — progetto completo con rebranding, favicon/PWA/OG, suoni procedurali, multiplayer "Sfida un amico" e AdSense pronto (da configurare)
- `README.md` (dentro lo zip) — istruzioni deploy + come estendere categorie (titolo da aggiornare)

