// AudioManager — suoni procedurali via Web Audio API (oscillatori), zero file esterni.
// Persistenza mute in localStorage, stessa convenzione key-prefissata degli altri progetti.

const MUTE_KEY = "scontro_sound_muted";

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    return this.ctx;
  }

  // Da chiamare al primo gesto utente (pointerdown/touchstart) per sbloccare l'AudioContext su iOS/Safari.
  unlock() {
    const ctx = this._ensureContext();
    if (ctx.state === "suspended") ctx.resume();
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    return this.muted;
  }

  _tone({ freq, duration = 0.14, type = "sine", gain = 0.18, delay = 0, glideTo = null }) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (ctx.state === "suspended") ctx.resume();

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);

    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  // Parola valida e nuova: arpeggio a due note, più acuto/ricco per parole lunghe/punteggio alto.
  playFound(points = 1) {
    const base = 520 + Math.min(points, 11) * 22;
    this._tone({ freq: base, duration: 0.1, type: "triangle", gain: 0.16 });
    this._tone({ freq: base * 1.5, duration: 0.16, type: "triangle", gain: 0.14, delay: 0.07 });
  }

  // Parola valida ma già trovata: click morbido e neutro.
  playDuplicate() {
    this._tone({ freq: 340, duration: 0.07, type: "sine", gain: 0.1 });
  }

  // Parola non valida: piccolo "thud" discendente.
  playInvalid() {
    this._tone({ freq: 180, duration: 0.12, type: "sawtooth", gain: 0.09, glideTo: 90 });
  }

  // Tick del timer. urgent=true negli ultimi secondi (pitch più alto).
  playTick(urgent = false) {
    this._tone({
      freq: urgent ? 880 : 660,
      duration: 0.05,
      type: "square",
      gain: urgent ? 0.09 : 0.05,
    });
  }

  // Fine round: piccola sequenza discendente-poi-ferma, riconoscibile ma non invadente.
  playRoundEnd() {
    this._tone({ freq: 660, duration: 0.14, type: "triangle", gain: 0.16 });
    this._tone({ freq: 494, duration: 0.14, type: "triangle", gain: 0.16, delay: 0.13 });
    this._tone({ freq: 392, duration: 0.28, type: "triangle", gain: 0.17, delay: 0.26 });
  }

  // Parola bonus (x3, non piantata ma formatasi per caso): oltre al normale
  // playFound, un piccolo "luccichio" di 4 note acute in rapida successione
  // — pensato per sembrare un po' magico/prezioso, in tema con l'estetica
  // "tesoro" del gioco.
  playBonusSparkle() {
    const notes = [1046, 1318, 1568, 2093]; // Do6, Mi6, Sol6, Do7
    notes.forEach((freq, i) => {
      this._tone({ freq, duration: 0.09, type: "sine", gain: 0.09, delay: i * 0.045 });
    });
  }

  // Combo: parole trovate in rapida successione (entro COMBO_WINDOW_MS in
  // game.js). Ogni livello di combo aggiunge una nota in più all'arpeggio,
  // così il suono "cresce" percettibilmente con lo streak, fino a un tetto
  // per non diventare fastidioso sulle combo lunghissime.
  playCombo(level) {
    const steps = Math.min(level, 6);
    const baseFreq = 523; // Do5
    for (let i = 0; i < steps; i++) {
      this._tone({
        freq: baseFreq * Math.pow(1.2, i),
        duration: 0.08,
        type: "triangle",
        gain: 0.1,
        delay: i * 0.035,
      });
    }
  }

  // Nuovo record (punteggio o parola): fanfara più ricca del semplice
  // playRoundEnd, con un accordo finale a tre voci sovrapposte — riservata
  // ai momenti davvero celebrativi nella schermata risultati.
  playRecordFanfare() {
    const run = [523, 659, 784, 1046]; // Do-Mi-Sol-Do (arpeggio maggiore)
    run.forEach((freq, i) => {
      this._tone({ freq, duration: 0.12, type: "triangle", gain: 0.15, delay: i * 0.09 });
    });
    // Accordo finale: tre note simultanee per un timbro più pieno.
    const chordDelay = run.length * 0.09 + 0.05;
    [784, 1046, 1318].forEach((freq) => {
      this._tone({ freq, duration: 0.5, type: "sine", gain: 0.11, delay: chordDelay });
    });
  }
}

// Singleton condiviso da tutto il gioco.
export default new AudioManager();
