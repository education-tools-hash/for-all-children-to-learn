// Shared browser-side stubs for the ringo-potton Playwright suites (loaded with context.addInitScript).
//
// SPEECH_STUB: speechSynthesis records every speak() text in window.__sp. By default it never fires onend; opt in with
//                window.__spEndMs = 3000          -> each spoken utterance fires onend that long after speak()
//                                                    (unless cancel() was called in between)
// AUDIO_STUB:  HTMLAudioElement replacement that records construction / play / pause in window.__au
//              ({op, src, muted}) and can be told to fail:
//                window.__auFail = true           -> every play() rejects (NotAllowedError), like a blocked autoplay
//                window.__auErrorSrc = 'ringo-3'  -> files whose src contains it carry .error (never loaded)
//              By default a playing file never ends; opt in with
//                window.__auDur = { okotowari: 6192 } -> a file whose src contains a key ends that many ms after play()
//                                                    unless paused first: {op:'ended'} is recorded and onended fires
//              A page can also be run without any Audio API: NO_AUDIO_STUB deletes window.Audio.
// SCOPE: these prove what the app asks the browser to do; they are not an iPad Safari / real audio result.
const SPEECH_STUB = `
  (function () {
    window.__sp = [];
    window.__spThrow = false;
    window.__spGen = 0;
    function U(t) { this.text = t; this.lang = ''; this.rate = 1; this.volume = 1; }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speaking: false, pending: false,
      speak: function (u) {
        if (window.__spThrow) throw new Error('speak failed'); window.__sp.push(u.text);
        if (typeof window.__spEndMs === 'number') { var gen = window.__spGen; setTimeout(function () { if (gen === window.__spGen && u.onend) u.onend({}); }, window.__spEndMs); }
      },
      cancel: function () { window.__sp.push('CANCEL'); window.__spGen = (window.__spGen || 0) + 1; },
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
      this.currentTime = 0; this.paused = true; this.error = null; this.onerror = null; this.onended = null; this.__pid = 0;
      if (window.__auErrorSrc && this.src.indexOf(window.__auErrorSrc) !== -1) this.error = { code: 4 };
      window.__au.push({ op: 'new', src: this.src });
    }
    A.prototype.play = function () {
      window.__au.push({ op: 'play', src: this.src, muted: !!this.muted });
      if (window.__auFail) { this.paused = true; return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }
      this.paused = false;
      var dur = null, d = window.__auDur, self = this;
      if (d) for (var k in d) if (this.src.indexOf(k) !== -1) dur = d[k];
      if (dur !== null) {
        var pid = ++this.__pid;
        setTimeout(function () {
          if (pid !== self.__pid || self.paused) return;   // paused / restarted before the end
          self.paused = true; window.__au.push({ op: 'ended', src: self.src, muted: !!self.muted });
          if (self.onended) self.onended({});
        }, dur);
      }
      return Promise.resolve();
    };
    A.prototype.pause = function () { this.__pid++; if (!this.paused) window.__au.push({ op: 'pause', src: this.src }); this.paused = true; };
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
