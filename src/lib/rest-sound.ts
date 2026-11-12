/**
 * The short tone when a rest runs out, with Web Audio. Browsers only let a
 * page make sound after the person has interacted with it, and iPhone Safari
 * only from an audio context resumed inside a tap, so the context is made
 * ready on the tap that checks a set (`primeRestSound`) and the tone plays
 * later from it. Anything that fails stays silent.
 */

type Ctx = AudioContext;
let context: Ctx | null = null;

function audioContextClass(): (new () => Ctx) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: new () => Ctx;
    webkitAudioContext?: new () => Ctx;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Whether the person has interacted with the page (sound is allowed). */
function interacted() {
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation;
  return activation ? activation.hasBeenActive : context !== null;
}

/** Call from a tap: makes the audio context ready for a tone later. */
export function primeRestSound() {
  try {
    const Context = audioContextClass();
    if (!Context) return;
    context ??= new Context();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    context = null;
  }
}

/** Two quick soft tones, if the page may make sound. */
export function playRestSound() {
  try {
    if (!context || !interacted()) return;
    if (context.state === "suspended") void context.resume().catch(() => {});
    const start = context.currentTime + 0.01;
    for (const [offset, frequency] of [
      [0, 880],
      [0.18, 1175],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
    }
  } catch {
    // No sound is never an error.
  }
}
