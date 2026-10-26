/* ==========================================================================
   Stanford URTC — ASCII fields
   Draws a live field of characters into every <canvas data-ascii="scene">.

   Scenes
     terrain   Ridgelines rolling toward you across a valley (homepage hero)
     contour   A top-down topographic map drawn with - | / \ (page heroes, bands)
     race      The tracks racing down the screen, driven by scroll (homepage)
     poster    A poster session: posters with live charts, presenters, visitors (homepage)

   Canvas attributes
     data-seed="23"          Any number gives a different landscape
     data-word-from="#id"    Set that element's text in characters, exactly where it sits.
                             Its [data-ascii-run] children are drawn one by one, each in its
                             own font; data-ascii-run="accent" runs are drawn in cardinal.
                             The host gets .has-ascii-word, so CSS can hide the real text.
     data-intensity="0.7"    Overall brightness, 0–1

   The host is the closest [data-ascii-host]. Inside it:
     [data-ascii-horizon]    Terrain only: the horizon sits inside this element, and the
                             landscape never rises above its top edge (so it stays clear of
                             whatever sits above it, like the wordmark)

   The race reads its section, [data-race]:
     [data-race-stage]       The tall element that scrolling moves through (gets .is-live)
     [data-car="0"]          A craft (a button) that rides the canvas; clicking it brings its
                             track to the front
     [data-track="0"]        That track's notes, shown (.is-active) while it leads

   The pointer leaves a flowing wake: a ragged, comet-like trail that drags the lines
   along with it, brightens what it passes and turns it cardinal. With reduced motion,
   one still frame is drawn, nothing moves, and the race stays a plain list.
   ========================================================================== */
