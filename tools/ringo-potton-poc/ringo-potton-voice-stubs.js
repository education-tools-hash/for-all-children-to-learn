// Shared browser-side stubs for the ringo-potton Playwright suites (loaded with context.addInitScript).
//
// SPEECH_STUB: speechSynthesis records every speak() text in window.__sp and never fires onend.
// AUDIO_STUB:  HTMLAudioElement replacement that records construction / play / pause in window.__au
//              ({op, src, muted}) and can be told to fail:
//                window.__auFail = true           -> every play() rejects (NotAllowedError), like a blocked autoplay
//                window.__auErrorSrc = 'ringo-3'  -> files whose src contains it carry .error (never loaded)
//              A page can also be run without any Audio API: NO_AUDIO_STUB deletes window.Audio.
// SCOPE: these prove what the app asks the browser to do; they are not an iPad Safari / real audio result.
const SPEECH_STUB = `
  (function () {
    window.__sp = [];
    window.__spThrow = false;
    function U(t) { this.text = t; this.lang = ''; this.rate = 1; this.volume = 1; }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speaking: false, pending: false,
      speak: function (u) { if (window.__spThrow) throw new Error('speak failed'); window.__sp.push(u.text); },
      cancel: function () { window.__sp.push('CANCEL'); },
      getVoices: function () { return []; },
      addEventListener: function () {}, removeEventListener: function () {}
    } });
  })();
`;
const AUDIO_STUB = `
  (function () {
    window.__au = [];
    window.__auFail = false;
    window.__auErrorSrc = null;
    function A(src) {
      this.src = src || ''; this.preload = ''; this.muted = false; this.volume = 1; this.playbackRate = 1;
      this.currentTime = 0; this.paused = true; this.error = null; this.onerror = null;
      if (window.__auErrorSrc && this.src.indexOf(window.__auErrorSrc) !== -1) this.error = { code: 4 };
      window.__au.push({ op: 'new', src: this.src });
    }
    A.prototype.play = function () {
      window.__au.push({ op: 'play', src: this.src, muted: !!this.muted });
      if (window.__auFail) { this.paused = true; return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }
      this.paused = false; return Promise.resolve();
    };
    A.prototype.pause = function () { if (!this.paused) window.__au.push({ op: 'pause', src: this.src }); this.paused = true; };
    A.prototype.load = function () {};
    A.prototype.addEventListener = function () {}; A.prototype.removeEventListener = function () {};
    window.Audio = A;
  })();
`;
const NO_AUDIO_STUB = `
  (function () { try { Object.defineProperty(window, 'Audio', { configurable: true, value: undefined }); } catch (e) {} })();
`;
const base = (src) => String(src).split('/').pop();
module.exports = { SPEECH_STUB, AUDIO_STUB, NO_AUDIO_STUB, base };
