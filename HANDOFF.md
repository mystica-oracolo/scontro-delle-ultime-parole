# Categorix — Handoff

Ruzzle a tema: griglia 5x5, parole valide solo se appartengono alla categoria scelta (Animali, Città, Professioni, Frutta & Verdura, Sport, Colori, Nazioni).

## Cosa è stato fatto

**Architettura (vanilla JS, ES modules, nessuna build step):**
- `js/trie.js` — Trie per validazione rapida parola/prefisso
- `js/grid-generator.js` — genera la griglia 5x5 piantando parole della categoria come percorsi liberi a 8 direzioni (non linee rette come il word-search classico), poi riempie le celle vuote con lettere pesate per frequenza italiana
- `js/path-finder.js` — scan completo della griglia a fine generazione per trovare tutte le parole realmente presenti (piantate + bonus casuali), usato per la schermata risultati
- `js/game.js` — stato di gioco, 3 schermate (selezione categoria → gioco → risultati), timer 90s, input drag/swipe (Pointer Events + fallback touch), punteggio stile Ruzzle
- `css/style.css` — identità visiva "quaderno/inchiostro": palette verde inchiostro + parchment + accenti teal/oro/corallo, font Fraunces/Work Sans/IBM Plex Mono, tessere con bevel, trail SVG sul drag

**Database parole:** 872 parole totali su 7 categorie (Animali 204, Città 172, Professioni 132, Frutta & Verdura 107, Sport 96, Colori 67, Nazioni 94). Liste pulite, deduplicate, solo lettere A-Z, 3-12 caratteri.

**Testato:** generazione griglia su tutte le 7 categorie, 0 errori di piazzamento, tempo di generazione 1-33ms, 5-8 parole piantate su 8 target per round (varia in base a quanto le parole si incastrano).

**Consegnato:** repo pronto in `categorix.zip`, deploy diretto su GitHub Pages (`index.html` alla root, nessuna build), README con istruzioni deploy e come aggiungere categorie.

## Cosa manca / prossimi passi

**Prima di andare live:**
- [ ] Test reale su mobile (il drag è testato solo in logica, non su device touch reali — verificare sensibilità/hit-area delle celle su schermi piccoli)
- [ ] Verificare che tutte le 872 parole siano corrette/senza errori — le liste sono compilate da me, andrebbero riviste da un madrelingua prima del lancio (soprattutto Nazioni/Città meno comuni)
- [ ] Favicon, meta tag OG per condivisione social, manifest PWA (icone, `manifest.json`) se vuoi installabilità come gli altri tuoi progetti

**Miglioramenti gameplay:**
- [ ] Livelli di difficoltà (griglia 4x4/5x5/6x6, timer variabile)
- [ ] Punteggio persistente / storico partite (localStorage, come fatto per mysticaoracoli)
- [ ] Suoni (trovata parola, tick timer, fine round) — hai già una classe AudioManager riusabile da mysticaoracoli.it
- [ ] Animazione feedback più ricca su parola trovata (al momento solo flash colore tessera)
- [ ] Categorie extra: potenziale AdSense-friendly se lo rendi un sito standalone con più contenuto (regole, curiosità per categoria, ecc.)

**Non fatto per scelta (da tua richiesta):**
- Multiplayer/backend — resta single-player, nessun server. Se lo vuoi in futuro serve Firebase/Supabase per sync griglia in tempo reale tra 2 giocatori (hai già Firestore su mysticaoracoli, potresti riusarlo)

**Monetizzazione (se rilevante):**
- [ ] Se pubblichi su dominio proprio: AdSense come gli altri progetti, o Stripe per skin/categorie premium
- [ ] Se resta un side-tool: nessuna azione necessaria

## File di riferimento
- `categorix.zip` — progetto completo
- `README.md` (dentro lo zip) — istruzioni deploy + come estendere categorie
