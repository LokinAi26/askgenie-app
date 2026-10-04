// Speech helpers: recognition + synthesis, with honest support checks.

export function recognitionSupported() {
  return (
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export function synthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function makeRecognizer(lang = "en-US") {
  if (!recognitionSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export function getVoices() {
  if (!synthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

// Speak text; resolves when done, rejects on error. Cancels any current speech first.
export function speak(text, { lang = "en-US", voiceURI = "" } = {}) {
  return new Promise((resolve, reject) => {
    if (!synthesisSupported()) return reject(new Error("speech synthesis not supported"));
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (voiceURI) {
      const v = synth.getVoices().find((x) => x.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => resolve();
    u.onerror = (e) => reject(new Error(e.error || "speech error"));
    // Safety: never hang forever.
    setTimeout(() => resolve(), Math.max(8000, text.length * 120));
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (synthesisSupported()) window.speechSynthesis.cancel();
}
