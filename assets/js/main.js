/* ==========================================================================
   Stanford URTC — site behavior
   - Mobile navigation
   - Fills links/text from config.js
   - Interest-list form
   - Header backdrop once the page scrolls
   - Smooth scrolling (Lenis) and scroll-driven animation (GSAP + ScrollTrigger)
   - Scroll reveals, and mono labels that decode like a terminal
   The ASCII art lives in ascii.js.
   Lenis and GSAP load from a CDN; if they don't arrive, every effect falls back
   to plain scrolling and the simpler built-in versions below.
   Everything decorative respects prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var cfg = window.URTC_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;

  // GSAP drives the scroll animations whenever it's here and motion is welcome
  var motion = !reduceMotion && !!gsap && !!ScrollTrigger;
  if (motion) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("has-gsap");
  }

  /* Smooth scrolling. Lenis eases the page toward where the wheel or trackpad sends it;
     with GSAP present it runs on GSAP's clock so ScrollTrigger sees every frame. */
  var lenis = null;
  // The tracks race is many screens tall, so it scrolls a little quicker than the rest of the page,
  // and quicker still the faster you're going: a hard flick carries you through it
  var raceStage = document.querySelector("[data-race-stage]");
  var inRace = function () {
    if (!raceStage) return false;
    var r = raceStage.getBoundingClientRect(), mid = window.innerHeight / 2;
    return r.top < mid && r.bottom > mid;
  };
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      lerp: 0.13,             // how quickly the page catches up to the wheel (higher is snappier)
      wheelMultiplier: 1.1,   // how far each wheel or trackpad flick travels
      autoRaf: !motion,
      anchors: { offset: -80 },  // in-page links land just below the header
      virtualScroll: function (data) {
        if (inRace()) {
          var speed = Math.min(1, Math.max(0, (Math.abs(lenis.velocity) - 15) / 45));
          data.deltaY *= 1.1 + 0.4 * speed;   // 1.1x at a stroll, up to 1.5x when scrolling fast
        }
        return true;
      }
    });
    if (motion) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }
  // Shared with ascii.js, so the race can jump without fighting the smooth scroll
  window.URTC = { lenis: lenis };

  /* Header gets its backdrop once the page has scrolled */
  var onScroll = function () { root.classList.toggle("is-scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------- */
  /* Mobile navigation                                                       */
  /* ---------------------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".nav-toggle-label").textContent = open ? "Close" : "Menu";
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    };
    nav.setAttribute("data-lenis-prevent", "");   // the open menu scrolls on its own
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Config-driven links and text                                            */
  /*   <a data-config-href="contactEmail" href="fallback.html">              */
  /*   <span data-config-text="contactEmail">Coming soon</span>              */
  /* ---------------------------------------------------------------------- */
  function configValue(key) {
    return String(cfg[key] || "").trim();
  }

  document.querySelectorAll("[data-config-href]").forEach(function (el) {
    var key = el.getAttribute("data-config-href");
    var value = configValue(key);
    if (!value) {
      el.classList.add("is-pending");
      if (el.hasAttribute("data-pending-disable")) {
        el.removeAttribute("href");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("role", "link");
      }
      return;
    }
    var isEmail = /Email$/.test(key);
    el.href = isEmail ? "mailto:" + value : value;
    if (!isEmail && /^https?:/i.test(value)) {
      el.target = "_blank";
      el.rel = "noopener";
    }
    var label = el.getAttribute("data-ready-label");
    var labelTarget = el.querySelector("[data-label]");
    if (label && labelTarget) labelTarget.textContent = label;
  });

  document.querySelectorAll("[data-config-text]").forEach(function (el) {
    var value = configValue(el.getAttribute("data-config-text"));
    if (value) el.textContent = value;
  });

  /* ---------------------------------------------------------------------- */
  /* Interest-list form                                                      */
  /* ---------------------------------------------------------------------- */
  document.querySelectorAll("form[data-interest-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var button = form.querySelector('button[type="submit"]');
    var email = form.elements.email;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!email.value.trim() || !email.checkValidity()) {
        email.setAttribute("aria-invalid", "true");
        status.textContent = "Please enter a valid email address.";
        email.focus();
        return;
      }
      email.removeAttribute("aria-invalid");

      // Honeypot: bots fill hidden fields, people don't.
      if (form.elements._gotcha && form.elements._gotcha.value) return;

      var endpoint = configValue("interestFormEndpoint");
      if (!endpoint) {
        status.textContent =
          "Thanks for your interest! Sign-ups aren't open quite yet. Please check back soon.";
        return;
      }

      button.disabled = true;
      status.textContent = "Adding you to the list…";

      fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          status.textContent = "You're on the list. We'll be in touch when there's news.";
        })
        .catch(function () {
          status.textContent = "Something went wrong. Please try again in a moment.";
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Scroll reveals                                                          */
  /* ---------------------------------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  var settle = function (els) {
    gsap.set(els, { clearProps: "opacity,transform" });
    els.forEach(function (el) { el.classList.add("is-visible", "is-settled"); });
  };
  if (motion) {
    // Figure grids rise tile by tile, and their icons draw themselves in
    document.querySelectorAll(".fig-grid.reveal").forEach(function (grid) {
      var tiles = Array.prototype.slice.call(grid.children);
      ScrollTrigger.create({
        trigger: grid,
        start: "top 88%",
        once: true,
        onEnter: function () {
          gsap.to(tiles, {
            opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.09,
            onComplete: function () { settle(tiles); settle([grid]); }
          });
          gsap.to(grid.querySelectorAll(".fig-icon > *"), { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut", stagger: 0.04, delay: 0.3 });
        }
      });
    });
    ScrollTrigger.batch(document.querySelectorAll(".reveal:not(.fig-grid)"), {
      start: "top 92%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08,
          onComplete: function () { settle(batch); }
        });
      }
    });
  } else if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (n) { n.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add("is-visible");
          // Once the entrance has played, drop its staggered delays so hovers respond at once
          setTimeout(function () { el.classList.add("is-settled"); }, 1600);
          io.unobserve(el);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------------------- */
  /* Decoding labels: mono text scrambles, then settles left to right.       */
  /* Section labels decode once as they scroll in; links decode on hover.    */
  /* Only used on mono text or tabular figures, so the width never jumps.    */
  /* ---------------------------------------------------------------------- */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";
  var DIGITS = "0123456789";

  function decode(el, glyphs) {
    glyphs = glyphs || GLYPHS;
    if (reduceMotion || el._decoding) return;
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    if (!nodes.length) return;
    var originals = nodes.map(function (n) { return n.nodeValue; });
    var length = originals.join("").length;
    var duration = Math.min(900, 320 + length * 14);
    var begin = performance.now();
    el._decoding = true;

    (function frame(now) {
      var p = Math.min(1, (now - begin) / duration);
      var seen = 0;
      nodes.forEach(function (node, k) {
        var text = originals[k], out = "";
        for (var i = 0; i < text.length; i++, seen++) {
          var ch = text[i];
          var keep = ch === " " || p >= 1 || seen / length < p || (glyphs === DIGITS && !/\d/.test(ch));
          out += keep ? ch : glyphs[(Math.random() * glyphs.length) | 0];
        }
        node.nodeValue = out;
      });
      if (p < 1) requestAnimationFrame(frame);
      else el._decoding = false;
    })(begin);
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    var decodeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        decode(entry.target);
        decodeIO.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll(".section-num, .eyebrow, .hero-meta").forEach(function (n) { decodeIO.observe(n); });

    if (motion) {
      // Figures count up from zero (every number in them, so "100–150" counts both ends)
      document.querySelectorAll(".stat-num").forEach(function (el) {
        var text = el.textContent, count = { p: 0 };
        var show = function () {
          el.textContent = text.replace(/\d+/g, function (d) { return String(Math.round(+d * count.p)); });
        };
        show();
        ScrollTrigger.create({
          trigger: el,
          start: "top 90%",
          once: true,
          onEnter: function () { gsap.to(count, { p: 1, duration: 1.8, ease: "power3.out", onUpdate: show }); }
        });
      });
    } else {
      // Figures count in by spinning through digits
      var statIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          decode(entry.target, DIGITS);
          statIO.unobserve(entry.target);
        });
      }, { threshold: 0.8 });
      document.querySelectorAll(".stat-num").forEach(function (n) { statIO.observe(n); });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Words: section titles light up word by word as they scroll up the        */
  /* screen, and each track's notes rise in word by word as it takes the lead */
  /* ---------------------------------------------------------------------- */
  // Wraps every word under el (inside <em> too) in a span; returns the spans in order
  function splitWords(el, className) {
    var words = [];
    var wrap = function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var span = document.createElement("span");
          span.className = className;
          span.textContent = part;
          words.push(span);
          frag.appendChild(span);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && !node.classList.contains("tbc")) {
        Array.prototype.slice.call(node.childNodes).forEach(wrap);
      }
    };
    Array.prototype.slice.call(el.childNodes).forEach(wrap);
    return words;
  }

  if (!reduceMotion) {
    document.querySelectorAll(".statement, .section-title").forEach(function (el) {
      var words = splitWords(el, "w");
      if (!words.length) return;
      el.classList.remove("reveal");   // the words do the entrance now
      el.classList.add("is-scrubbed");

      if (motion) {
        // Lit from when the top crosses 92% of the screen until a third of a screen later;
        // scrub eases the words a beat behind the scroll, so they fade rather than flip
        gsap.fromTo(words, { opacity: 0.12, filter: "blur(3px)" }, {
          opacity: 1, filter: "blur(0px)", ease: "none", stagger: 0.12,
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 60%", scrub: 0.6 }
        });
        return;
      }

      var ticking = false;
      var update = function () {
        ticking = false;
        var r = el.getBoundingClientRect(), vh = window.innerHeight;
        // Starts lighting as the top crosses 92% of the screen, fully lit after another third of a screen
        var p = (vh * 0.92 - r.top) / (vh * 0.32);
        var lit = Math.round(Math.max(0, Math.min(1, p)) * words.length);
        words.forEach(function (w, i) { w.classList.toggle("is-lit", i < lit); });
      };
      window.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      update();
    });

    document.querySelectorAll(".track").forEach(function (item) {
      var n = 0;
      item.querySelectorAll(".track-title, .track-desc").forEach(function (el) {
        splitWords(el, "tw").forEach(function (w) { w.style.setProperty("--i", n++); });
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Pointer spotlight on cards and cells (fine pointers only)               */
  /* ---------------------------------------------------------------------- */
  if (window.matchMedia("(pointer: fine)").matches) {
    var SPOT = ".card, .fig-cell, .roadmap li, .steps li, .stat, .track";
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest(SPOT);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var el = e.target.closest && e.target.closest(SPOT);
      if (el && !el.contains(e.relatedTarget)) {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      }
    });
  }

  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".nav-list a:not(.btn), .text-link, .rail a").forEach(function (a) {
      a.addEventListener("pointerenter", function () { decode(a); });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Section rail: highlight the section in view                             */
  /* ---------------------------------------------------------------------- */
  var rail = document.querySelector("[data-rail]");
  if (rail && "IntersectionObserver" in window) {
    var railLinks = rail.querySelectorAll("a[href^='#']");
    var setActive = function (id) {
      railLinks.forEach(function (a) {
        if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    var railIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    railLinks.forEach(function (a) {
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (target) railIO.observe(target);
    });
  }

  /* Floating pill: hidden over the hero (it has its own buttons), the tracks race
     (it would sit on the race panel) and once the interest list is on screen */
  var pill = document.querySelector("[data-float-pill]");
  var pillTarget = pill && document.querySelector(pill.getAttribute("href"));
  var pillHero = document.querySelector(".hero");
  var pillRace = document.querySelector("[data-race-stage]");
  if (pill && pillTarget && "IntersectionObserver" in window) {
    var inView = new Map();
    var onView = function (entries) {
      entries.forEach(function (entry) { inView.set(entry.target, entry.isIntersecting); });
      var hide = false;
      inView.forEach(function (v) { hide = hide || v; });
      pill.classList.toggle("is-hidden", hide);
    };
    var pillIO = new IntersectionObserver(onView, { threshold: 0.15 });
    pillIO.observe(pillTarget);
    if (pillHero) pillIO.observe(pillHero);
    // The race stage is many screens tall, so any overlap at all counts
    if (pillRace) new IntersectionObserver(onView).observe(pillRace);
  }

  /* ---------------------------------------------------------------------- */
  /* Cursor: a dot that opens into a ring over anything you can click.       */
  /* Mouse only; touch and pens keep the system's own pointer.               */
  /* ---------------------------------------------------------------------- */
  if (finePointer) {
    var cursor = document.createElement("div");
    var CLICKABLE = "a, button, summary, label, select, [role='button'], [tabindex]:not([tabindex='-1'])";
    var TYPING = "input, textarea, [contenteditable='true']";
    var cursorX = 0, cursorY = 0, cursorRaf = null;
    cursor.className = "cursor is-off";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<span class="cursor-ring"></span><span class="cursor-dot"></span>';
    document.body.appendChild(cursor);
    root.classList.add("has-cursor");
    var dot = cursor.querySelector(".cursor-dot"), ring = cursor.querySelector(".cursor-ring");
    // With GSAP the ring glides after the dot; without it, both sit on the pointer
    var ringX = motion ? gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3.out" }) : null;
    var ringY = motion ? gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3.out" }) : null;

    var place = function () {
      cursorRaf = null;
      dot.style.transform = "translate3d(" + cursorX + "px, " + cursorY + "px, 0)";
      if (ringX) { ringX(cursorX); ringY(cursorY); }
      else ring.style.transform = dot.style.transform;
    };
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var t = e.target;
      cursorX = e.clientX;
      cursorY = e.clientY;
      if (cursor.classList.contains("is-off") && ringX) gsap.set(ring, { x: cursorX, y: cursorY });
      cursor.classList.remove("is-off");
      cursor.classList.toggle("is-hover", !!(t.closest && t.closest(CLICKABLE)));
      cursor.classList.toggle("is-text", !!(t.closest && t.closest(TYPING)));
      if (!cursorRaf) cursorRaf = requestAnimationFrame(place);
    }, { passive: true });
    document.addEventListener("pointerdown", function () { cursor.classList.add("is-down"); });
    document.addEventListener("pointerup", function () { cursor.classList.remove("is-down"); });
    document.documentElement.addEventListener("mouseleave", function () { cursor.classList.add("is-off"); });
    window.addEventListener("blur", function () { cursor.classList.add("is-off"); });
  }

  /* ---------------------------------------------------------------------- */
  /* GSAP-only polish                                                        */
  /* ---------------------------------------------------------------------- */
  if (motion) {
    // The hero comes in as one piece: meta, wordmark out of a blur, tagline, then the details
    var hero = document.querySelector(".hero");
    if (hero) {
      gsap.timeline({ defaults: { ease: "expo.out", duration: 1.4 } })
        .from(".hero-meta", { y: 14, opacity: 0, duration: 1 }, 0.1)
        .from(".hero-wordmark", { yPercent: 16, opacity: 0, filter: "blur(14px)", duration: 1.7 }, 0.15)
        .from(".hero-tagline", { y: 24, opacity: 0 }, 0.5)
        .from(".hero-foot > *", { y: 16, opacity: 0, stagger: 0.1 }, 0.65);
      // ...and drifts up and dims as you scroll past it
      gsap.to(".hero-inner", {
        yPercent: -10, opacity: 0.3, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true }
      });
    }
    // Page heroes drift the same way
    document.querySelectorAll(".page-hero > .container").forEach(function (copy) {
      gsap.to(copy, {
        yPercent: -12, opacity: 0.35, ease: "none",
        scrollTrigger: { trigger: copy.parentNode, start: "top top", end: "bottom top", scrub: true }
      });
    });

    // The ticker runs on GSAP's clock and picks up speed while you scroll
    var tickerTrack = document.querySelector(".ticker-track");
    if (tickerTrack) {
      tickerTrack.style.animation = "none";
      var ticker = gsap.to(tickerTrack, { xPercent: -50, duration: 80, ease: "none", repeat: -1 });
      if (lenis) {
        lenis.on("scroll", function (e) {
          gsap.to(ticker, { timeScale: 1 + Math.min(6, Math.abs(e.velocity) * 0.25), duration: 0.25, overwrite: true });
          gsap.to(ticker, { timeScale: 1, duration: 1.4, delay: 0.3, ease: "power2.out" });
        });
      }
    }

    // Buttons lean a little toward the pointer
    if (finePointer) {
      document.querySelectorAll(".btn").forEach(function (btn) {
        var xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
        var yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        btn.addEventListener("pointermove", function (e) {
          var r = btn.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.18);
          yTo((e.clientY - r.top - r.height / 2) * 0.3);
        });
        btn.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
      });
    }

    // Fonts and the ASCII canvases can shift the layout a little after load
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (n) {
    n.textContent = new Date().getFullYear();
  });
})();
