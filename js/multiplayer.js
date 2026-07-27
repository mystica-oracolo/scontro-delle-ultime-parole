// Modalità "Sfida un amico" — duello 1v1 asincrono in tempo reale.
//
// Architettura: nessun server custom, solo Firestore (via Firebase). Un
// client crea una "stanza" (documento in collezione "duels") con un codice
// a 5 caratteri, una categoria/difficoltà e un SEED numerico condiviso.
// Il secondo client entra con il codice: da quel momento entrambi i client
// generano localmente *la stessa identica griglia* con
// generateGrid(category, size, words, createSeededRng(seed)) — vedi
// grid-generator.js — quindi non serve mai trasmettere la griglia stessa,
// solo punteggi e stato via onSnapshot in tempo reale.
//
// Se js/firebase-config.js contiene ancora la config placeholder,
// isFirebaseConfigured è false e tutte le funzioni qui sotto lanciano un
// errore "MULTIPLAYER_NOT_CONFIGURED" gestito da game.js con un messaggio
// gentile invece di un crash silenzioso in console.

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const ROOM_TTL_MS = 1000 * 60 * 60 * 2; // stanze più vecchie di 2h sono considerate morte
const UID_KEY = "scontro_duel_uid";
const NAME_KEY = "scontro_duel_name";

let _app = null;
let _db = null;
let _fs = null; // namespace delle funzioni firestore importate dinamicamente

async function ensureFirebase() {
  if (!isFirebaseConfigured) {
    const err = new Error(
      "Multiplayer non configurato: aggiungi le tue credenziali Firebase in js/firebase-config.js"
    );
    err.code = "MULTIPLAYER_NOT_CONFIGURED";
    throw err;
  }
  if (_db) return _db;

  const [{ initializeApp }, fs] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"),
  ]);

  _app = initializeApp(firebaseConfig);
  _db = fs.getFirestore(_app);
  _fs = fs;
  return _db;
}

export function getMyUid() {
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(UID_KEY, uid);
  }
  return uid;
}

export function getMyName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setMyName(name) {
  localStorage.setItem(NAME_KEY, (name || "").trim().slice(0, 18));
}

function randomCode() {
  // Niente 0/O/1/I per evitare ambiguità quando il codice viene dettato/letto a voce.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Crea una nuova stanza duello e vi entra come primo giocatore (host).
 * Ritorna { code, uid, seed }.
 */
export async function createDuel({ categoryId, difficultyId }) {
  const db = await ensureFirebase();
  const uid = getMyUid();
  const name = getMyName() || "Giocatore 1";
  const seed = Math.floor(Math.random() * 2 ** 31);

  // Piccolo retry in caso (raro) di collisione di codice.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const ref = _fs.doc(db, "duels", code);
    const snap = await _fs.getDoc(ref);
    if (snap.exists()) continue;

    await _fs.setDoc(ref, {
      code,
      categoryId,
      difficultyId,
      seed,
      status: "waiting", // waiting -> ready -> finished
      hostUid: uid,
      createdAt: Date.now(),
      startAt: null,
      players: {
        [uid]: { name, score: 0, wordsFound: 0, finished: false, joinedAt: Date.now() },
      },
    });
    return { code, uid, seed };
  }
  throw new Error("Non sono riuscito a generare un codice stanza libero, riprova.");
}

/**
 * Entra in una stanza esistente come secondo giocatore. Se entrambi i posti
 * sono già occupati da uid diversi dal proprio, lancia un errore "FULL".
 */
