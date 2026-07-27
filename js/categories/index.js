import animali from "./animali.js";
import citta from "./citta.js";
import professioni from "./professioni.js";
import fruttaVerdura from "./frutta-verdura.js";
import sport from "./sport.js";
import colori from "./colori.js";
import nazioni from "./nazioni.js";
import corpoUmano from "./corpo-umano.js";
import mezziTrasporto from "./mezzi-trasporto.js";

// Ogni categoria ha: id, etichetta, icona (emoji, sostituibile con SVG),
// e la lista di parole valide (maiuscole, senza accenti/spazi/apostrofi).
export const CATEGORIES = [
  { id: "animali", label: "Animali", icon: "🐾", words: animali },
  { id: "citta", label: "Città", icon: "🏙️", words: citta },
  { id: "professioni", label: "Professioni", icon: "🛠️", words: professioni },
  { id: "frutta-verdura", label: "Frutta & Verdura", icon: "🍎", words: fruttaVerdura },
  { id: "sport", label: "Sport", icon: "🏆", words: sport },
  { id: "colori", label: "Colori", icon: "🎨", words: colori },
  { id: "nazioni", label: "Nazioni", icon: "🌍", words: nazioni },
  { id: "corpo-umano", label: "Corpo Umano", icon: "🧍", words: corpoUmano },
  { id: "mezzi-trasporto", label: "Mezzi di Trasporto", icon: "🚗", words: mezziTrasporto },
];

export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id);
}
