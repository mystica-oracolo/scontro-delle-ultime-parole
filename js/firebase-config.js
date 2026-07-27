// Configurazione Firebase per la modalità "Sfida un amico" (multiplayer 1v1).
//
// COME ATTIVARLA (5 minuti):
// 1. Vai su https://console.firebase.google.com, apri un progetto esistente
//    (puoi riusare lo stesso progetto Firebase già creato per mysticaoracoli,
//    non serve crearne uno nuovo) oppure creane uno nuovo dedicato.
// 2. Project settings → General → "Your apps" → aggiungi una Web app (</> ) se
//    non l'hai già fatta per questo dominio, e copia l'oggetto "firebaseConfig"
//    che ti mostra qui sotto, sostituendo i placeholder XXXX.
// 3. Nel menu laterale vai su "Firestore Database" → "Crea database" → scegli
//    "Avvia in modalità produzione" (le regole sotto bastano) e una region
//    vicina (es. eur3 - Europa).
// 4. In Firestore → Regole, incolla queste regole (limitano l'accesso alla
//    sola collezione "duels" usata da questo gioco, lettura/scrittura libera
//    perché non c'è autenticazione: è un gioco casual, non dati sensibili):
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /duels/{roomId} {
//          allow read, write: if true;
//        }
//      }
//    }
//
// 5. Sostituisci i valori qui sotto con quelli reali del tuo progetto e
//    ricarica la pagina: il pulsante "⚔️ Sfida un amico" si attiverà da solo
//    (il gioco rileva automaticamente se la config è ancora quella
//    placeholder e in quel caso mostra un avviso invece di crashare).
//
// Nota: nessuna chiave qui sotto è segreta in senso stretto (le chiavi Web
// Firebase sono pensate per stare nel codice client), ma vanno comunque
// protette dalle regole Firestore sopra, non dalla segretezza della chiave.

export const firebaseConfig = {
  apiKey: "XXXX-INSERISCI-LA-TUA-API-KEY",
  authDomain: "XXXX.firebaseapp.com",
  projectId: "XXXX",
  storageBucket: "XXXX.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX",
};

// Rilevamento automatico: finché non sostituisci la config sopra, il gioco
// sa che il multiplayer non è ancora configurato e mostra un messaggio
// invece di provare a connettersi (evitando errori in console per chi non
// ha ancora attivato Firebase).
export const isFirebaseConfigured =
  typeof firebaseConfig.apiKey === "string" && !firebaseConfig.apiKey.startsWith("XXXX");