export async function joinDuel(code) {
  const db = await ensureFirebase();
  const uid = getMyUid();
  const ref = _fs.doc(db, "duels", code.toUpperCase().trim());
  const snap = await _fs.getDoc(ref);

  if (!snap.exists()) {
    const err = new Error("Codice non trovato. Controlla di averlo copiato bene.");
    err.code = "NOT_FOUND";
    throw err;
  }

  const data = snap.data();

  if (Date.now() - (data.createdAt || 0) > ROOM_TTL_MS) {
    const err = new Error("Questa stanza è scaduta, chiedi al tuo amico di crearne una nuova.");
    err.code = "EXPIRED";
    throw err;
  }

  const existingUids = Object.keys(data.players || {});
  if (!existingUids.includes(uid) && existingUids.length >= 2) {
    const err = new Error("Questa stanza è già piena.");
    err.code = "FULL";
    throw err;
  }

  const name = getMyName() || "Giocatore 2";
  const patch = {
    [`players.${uid}`]: {
      name,
      score: 0,
      wordsFound: 0,
      finished: false,
      joinedAt: Date.now(),
    },
  };
  // Appena il secondo giocatore entra, la stanza passa a "ready" e viene
  // fissato un countdown condiviso (3s da ora) così entrambi i client
  // partono nello stesso istante, anche se leggono lo startAt con qualche
  // decina di ms di scarto.
  if (existingUids.length === 1 && !existingUids.includes(uid)) {
    patch.status = "ready";
    patch.startAt = Date.now() + 3000;
  }

  await _fs.updateDoc(ref, patch);
  return { code: data.code, uid, seed: data.seed, categoryId: data.categoryId, difficultyId: data.difficultyId };
}

/**
 * Ascolta i cambiamenti di una stanza in tempo reale. `callback` riceve i
 * dati grezzi del documento (o null se la stanza non esiste più). Ritorna
 * la funzione di unsubscribe.
 */
export function listenToDuel(code, callback) {
  if (!_db) {
    // ensureFirebase() non è stato ancora chiamato in questo giro (es. link
    // diretto di invito aperto in un tab nuovo): lo richiamiamo al volo.
    ensureFirebase()
      .then((db) => {
        const ref = _fs.doc(db, "duels", code);
        return _fs.onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null));
      })
      .catch((err) => callback(null, err));
    return () => {};
  }
  const ref = _fs.doc(_db, "duels", code);
  return _fs.onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null));
}

/**
 * Aggiorna punteggio/parole trovate del giocatore corrente in tempo reale
 * (chiamato ad ogni parola trovata durante un duello: i documenti sono
 * piccoli e le scritture Firestore economiche, va benissimo per un gioco
 * casual 1v1).
 */
export async function updateMyProgress(code, { score, wordsFound }) {
  const db = await ensureFirebase();
  const uid = getMyUid();
  const ref = _fs.doc(db, "duels", code);
  await _fs.updateDoc(ref, {
    [`players.${uid}.score`]: score,
    [`players.${uid}.wordsFound`]: wordsFound,
  });
}

/**
 * Segna il proprio round come concluso. Quando entrambi i giocatori hanno
 * finished=true, il documento passa a status "finished" (lo fa chiunque dei
 * due client se ne accorga per primo leggendo lo snapshot, è idempotente).
 */
export async function finishMyRound(code, { score, wordsFound }) {
  const db = await ensureFirebase();
  const uid = getMyUid();
  const ref = _fs.doc(db, "duels", code);
  await _fs.updateDoc(ref, {
    [`players.${uid}.score`]: score,
    [`players.${uid}.wordsFound`]: wordsFound,
    [`players.${uid}.finished`]: true,
  });

  const snap = await _fs.getDoc(ref);
  const data = snap.data();
  const players = Object.values(data.players || {});
  if (players.length === 2 && players.every((p) => p.finished)) {
    await _fs.updateDoc(ref, { status: "finished" });
  }
}

/**
 * Elimina la stanza (usato quando l'host abbandona la lobby prima che il
 * secondo giocatore entri, per non lasciare stanze "waiting" morte in
 * giro — non indispensabile ma tiene la collezione più pulita).
 */
export async function abandonDuel(code) {
  try {
    const db = await ensureFirebase();
    await _fs.deleteDoc(_fs.doc(db, "duels", code));
  } catch {
    // best-effort, non blocca l'utente se fallisce
  }
}