(function () {
  "use strict";

  var canvases = document.querySelectorAll("canvas[data-ascii]");
  if (!canvases.length || !window.requestAnimationFrame) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  var IDLE_MS = { terrain: 0, contour: 33, race: 33, poster: 50 };   // frame spacing when nothing is moving it
  var WAKE = 9;            // points in the pointer's wake
  var WAKE_MS = 45;        // a new point every this many ms
  var WAKE_PX = 70;        // reach of each point

  // Ink: five greys, a dim cardinal, cardinal, then a hot core for the sheen
  var STYLES = [
    "rgba(236, 235, 232, 0.13)",
    "rgba(236, 235, 232, 0.24)",
    "rgba(236, 235, 232, 0.4)",
    "rgba(236, 235, 232, 0.62)",
    "rgba(236, 235, 232, 0.9)",
    "rgba(240, 70, 75, 0.55)",
    "#f0464b",
    "#ffd8d3"
  ];
  var DIM = 5, ACCENT = 6, HOT = 7;
  var RAMP = codes(" .:-=+*#%@");
  var DENSE = codes("#@%&");
  var GLYPHS = codes("#%&*+=-:/\\<>01");
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return (v + 0.5) / 16; });
  var SPACE = 32, DOT = 46, COLON = 58, TILDE = 126, EQUALS = 61, DASH = 45, UNDER = 95, SLASH = 47, BACK = 92, BAR = 124, BANG = 33, CARET = 94, HASH = 35, ZERO = 48, ONE = 49;

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */
  function codes(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function slice(list) { return Array.prototype.slice.call(list); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // Integer hash -> [0, 1). Same inputs, same output, every frame.
  function hash(a, b) {
    var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function glyph(i, k) { return GLYPHS[(hash(i, k) * GLYPHS.length) | 0]; }

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  // Seeded 2-D value noise with smoothstep interpolation
  function makeNoise(seed) {
    var rand = rng(seed);
    var perm = new Uint8Array(512), vals = new Float32Array(256);
    var i, j, t;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
    for (i = 255; i > 0; i--) { j = (rand() * (i + 1)) | 0; t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    return function (x, y) {
      var x0 = Math.floor(x), y0 = Math.floor(y);
      var fx = x - x0, fy = y - y0;
      var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      var xi = x0 & 255, yi = y0 & 255, xj = (xi + 1) & 255, yj = (yi + 1) & 255;
      var a = vals[perm[perm[xi] + yi]], b = vals[perm[perm[xj] + yi]];
      var c = vals[perm[perm[xi] + yj]], d = vals[perm[perm[xj] + yj]];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  function fbm(n, x, y) {
    return n(x, y) * 0.5 + n(x * 2.03 + 17.1, y * 2.03 + 9.2) * 0.3 + n(x * 4.01 + 31.7, y * 4.01 + 3.3) * 0.2;
  }
  // Ridged noise: sharp crests, soft valleys
  function ridged(n, x, y) {
    var a = 1 - Math.abs(n(x, y) * 2 - 1);
    var b = 1 - Math.abs(n(x * 2.1 + 5.3, y * 2.1 + 1.7) * 2 - 1);
    var c = 1 - Math.abs(n(x * 4.3 + 9.1, y * 4.3 + 7.9) * 2 - 1);
    return a * a * 0.6 + b * b * 0.28 + c * c * 0.12;
  }

  // The character that best draws a line running along (tx, ty), screen y down
  function slopeChar(tx, ty) {
    var ax = Math.abs(tx), ay = Math.abs(ty);
    if (ay < ax * 0.42) return DASH;
    if (ax < ay * 0.42) return BAR;
    return tx * ty > 0 ? BACK : SLASH;
  }

  // Fallback horizon when the host doesn't mark one: higher on tall (phone) canvases
  function horizonFor(w, h) { return w / h < 0.9 ? 0.36 : 0.5; }

  function glow(ctx, x, y, r, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(240, 70, 75, " + alpha.toFixed(3) + ")");
    g.addColorStop(1, "rgba(240, 70, 75, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function debounce(fn, ms) {
    var id;
    return function () { clearTimeout(id); id = setTimeout(fn, ms); };
  }

  /* ---------------------------------------------------------------------- */
  /* Field                                                                   */
  /* ---------------------------------------------------------------------- */
  function Field(canvas) {
    var intensity = parseFloat(canvas.getAttribute("data-intensity"));
    var from = canvas.getAttribute("data-word-from");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.host = canvas.closest("[data-ascii-host]") || canvas.parentElement;
    this.scene = canvas.getAttribute("data-ascii");
    if (!(this.scene in IDLE_MS)) this.scene = "contour";
    this.seed = parseInt(canvas.getAttribute("data-seed"), 10) || 7;
    this.wordFrom = from ? document.querySelector(from) : null;
    this.horizonEl = this.host.querySelector("[data-ascii-horizon]");
    this.intensity = isNaN(intensity) ? 1 : intensity;
    this.noise = makeNoise(this.seed);
    this.t = (this.seed % 97) * 1.7;   // each seed starts somewhere different
    this.travel = 0;
    this.lens = { x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0, ts: 0, vx: 0, vy: 0 };
    this.wake = [];
    this.wakeClock = 0;
    this.pts = [];
    this.intro = reduceMotion ? 1 : 0;
    this.visible = true;
    this.ready = false;
    this.wait = 0;
    this.tick = 0;
    this.cost = 0;
    this.sizeBump = 0;
    this.race = this.scene === "race" ? new Race(this) : null;
    this.bind();
  }

  Field.prototype.resize = function () {
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = clamp(Math.round(w / 116), 9, 13) + this.sizeBump;
    // Same size as before: keep the buffers and the canvas, just re-measure the layout below
    if (w !== this.w || h !== this.h || dpr !== this.dpr || size !== this.size) {
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      this.size = size;
      this.canvas.width = Math.round(w * dpr);     // this resets the context, so set the font after
      this.canvas.height = Math.round(h * dpr);
      this.ctx.font = "400 " + size + "px " + MONO;
      this.ctx.textBaseline = "top";
      this.cw = this.ctx.measureText("M").width || size * 0.6;
      this.ch = Math.round(size * 1.3);
      this.cols = Math.ceil(w / this.cw);
      this.rows = Math.ceil(h / this.ch);

      var n = this.cols * this.rows;
      this.chars = new Uint16Array(n);
      this.bright = new Float32Array(n);
      this.acc = new Float32Array(n);
      this.heights = new Float32Array(n);
      this.lensAt = new Float32Array(n);
      this.jitter = new Float32Array(n);
      for (var i = 0; i < n; i++) this.jitter[i] = hash(i, this.seed);
      this.ybuf = new Float32Array(this.cols);
      this.ys = new Float32Array(this.cols);
      this.bufs = STYLES.map(function () { return new Uint16Array(this.cols).fill(SPACE); }, this);
      this.used = new Uint8Array(STYLES.length);
    }
    this.horizon = this.measureHorizon();
    this.buildMask();
    if (this.race) this.race.measure();
    return true;
  };

  Field.prototype.measureHorizon = function () {
    this.ceiling = -1;
    if (!this.horizonEl) return horizonFor(this.w, this.h);
    var box = this.canvas.getBoundingClientRect(), r = this.horizonEl.getBoundingClientRect();
    this.ceiling = (r.top - box.top) / this.ch;
    return clamp((r.top + r.height * 0.62 - box.top) / this.h, 0.25, 0.8);
  };

  // Set the source element's text on an offscreen canvas at the same place and size,
  // then sample its coverage at every cell. Accent runs are painted red, the rest blue,
  // so each cell also knows whether it belongs to an accent run.
  Field.prototype.buildMask = function () {
    this.mask = null;
    if (!this.wordFrom) return;
    var runs = this.wordFrom.querySelectorAll("[data-ascii-run]");
    if (!runs.length) runs = [this.wordFrom];
    var k = 0.5;
    var mw = Math.max(8, Math.round(this.w * k)), mh = Math.max(8, Math.round(this.h * k));
    var cv = document.createElement("canvas");
    cv.width = mw;
    cv.height = mh;
    var g = cv.getContext("2d");
    var box = this.canvas.getBoundingClientRect();
    g.textBaseline = "alphabetic";

    for (var e = 0; e < runs.length; e++) {
      var run = runs[e], text = run.textContent.trim(), rect = run.getBoundingClientRect();
      if (!text || !rect.width) continue;
      var cs = getComputedStyle(run);
      // A heavier cut than the page shows, so the strokes survive at character resolution
      var face = cs.fontStyle === "italic" ? "italic 600 " : "500 ";
      var fs = parseFloat(cs.fontSize) * k;
      var bw = rect.width * k;
      g.font = face + fs + "px " + cs.fontFamily;
      var m = g.measureText(text);
      if (m.width > bw) {
        fs *= bw / m.width;
        g.font = face + fs + "px " + cs.fontFamily;
        m = g.measureText(text);
      }
      var x = (rect.left - box.left) * k + (bw - m.width) / 2;
      var top = (rect.top - box.top) * k;
      var y = m.fontBoundingBoxAscent
        ? top + m.fontBoundingBoxAscent + (rect.height * k - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2
        : top + (rect.height * k + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      g.fillStyle = run.getAttribute("data-ascii-run") === "accent" ? "rgb(255, 0, 0)" : "rgb(0, 0, 255)";
      g.fillText(text, x, y);
    }

    var data = g.getImageData(0, 0, mw, mh).data;
    var cols = this.cols, rows = this.rows, n = cols * rows;
    var mask = new Float32Array(n), accent = new Uint8Array(n), halo = new Float32Array(n);
    var r, c, i;
    for (r = 0; r < rows; r++) {
      var py = Math.min(mh - 1, Math.floor((r + 0.5) * this.ch * k));
      for (c = 0; c < cols; c++) {
        var px = Math.min(mw - 1, Math.floor((c + 0.5) * this.cw * k));
        var o = (py * mw + px) * 4;
        i = r * cols + c;
        mask[i] = data[o + 3] / 255;
        if (mask[i] > 0 && data[o] > data[o + 2]) accent[i] = 1;
      }
    }
    // The halo: a one-cell outline around the letters, kept clear of the landscape
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var v = 0;
        for (var dr = -1; dr <= 1; dr++) {
          var rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (var dc = -2; dc <= 2; dc++) {
            var cc = c + dc;
            if (cc >= 0 && cc < cols && mask[rr * cols + cc] > v) v = mask[rr * cols + cc];
          }
        }
        halo[r * cols + c] = v;
      }
    }
    this.mask = mask;
    this.maskAccent = accent;
    this.halo = halo;
    this.host.classList.add("has-ascii-word");
  };

  Field.prototype.bind = function () {
    var self = this, host = this.host, lens = this.lens;
    host.addEventListener("pointermove", function (e) {
      var r = self.canvas.getBoundingClientRect();
      lens.tx = e.clientX - r.left;
      lens.ty = e.clientY - r.top;
      if (lens.s < 0.02) { lens.x = lens.tx; lens.y = lens.ty; }   // appear under the pointer, don't sweep in
      lens.ts = e.pointerType === "mouse" ? 1 : 0.7;
      wake();
    }, { passive: true });
    host.addEventListener("pointerleave", function () { lens.ts = 0; });
    host.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") lens.ts = 0;
    });
  };

  Field.prototype.busy = function () {
    return this.lens.s > 0 || this.lens.ts > 0 || this.pts.length > 0 || this.intro < 1 ||
      (this.race && (this.race.p !== this.race.target || this.race.entry > 0));
  };

  /* The pointer's wake ---------------------------------------------------- */
  // The head eases after the pointer; every few ms it drops a point that lingers and fades,
  // carrying the speed it had. Together they make a ragged, flowing trail rather than a circle.
  Field.prototype.stepWake = function (dt) {
    var lens = this.lens, wakeList = this.wake, sec = Math.max(dt, 1) / 1000, k, p;
    var ox = lens.x, oy = lens.y;
    lens.x += (lens.tx - lens.x) * (1 - Math.exp(-dt / 80));
    lens.y += (lens.ty - lens.y) * (1 - Math.exp(-dt / 80));
    lens.s += (lens.ts - lens.s) * (1 - Math.exp(-dt / 240));
    if (lens.s < 0.002 && lens.ts === 0) lens.s = 0;
    lens.vx += (clamp((lens.x - ox) / sec, -3000, 3000) - lens.vx) * 0.35;
    lens.vy += (clamp((lens.y - oy) / sec, -3000, 3000) - lens.vy) * 0.35;

    this.wakeClock += dt;
    if (!wakeList.length || this.wakeClock > WAKE_MS) {
      this.wakeClock = 0;
      wakeList.unshift({ x: lens.x, y: lens.y, vx: lens.vx, vy: lens.vy, life: lens.s });
      if (wakeList.length > WAKE) wakeList.length = WAKE;
    } else {
      p = wakeList[0];
      p.x = lens.x; p.y = lens.y; p.vx = lens.vx; p.vy = lens.vy; p.life = lens.s;
    }
    var fade = Math.exp(-dt / 260);
    for (k = 1; k < wakeList.length; k++) wakeList[k].life *= fade;

    // The points this frame's drawing uses, each a soft blob that widens as it ages
    var pts = this.pts = [];
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (k = 0; k < wakeList.length; k++) {
      p = wakeList[k];
      var w = p.life * (1 - k / (WAKE + 2));
      if (w < 0.01) continue;
      var sig = WAKE_PX * (0.7 + (0.6 * k) / WAKE);
      pts.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, w: w, inv: 1 / (2 * sig * sig) });
      minX = Math.min(minX, p.x - sig * 2.6); maxX = Math.max(maxX, p.x + sig * 2.6);
      minY = Math.min(minY, p.y - sig * 2.6); maxY = Math.max(maxY, p.y + sig * 2.6);
    }
    this.box = [minX, maxX, minY, maxY];
  };

  // How strongly the wake touches (px, py), 0–1. Also leaves, in this.fx/fy/fyc,
  // the wake's local velocity (px/s) and the height of the wake there (px).
  Field.prototype.touch = function (px, py) {
    var pts = this.pts, b = this.box;
    if (!pts.length || px < b[0] || px > b[1] || py < b[2] || py > b[3]) return 0;
    var I = 0, fx = 0, fy = 0, cy = 0;
    for (var k = 0; k < pts.length; k++) {
      var p = pts[k], dx = px - p.x, dy = py - p.y;
      var g = p.w * Math.exp(-(dx * dx + dy * dy) * p.inv);
      I += g; fx += g * p.vx; fy += g * p.vy; cy += g * p.y;
    }
    if (I < 0.004) return 0;
    this.fx = fx;
    this.fy = fy;
    this.fyc = cy / I;
    // Ragged, drifting edges instead of a clean circle
    I *= 0.4 + 1.2 * this.noise(px * 0.011 + this.t * 0.4, py * 0.011 - this.t * 0.3);
    return I > 1 ? 1 : I;
  };

  Field.prototype.step = function (dt) {
    this.stepWake(dt);
    this.t += dt / 1000;
    this.travel += (dt / 1000) * 0.3;
    this.intro = Math.min(1, this.intro + dt / 1500);
    if (this.race) this.race.update(dt, this);
    this.tick++;
    this.draw();
  };

  Field.prototype.draw = function () {
    var t0 = performance.now();
    this.chars.fill(SPACE);
    this.bright.fill(0);
    this.acc.fill(0);
    if (this.scene === "terrain") this.terrain();
    else if (this.scene === "race") this.raceScene();
    else if (this.scene === "poster") this.posterScene();
    else this.contour();
    this.post();
    this.render();

    // If frames cost too much on this device, draw bigger characters (fewer cells)
    this.cost = this.cost * 0.9 + (performance.now() - t0) * 0.1;
    if (!reduceMotion && this.tick > 40 && this.cost > 11 && this.sizeBump < 4) {
      this.sizeBump++;
      this.cost = 5;
      this.resize();
    }
  };

  /* Scene: top-down contour map ------------------------------------------- */
  Field.prototype.contour = function () {
    var cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var H = this.heights, L = this.lensAt, n = this.noise, t = this.t;
    var chars = this.chars, bright = this.bright;
    var S = 1 / 280;
    var ax = t * 0.035, ay = t * 0.021;
    var awake = this.pts.length > 0;
    var i, r, c, px, py, u, v, h;

    for (r = 0, i = 0; r < rows; r++) {
      py = (r + 0.5) * ch;
      for (c = 0; c < cols; c++, i++) {
        px = (c + 0.5) * cw;
        u = px * S;
        v = py * S;
        var lift = 0;
        if (awake) {
          var I = L[i] = this.touch(px, py);   // post() reads this back
          if (I > 0) {
            // The wake drags the map along with it and raises a ridge, so rings gather in its path
            u -= this.fx * 0.07 * I * S;
            v -= this.fy * 0.07 * I * S;
            lift = 0.15 * I;
          }
        }
        var wu = n(u * 0.55 + ax, v * 0.55 + 3.1) - 0.5;
        var wv = n(u * 0.55 + 7.7, v * 0.55 - ay) - 0.5;
        h = fbm(n, u + wu * 1.5, v + wv * 1.5) + lift;
        H[i] = h;
      }
    }

    var BANDS = 12;
    for (r = 0, i = 0; r < rows; r++) {
      for (c = 0; c < cols; c++, i++) {
        h = H[i];
        var gx = (H[c < cols - 1 ? i + 1 : i] - H[c > 0 ? i - 1 : i]) * 0.5;
        var gy = (H[r < rows - 1 ? i + cols : i] - H[r > 0 ? i - cols : i]) * 0.5;
        var hb = h * BANDS, k = Math.round(hb), dist = Math.abs(hb - k);
        var g = (Math.abs(gx) + Math.abs(gy)) * BANDS * 0.5;
        if (dist < g * 0.6 + 0.01) {
          chars[i] = slopeChar(-gy / ch, gx / cw);
          bright[i] = k % 4 === 0 ? 0.9 : 0.48;   // every fourth line is an index contour
        } else if ((h - 0.46) * 1.8 > BAYER[((r & 3) << 2) | (c & 3)]) {
          chars[i] = DOT;
          bright[i] = 0.2;
        }
      }
    }
  };

  /* Scene: ridgelines rolling toward the viewer ---------------------------- */
  Field.prototype.terrain = function () {
    var cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var n = this.noise;
    var chars = this.chars, bright = this.bright, acc = this.acc, ybuf = this.ybuf, ys = this.ys;
    var horizon = rows * this.horizon;
    var F = (rows - horizon) * 0.92;              // focal length, in rows
    var aspect = (cols * cw) / (rows * ch);
    var SP = 0.5, Z0 = 0.5, Z1 = 18;              // spacing between ridges, nearest and farthest depth
    var travel = this.travel;
    var amp = 5.5;
    var awake = this.pts.length > 0;
    var first = Math.ceil((travel + Z0) / SP), last = Math.floor((travel + Z1) / SP);
    var c, r, i, y;
    var height = function (cc, Y, z, ampZ) {
      var X = ((cc + 0.5) / cols - 0.5) * aspect * 1.3 * z;
      var env = 0.22 + 0.78 * smooth(-4, 6, X + 1.5 * Math.sin(Y * 0.09));   // peaks rise toward the right
      return ampZ * env * ridged(n, X * 0.18 + 11.3, Y * 0.18) + 0.3 * (n(X * 0.9 + 3.7, Y * 0.9) - 0.3);
    };

    ybuf.fill(rows);
    // Nearest ridge first; each one only shows where it rises above everything in front of it
    for (var j = first; j <= last; j++) {
      var z = j * SP - travel;
      var depth = (z - Z0) / (Z1 - Z0);
      var fade = smooth(0, 0.012, depth) * (1 - smooth(0.7, 1, depth));
      var Y = j * SP;
      var ampZ = amp * smooth(0.5, 5, z);         // the valley floor near the viewer stays low
      var b = (0.26 + 0.74 * Math.pow(1 - depth, 1.6)) * fade;
      var frontier = j % 11 === 0;                // one ridge in eleven is the cardinal "frontier"

      for (c = 0; c < cols; c++) {
        y = horizon + ((1 - height(c, Y, z, ampZ)) / z) * F;
        if (awake) {
          var I = this.touch((c + 0.5) * cw, y * ch);
          if (I > 0.003) {
            // Drag the ridge sideways with the wake, then lift it toward the wake and along its motion
            y = horizon + ((1 - height(c - (this.fx * 0.07 * I) / cw, Y, z, ampZ)) / z) * F;
            y += (this.fyc / ch - y) * 0.38 * I + (this.fy * 0.07 * I) / ch;
          }
        }
        ys[c] = y;
      }

      for (c = 0; c < cols; c++) {
        y = ys[c];
        var limit = ybuf[c];
        var yl = c > 0 ? ys[c - 1] : y, yr = c < cols - 1 ? ys[c + 1] : y;
        var r0 = Math.floor(Math.min(y, (y + yl) * 0.5, (y + yr) * 0.5));
        var r1 = Math.floor(Math.max(y, (y + yl) * 0.5, (y + yr) * 0.5));
        if (r0 >= limit) continue;
        ybuf[c] = Math.max(0, r0);
        if (b < 0.02) continue;                   // too faint to draw, but it still hides what's behind

        var s = ((yr - yl) * 0.5 * ch) / cw;
        var code;
        if (s > 2.4 || s < -2.4) code = BAR;
        else if (s < -0.35) code = SLASH;
        else if (s > 0.35) code = BACK;
        else if (yl > y + 0.25 && yr > y + 0.25) code = CARET;
        else code = y - Math.floor(y) > 0.62 ? UNDER : DASH;

        var rEnd = Math.min(r1, limit - 1, rows - 1);
        for (r = Math.max(0, r0); r <= rEnd; r++) {
          i = r * cols + c;
          chars[i] = code;
          bright[i] = b;
          if (frontier) acc[i] = 0.9;
        }
        // Dot texture on the slope below this ridge, down to the next one in front
        var fillEnd = Math.min(limit, rows);
        for (r = rEnd + 1; r < fillEnd; r++) {
          i = r * cols + c;
          if ((r * 3 + c + j) % 6 === 0 && chars[i] === SPACE) {
            chars[i] = DOT;
            bright[i] = b * 0.4;
          }
        }
      }
    }

    // Nothing rises past the ceiling: peaks fade out a few rows below it, like haze
    if (this.ceiling > 0) {
      var top = this.ceiling, lastRow = Math.min(rows, Math.ceil(top + 6));
      for (r = 0; r < lastRow; r++) {
        var keep = smooth(top, top + 6, r);
        for (c = 0, i = r * cols; c < cols; c++, i++) {
          if (keep <= 0) chars[i] = SPACE;
          else bright[i] *= keep;
        }
      }
    }
  };

  /* Scene: a poster session ----------------------------------------------- */
  // Posters on stands, their charts always updating; a presenter beside each one
  // gestures while visitors wander the floor and stop to read.
  Field.prototype.posterScene = function () {
    var cols = this.cols, rows = this.rows;
    var chars = this.chars, bright = this.bright, acc = this.acc;
    var n = this.noise, t = this.t, tick = this.tick;
    var put = function (c, r, code, b, a) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      var i = r * cols + c;
      chars[i] = code;
      bright[i] = b;
      acc[i] = a || 0;
    };
    var text = function (c, r, str, b, a) {
      for (var q = 0; q < str.length; q++) put(c + q, r, str.charCodeAt(q), b, a);
    };
    var count = cols >= 96 ? 3 : cols >= 56 ? 2 : 1;
    var gapCols = 6;
    var pw = Math.floor((cols - 4 - (count - 1) * gapCols) / count);
    var floor = rows - 2;
    var top = 1, ph = Math.max(8, Math.min(floor - 5, Math.round(rows * 0.64)));
    var k, r, c, x0;

    // The floor
    for (c = 0; c < cols; c++) put(c, floor, (c + (tick >> 4)) % 3 ? DOT : UNDER, 0.16);

    for (k = 0; k < count; k++) {
      x0 = 2 + k * (pw + gapCols);
      var x1 = x0 + pw - 1, y1 = top + ph - 1;
      // Frame and stand
      for (c = x0; c <= x1; c++) { put(c, top, DASH, 0.5); put(c, y1, DASH, 0.5); }
      for (r = top; r <= y1; r++) { put(x0, r, BAR, 0.5); put(x1, r, BAR, 0.5); }
      put(x0, top, 43, 0.6); put(x1, top, 43, 0.6); put(x0, y1, 43, 0.6); put(x1, y1, 43, 0.6);
      for (r = y1 + 1; r < floor; r++) { put(x0 + 3, r, BAR, 0.3); put(x1 - 3, r, BAR, 0.3); }
      // Title bar and authors
      for (c = x0 + 2; c <= x1 - 2; c++) put(c, top + 1, EQUALS, 0.85, k === 1 ? 0.9 : 0);
      for (c = x0 + 2; c < x0 + 2 + Math.floor(pw * 0.45); c++) put(c, top + 2, DASH, 0.35);
      // Body: a column of text on the left, a live chart on the right
      var mid = x0 + Math.floor(pw * 0.45);
      for (r = top + 4; r < y1 - 1; r += 1) {
        var len = Math.floor((mid - x0 - 4) * (0.55 + 0.45 * hash(r, k + 3)));
        for (c = x0 + 2; c < x0 + 2 + len; c++) put(c, r, hash(c, r * 7 + k) < 0.18 ? SPACE : COLON, 0.22);
      }
      var cx0 = mid + 2, cx1 = x1 - 2, cb = y1 - 2, chH = Math.max(3, cb - (top + 4));
      if (k % 2 === 0) {
        // Bar chart, bars rising and settling as results come in
        for (c = cx0; c <= cx1; c++) {
          if ((c - cx0) % 3 === 2) continue;
          var bar = Math.round(chH * (0.25 + 0.7 * n((c - cx0) * 0.35 + k * 9, t * 0.35)));
          for (r = 0; r < bar; r++) put(c, cb - r, r === bar - 1 ? HASH : BAR, 0.5 + 0.4 * (r / chH), k === 0 && (c - cx0) % 9 < 2 ? 0.9 : 0);
        }
      } else {
        // A line plot that keeps drawing itself across the axes
        var drawn = ((t * 0.18 + k * 0.3) % 1.2) / 1.0;
        for (c = cx0; c <= cx1; c++) put(c, cb, DASH, 0.3);
        for (r = cb - chH + 1; r <= cb; r++) put(cx0, r, BAR, 0.3);
        for (c = cx0 + 1; c <= cx1; c++) {
          var f = (c - cx0) / (cx1 - cx0);
          if (f > drawn) break;
          var yv = cb - 1 - Math.round((chH - 2) * (0.2 + 0.6 * f + 0.15 * Math.sin(f * 9 + k)));
          put(c, yv, f > drawn - 0.04 ? 42 : DOT, 0.9, 0.9);
        }
      }
      // The presenter, beside the poster, mid-explanation
      var px = x1 + 2, wave = (tick >> 3) % 4;
      if (px < cols - 1) {
        put(px, floor - 3, 111, 0.8);
        put(px, floor - 2, wave === 1 ? SLASH : wave === 3 ? BACK : BAR, 0.7);
        put(px - 1, floor - 2, wave === 2 ? 60 : SPACE, 0.6);
        put(px, floor - 1, 94, 0.6);
      }
    }

    // Visitors wander the floor and pause in front of the posters
    var people = Math.max(2, Math.round(cols / 18));
    for (k = 0; k < people; k++) {
      var wander = n(t * 0.05 + k * 13.1, k * 3.3);
      var x = Math.round(2 + (cols - 5) * clamp((wander - 0.2) / 0.6, 0, 1));
      var you = k === 0;
      put(x, floor - 2, 111, you ? 1 : 0.62, you ? 1 : 0);
      put(x, floor - 1, (tick + k * 5) % 16 < 8 ? 65 : 72, you ? 0.9 : 0.5, you ? 0.9 : 0);
    }
  };

  /* Scene: the race -------------------------------------------------------- */
  // Six craft float down the screen, each in its own lane with a gentle sway, leaving
  // a wide trail behind, chasing the frontier: a shock front bowed back on either side,
  // like a sonic boom. The camera rides with the leader, so the trails and the dust
  // stream up the screen while the field races down it.
  Field.prototype.raceScene = function () {
    var race = this.race;
    if (!race) return;
    var cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var chars = this.chars, bright = this.bright, acc = this.acc;
    var n = race.n, s = race.s, e = race.e, leader = Math.max(0, race.leader), tick = this.tick;
    var cam = race.cam;
    var carCols = race.carW / cw, carRows = race.carH / ch;
    var margin = Math.max(carCols * 0.9, cols * 0.08);
    var gap = n > 1 ? (cols - 2 * margin) / (n - 1) : 0;
    var sway = Math.min(gap * 0.16, 4);
    // Trails at least five characters wide, most of the craft's width
    var half = Math.max(2, Math.round((carCols * 0.55) / 2));
    var laneX = function (i, z) { return margin + gap * i + sway * (Math.sin(z * 0.07 + i * 1.9) + 0.5 * Math.sin(z * 0.023 + i * 0.7)); };
    var put = function (c, r, code, b, a) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      var i = r * cols + c;
      if (b < bright[i]) return;                  // where things cross, the brighter one wins
      chars[i] = code;
      bright[i] = b;
      acc[i] = a || 0;
    };
    var r, c, i, k, z;

    // Dust drifting past, so the floating field still reads as moving
    for (r = 0; r < rows; r++) {
      var zi = Math.floor(cam + r);
      for (c = 0; c < cols; c++) {
        var d = hash(c, zi);
        if (d < 0.01) put(c, r, d < 0.004 ? COLON : DOT, 0.13);
      }
    }

    // The frontier. Its apex drifts to sit ahead of whoever leads; pressure waves ripple back
    // from it toward the field, and it flares as the field punches through at the finish.
    var boom = race.boom * rows, flare = race.flare;
    var lead0 = cols / 2 + (laneX(leader, cam + boom) - cols / 2) * 0.45;   // leans toward the leader, stays near the middle
    race.apex = race.apex == null ? lead0 : race.apex + (lead0 - race.apex) * 0.05;
    var span = cols * 0.42, sag = rows * 0.3, phase = (this.t * 0.7) % 1;
    for (c = 0; c < cols; c++) {
      var u = (c - race.apex) / span;
      var yb = boom - sag * u * u, slope = (-2 * sag * u) / span;
      var reach = 1 - Math.min(1, Math.abs(u) * 0.45);
      var code = slopeChar(cw, slope * ch);
      var flat = code === DASH;
      var row = Math.floor(yb);
      var hot = Math.abs(u) < 0.12 || (flare > 0.25 && Math.abs(u) < 0.3);
      // The front: a heavy line, two characters deep, white-hot at the apex
      put(c, row, flat ? EQUALS : code, 0.45 + 0.55 * reach, hot ? 1 : 0.92);
      put(c, row + 1, flat ? DASH : code, (0.25 + 0.45 * reach) * (1 + flare), 0.75);
      // Pressure waves rippling back toward the field
      for (k = 0; k < 4; k++) {
        var t = (k + phase) / 4;                   // 0 at the front, 1 where a wave dies out
        put(c, Math.floor(yb - 1 - t * (rows * 0.1) * (1 + flare * 1.5)), flat ? TILDE : code, 0.45 * (1 - t) * reach, 0.65 * (1 - t));
      }
      // Beyond it, the unknown: a faint static that thins out
      var mist = hash(c, (tick >> 3) + 17);
      if (mist < 0.06) put(c, row + 3 + Math.floor(hash(c, tick >> 3) * rows * 0.1), mist < 0.02 ? COLON : DOT, 0.16);
    }

    for (i = 0; i < n; i++) {
      var head = s[i] - cam + e[i];               // screen row of the craft's centre
      var lead = i === leader;
      var len = rows * (lead ? 0.85 : 0.6);
      var w = half + (lead ? 1 : 0);
      var tail = Math.floor(head - carRows * 0.45);
      for (r = Math.min(rows - 1, tail); r >= 0; r--) {
        var f = 1 - (head - r) / len;             // 1 at the craft, 0 at the end of the trail
        if (f <= 0) break;
        z = cam + r - e[i];
        var x0 = Math.round(laneX(i, z));
        var ww = f > 0.25 ? w : Math.max(1, Math.round((w * f) / 0.25));   // the end of the trail narrows
        for (k = -ww; k <= ww; k++) {
          // Exhaust breaks up toward the end
          if (hash(x0 + k, Math.floor(z) * 7 + (tick >> 1)) < 0.35 * (1 - f) * (1 - f)) continue;
          var edge = Math.abs(k) / (ww + 0.5);
          var v = Math.pow(f, 1.15) * (1 - 0.5 * Math.pow(edge, 2));
          var tc = v > 0.7 ? HASH : v > 0.5 ? BAR : v > 0.32 ? BANG : v > 0.18 ? COLON : DOT;
          put(x0 + k, r, tc, 0.12 + 0.8 * v, lead ? 0.55 + 0.45 * f : 0);
        }
      }
      // Sparks off the leader's tail
      if (lead) {
        for (k = 0; k < 5; k++) {
          if (hash(k * 7, tick) > 0.6) continue;
          r = tail - 1 - Math.floor(hash(k, tick >> 1) * 4);
          put(Math.round(laneX(i, cam + r - e[i]) + (hash(k * 3, tick) - 0.5) * w * 2.4), r, glyph(k, tick), 1, 1);
        }
      }
      var car = race.cars[i];
      if (car) {
        var px = (laneX(i, s[i]) + 0.5) * cw, py = (head + 0.5) * ch;
        car.style.transform = "translate3d(" + px.toFixed(1) + "px, " + py.toFixed(1) + "px, 0)" + (lead ? " scale(1.1)" : "");
      }
    }
  };

  /* Shared pass: the wordmark, the wake and the entrance ------------------- */
  Field.prototype.post = function () {
    var cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var chars = this.chars, bright = this.bright, acc = this.acc, jitter = this.jitter;
    var mask = this.mask, halo = this.halo, maskAccent = this.maskAccent, intro = this.intro, k = this.intensity;
    var awake = this.pts.length > 0, lensAt = this.scene === "contour" ? this.lensAt : null;
    var tick = this.tick;
    // Every few seconds a sheen sweeps across the wordmark
    var sweep = (((this.t * 0.11) % 1.6) - 0.3) * (cols + rows);

    for (var r = 0, i = 0; r < rows; r++) {
      var py = (r + 0.5) * ch;
      for (var c = 0; c < cols; c++, i++) {
        var code = chars[i], b = bright[i], a = acc[i];
        var la = !awake ? 0 : lensAt ? lensAt[i] : this.touch((c + 0.5) * cw, py);
        var m = mask ? mask[i] : 0;

        if (m > 0.4) {
          code = m > 0.82 ? DENSE[(jitter[i] * DENSE.length) | 0] : RAMP[3 + Math.floor((m - 0.4) * 9.5)];
          b = 0.62 + 0.38 * m;
          a = maskAccent[i] ? 0.9 : 0;
          if (m > 0.6 && Math.abs(c + r * 0.7 - sweep) < 2.5) { a = 1; b = 1; }
          if (la > 0.3) code = glyph(i, tick);    // letters scramble in the wake
          if (la > a) a = la;
        } else {
          if (halo && halo[i] > 0.4) { b *= 0.2; a *= 0.2; }   // a clear outline keeps the letters crisp
          if (la > 0.02) {
            if (code === SPACE && la > BAYER[((r & 3) << 2) | (c & 3)] * 1.9 + 0.22) {
              code = hash(i, (tick >> 2) + ((jitter[i] * 50) | 0)) < 0.5 ? ZERO : ONE;   // the wake shows data underneath
              b = 0.18;
            }
            b = Math.min(1, b + la * 0.35);
            if (la > a) a = la;
          }
        }

        if (intro < 1 && code !== SPACE) {
          var vis = clamp((intro * 1.4 - jitter[i]) * 5, 0, 1);
          b *= vis;
          if (vis > 0 && vis < 1) code = glyph(i, tick);   // characters decode into place
        }

        chars[i] = code;
        bright[i] = b * k;
        acc[i] = a;
      }
    }
  };

  /* Draw: one fillText per row per ink, so thousands of cells cost a few hundred calls */
  Field.prototype.render = function () {
    var ctx = this.ctx, cols = this.cols, rows = this.rows, ch = this.ch;
    var chars = this.chars, bright = this.bright, acc = this.acc, bufs = this.bufs, used = this.used;
    var L, r, c;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // The frontier glows at its apex, brightest as the field punches through
    var race = this.race;
    if (race && race.apex != null) {
      glow(ctx, (race.apex + 0.5) * this.cw, race.boom * this.h, this.w * 0.22, 0.16 + 0.3 * (race.flare || 0));
    }
    // A soft cardinal haze along the wake, strongest at its head
    for (var p = 0; p < this.pts.length && p < 6; p++) {
      var pt = this.pts[p];
      glow(ctx, pt.x, pt.y, WAKE_PX * (1.3 + p * 0.15), 0.07 * pt.w);
    }

    var yOff = Math.round((ch - this.size) / 2);

    for (r = 0; r < rows; r++) {
      var base = r * cols;
      for (c = 0; c < cols; c++) {
        var i = base + c, code = chars[i];
        if (code === SPACE) continue;
        var b = bright[i];
        if (b < 0.035) continue;
        var a = acc[i];
        if (a > 0.95 && b > 0.85) L = HOT;
        else if (a > 0.5) L = b > 0.42 ? ACCENT : DIM;
        else if (a > 0.22) L = DIM;
        else L = b < 0.17 ? 0 : b < 0.3 ? 1 : b < 0.48 ? 2 : b < 0.7 ? 3 : 4;
        bufs[L][c] = code;
        used[L] = 1;
      }
      for (L = 0; L < bufs.length; L++) {
        if (!used[L]) continue;
        ctx.fillStyle = STYLES[L];
        ctx.fillText(String.fromCharCode.apply(null, bufs[L]), 0, r * ch + yOff);
        bufs[L].fill(SPACE);
        used[L] = 0;
      }
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Race: the stage is split into one sector per track, then the finish.    */
  /* Scrolling moves through the sectors; in its sector a track's craft      */
  /* moves up into the lead and its notes show. The field stays staggered,   */
  /* so leaders hand over naturally: the next craft climbs through, the last */
  /* one eases back. At the finish they all punch through the frontier.      */
  /* ---------------------------------------------------------------------- */
  var LEADER_AT = 0.4;     // where the camera keeps the leader, as a fraction of the screen from the top
  var LEAD = 0.26;         // how far the leader runs ahead of the back of the field, in screens
  var SPREAD = 0.95;       // how many sectors a craft's run toward the front lasts
  var SETTLE_MS = 260;     // how quickly the field rearranges itself as you scroll
  var HANDOFF_MS = 1100;   // ...and after a click, which lets the chosen track take the lead in place

  function Race(field) {
    var self = this;
    this.section = field.canvas.closest("[data-race]") || field.host;
    this.stage = this.section.querySelector("[data-race-stage]") || this.section;
    this.cars = slice(this.section.querySelectorAll("[data-car]"));
    this.items = slice(this.section.querySelectorAll("[data-track]"));
    this.n = Math.max(1, this.cars.length);
    this.finish = this.n / (this.n + 1);  // one sector per track, then the finish: the field punches through the frontier
    this.s = new Float64Array(this.n);    // where each craft is, in rows travelled
    this.o = new Float64Array(this.n);    // how far each is ahead of the back of the field
    this.e = new Float64Array(this.n);    // extra screen offset: running off at the finish, or dropping back in
    this.gone = false;                    // the field has run off past the frontier
    this.entry = 0;                       // 1 → 0 as the field drops back in from the top
    this.p = 0;                           // progress through the stage, 0–1
    this.target = 0;
    this.shift = 0;                       // keeps the distance travelled smooth across jumps
    this.cruise = 0;                      // the field keeps drifting forward on its own
    this.lag = SETTLE_MS;
    this.distance = 0;
    this.started = false;
    this.leader = -1;
    this.carW = 64;
    this.carH = 84;
    this.order = [];
    for (var i = 0; i < this.n; i++) this.order.push(i);
    this.raceVar = "";
    this.stage.classList.add("is-live");
    this.section.classList.add("is-racing");

    var read = function () { self.read(); wake(); };
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    this.cars.forEach(function (car) {
      car.addEventListener("click", function () { self.go(+car.getAttribute("data-car")); });
    });
    this.read();
    this.p = this.target;

    // Arriving at #track-c (say, from the Call for Research page) lands in that track's sector.
    // It runs after load, so it lands after the browser's own jump to the fragment.
    var arrive = function () {
      var i = self.items.map(function (el) { return "#" + el.id; }).indexOf(location.hash);
      if (i > -1) self.go(i, true);
    };
    if (document.readyState === "complete") setTimeout(arrive, 0);
    else window.addEventListener("load", function () { setTimeout(arrive, 0); });
    window.addEventListener("hashchange", arrive);
  }

  Race.prototype.measure = function () {
    var car = this.cars[0];
    if (car && car.offsetWidth) { this.carW = car.offsetWidth; this.carH = car.offsetHeight; }
  };

  Race.prototype.read = function () {
    var r = this.stage.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    this.target = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  };

  // Go to the middle of a track's sector without racing through the ones in between:
  // the page moves at once, the distance travelled carries on from where it was, and the
  // field takes a moment to let that track move up into the lead.
  Race.prototype.go = function (i, now) {
    var r = this.stage.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    var before = this.p;
    var y = window.scrollY + r.top + total * this.finish * ((i + 0.5) / this.n);
    var lenis = window.URTC && window.URTC.lenis;
    if (lenis) {
      lenis.scrollTo(y, { immediate: true, force: true });   // jump the smooth scroll too, or it would glide back
    } else {
      var html = document.documentElement, behavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      html.style.scrollBehavior = behavior;
    }
    this.read();
    this.p = this.target;
    this.shift += (before - this.p) * this.distance;
    this.lag = now ? SETTLE_MS : HANDOFF_MS;
    if (now) this.started = false;          // arriving from a link: start there, no handoff
    wake();
  };

  Race.prototype.update = function (dt, f) {
    var n = this.n, rows = f.rows, s = this.s, o = this.o, i;
    this.distance = rows * 9;
    this.p += (this.target - this.p) * (1 - Math.exp(-dt / 110));
    if (Math.abs(this.target - this.p) < 0.00005) this.p = this.target;
    this.cruise += (dt / 1000) * rows * 0.45;
    var base = this.p * this.distance + this.shift + this.cruise;

    // Each craft's goal: near the front in and around its own sector, falling back gradually after
    var racing = clamp(this.p / this.finish, 0, 1);
    var focus = racing * n, ease = 1 - Math.exp(-dt / this.lag);
    this.lag += (SETTLE_MS - this.lag) * (1 - Math.exp(-dt / 1600));
    var best = 0;
    for (i = 0; i < n; i++) {
      var d = focus - (i + 0.5);
      var goal = rows * LEAD * Math.exp(-(d * d) / (2 * SPREAD * SPREAD)) + rows * 0.02 * Math.sin(this.p * 9 + i * 2.1);
      o[i] = this.started ? o[i] + (goal - o[i]) * ease : goal;
      s[i] = base + o[i] + rows * 0.006 * Math.sin(f.t * 1.5 + i * 1.7);
      if (s[i] > s[best]) best = i;
    }
    this.started = true;
    this.cam = s[best] - rows * LEADER_AT;

    // The frontier sits ahead of the leader, and the field slowly closes on it
    this.boom = LEADER_AT + 0.17 - 0.07 * racing;

    // The finish: past the last sector the field punches through and runs off the bottom,
    // leader first. Once it's gone it stays gone, and scrolling back up out of the finish
    // brings it back in from the top rather than reversing it.
    var fin = clamp((this.p - this.finish) / (1 - this.finish), 0, 1);
    if (fin > 0.6) this.gone = true;
    if (fin === 0 && this.gone) { this.gone = false; this.entry = 1; }
    var away = this.gone || fin > 0.45;
    if (away !== this.away) {
      this.away = away;
      this.leader = -1;                          // re-apply the classes below: no notes while the field is away
    }
    this.entry *= Math.exp(-dt / 700);
    if (this.entry < 0.002) this.entry = 0;
    this.flare = fin > 0 && fin < 1 ? Math.sin(Math.min(1, fin * 1.5) * Math.PI) : 0;
    var order = this.order;
    order.sort(function (a, b) { return s[b] - s[a]; });
    for (var rank = 0; rank < n; rank++) {
      var j = order[rank];
      // Far enough down that the trails behind clear the screen too; the last craft is gone by 80% of the finish
      var out = this.gone ? 1 : clamp(fin * 1.8 - rank * 0.1, 0, 1);
      this.e[j] = Math.pow(out, 1.6) * rows * 2.3 - this.entry * rows * (1.05 + rank * 0.09);
    }

    if (best !== this.leader) {
      var shown = this.away ? -1 : best;
      this.leader = best;
      this.items.forEach(function (el, j) { el.classList.toggle("is-active", j === shown); });
      this.cars.forEach(function (el, j) {
        el.classList.toggle("is-leader", j === best);
        if (j === best) el.setAttribute("aria-current", "true");
        else el.removeAttribute("aria-current");
      });
    }
    var raceVar = this.p.toFixed(4);
    if (raceVar !== this.raceVar) {
      this.raceVar = raceVar;
      this.section.style.setProperty("--race", raceVar);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* One animation loop for every field on the page                          */
  /* ---------------------------------------------------------------------- */
  var fields = [];
  var running = false, lastNow = 0;

  function loop(now) {
    var dt = lastNow ? Math.min(250, now - lastNow) : 16;   // slow frames still move time on
    var any = false;
    lastNow = now;
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f.ready || !f.visible) continue;
      any = true;
      f.wait += dt;
      if (f.wait < (f.busy() ? 0 : IDLE_MS[f.scene])) continue;
      f.step(f.wait);
      f.wait = 0;
    }
    if (any && !document.hidden) requestAnimationFrame(loop);
    else running = false;
  }

  function wake() {
    if (running || reduceMotion) return;
    running = true;
    lastNow = 0;
    requestAnimationFrame(loop);
  }

  function measureAll(list) {
    (list || fields).forEach(function (f) {
      f.ready = f.resize();
      if (reduceMotion && f.ready) f.draw();
    });
    wake();
  }

  function start() {
    measureAll();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { entry.target._asciiField.visible = entry.isIntersecting; });
        wake();
      }, { rootMargin: "80px 0px" });
      fields.forEach(function (f) { io.observe(f.canvas); });
    }
    var pending = [];
    var flush = debounce(function () { var list = pending; pending = []; measureAll(list); }, 150);
    var remeasure = function (list) {
      (list || fields).forEach(function (f) { if (pending.indexOf(f) < 0) pending.push(f); });
      flush();
    };
    var remeasureAll = function () { remeasure(); };
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function (entries) {
        remeasure(entries.map(function (entry) { return entry.target._asciiField; }));
      });
      fields.forEach(function (f) { ro.observe(f.canvas); });
    } else {
      window.addEventListener("resize", remeasureAll);
    }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", remeasureAll);
    // Entrance animations move the copy a little; re-measure the wordmark once they settle
    setTimeout(remeasureAll, 1500);
    document.addEventListener("visibilitychange", wake);
  }

  canvases.forEach(function (canvas) {
    // The race is all motion; with reduced motion it stays a plain list and isn't drawn
    if (canvas.getAttribute("data-ascii") === "race" && reduceMotion) return;
    var f = new Field(canvas);
    canvas._asciiField = f;
    fields.push(f);
  });

  // Measuring needs the faces loaded; don't wait more than a moment for them
  var fontsLoaded = document.fonts && document.fonts.load
    ? Promise.all([
        document.fonts.load('400 13px "IBM Plex Mono"'),
        document.fonts.load('500 48px "Inter Tight"')
      ]).catch(function () {})
    : Promise.resolve();
  Promise.race([fontsLoaded, new Promise(function (done) { setTimeout(done, 1200); })]).then(start);
})();
