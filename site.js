// Repetite's website: the theme switch, the navbar island, and the live
// demos (tour, Lock Screen reminders, "Try it", rest timer, coach). Every
// part checks its elements exist, so the legal pages can load it too.
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $all(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  // Scroll motion: parts register a function here and it runs once a frame
  // while the page scrolls (never with Reduce Motion). progressOf gives 0
  // when an element's top is at `start` of the screen's height and 1 when
  // it reaches `end` (0.9 = near the bottom, 0.3 = near the top).
  var scrollFx = [];

  // Smooth scrolling (Lenis, vendor/lenis.min.js, MIT). It eases the wheel
  // and trackpad and handles #links (sections keep room for the navbar with
  // scroll-margin-top, which Lenis respects); touch keeps
  // the phone's own scrolling. Off with Reduce Motion.
  // How scrolling feels: lerp is how quickly it catches up with the wheel
  // (lower glides longer), wheel how far a notch moves, jump how long a
  // #link takes (seconds).
  var FEEL = { lerp: 0.085, wheel: 1, jump: 1.3 };
  var lenis = null;
  var snap = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new window.Lenis({ lerp: FEEL.lerp, wheelMultiplier: FEEL.wheel, autoRaf: true, stopInertiaOnNavigate: true });
    root.classList.add("has-lenis");
    // Snap points (the tour's screens) pull the scroll in when it stops near one.
    if (window.Snap) snap = new window.Snap(lenis, { type: "proximity", distanceThreshold: "30%", duration: 0.7, debounce: 180 });
  }
  function easeInOutQuart(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: FEEL.jump * 0.7, easing: easeInOutQuart });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }
  // # links glide with a slower ease that can't be interrupted, and keyboard
  // focus lands on the section's heading so screen readers follow.
  if (lenis) {
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var id = link.getAttribute("href").slice(1);
      var target = id === "top" || id === "" ? 0 : document.getElementById(id);
      if (target === null) return;
      e.preventDefault();
      // Lenis keeps the section's scroll-margin-top (room for the navbar) itself.
      lenis.scrollTo(target, {
        duration: FEEL.jump, easing: easeInOutQuart, lock: true,
        onComplete: function () {
          var heading = target === 0 ? document.querySelector("h1") : target.querySelector("h1, h2");
          if (heading) {
            if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
          }
        }
      });
      if (history.replaceState) history.replaceState(null, "", id === "top" ? location.pathname : "#" + id);
    });
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function progressOf(el, start, end) {
    var vh = window.innerHeight;
    return clamp01((start * vh - el.getBoundingClientRect().top) / ((start - end) * vh));
  }
  // Scroll motion writes CSS variables through this: only when the value
  // changes, and on the element that uses it. A variable set on a big parent
  // makes the browser restyle everything inside it, every frame.
  function setVar(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  }

  // ---------- Theme: the plate rolls along the bar ----------
  var toggle = $(".theme-toggle");
  function effectiveTheme() {
    var set = root.getAttribute("data-theme");
    return set === "light" || set === "dark" ? set : (systemDark.matches ? "dark" : "light");
  }
  function syncToggle() {
    var theme = effectiveTheme();
    var dark = theme === "dark";
    if (toggle) {
      toggle.setAttribute("data-state", theme);
      toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      toggle.setAttribute("aria-pressed", dark ? "true" : "false");
    }
    $all('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute("content", dark ? "#0E0C0B" : "#FAF8F6");
    });
  }
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    store("repetite-theme", theme);
    syncToggle();
  }
  // First the plate rolls to the other end of the bar, live; then the new
  // theme spreads out in a circle from it. The page is captured for the
  // circle with animations off, so the navbar (and everything else) is
  // already in its final look: nothing jumps when the circle finishes.
  var switching = false;
  if (toggle) {
    toggle.addEventListener("click", function () {
      if (switching) return;
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      toggle.setAttribute("data-state", next);
      if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
      switching = true;
      setTimeout(function () {
        var box = toggle.getBoundingClientRect();
        var x = box.left + box.width / 2;
        var y = box.top + box.height / 2;
        var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        var applied = false;
        var finished = false;
        function apply() {
          if (applied) return;
          applied = true;
          root.classList.add("theme-swap");
          applyTheme(next);
        }
        function finish() {
          if (finished) return;
          finished = true;
          apply();
          // A moment later, so turning animations back on can't animate the swap.
          setTimeout(function () { root.classList.remove("theme-swap"); }, 60);
          switching = false;
        }
        var transition;
        try {
          transition = document.startViewTransition(apply);
        } catch (e) {
          finish();
          return;
        }
        transition.ready.then(function () {
          root.animate(
            { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
            { duration: 650, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" }
          );
        }).catch(function () {});
        transition.finished.then(finish, finish);
        // If the browser never runs it, the theme still changes.
        setTimeout(finish, 1500);
      }, 380);
    });
  }
  if (systemDark.addEventListener) systemDark.addEventListener("change", syncToggle);
  syncToggle();

  // ---------- Navbar: the island ----------
  // A black pill like the iPhone's Dynamic Island. It names the section
  // you're reading and fills a ring as you scroll; pointing at it (with a
  // mouse) or tapping it grows it into the menu. Its size is set here as
  // --w and --h so the CSS can spring between them.
  var isl = $(".isl");
  var islShell = $(".isl-shell");
  var pill = $(".isl-pill");
  var panel = $(".isl-panel");
  var nowIn = $(".isl-now-in");
  var ring = $(".isl-ring .f");
  var where = $(".isl-where b");
  var islLinks = $all(".isl-link");
  var toTop = $(".to-top");
  var islOpen = false;
  // What the pill says above the first section (on another page: its name).
  var restLabel = nowIn ? nowIn.innerHTML : "";
  var restWhere = where ? where.textContent : "";
  // The sections the menu links to, in page order.
  var spots = islLinks.map(function (link) {
    var href = link.getAttribute("href") || "";
    var section = href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
    var use = link.querySelector("use");
    return section ? { el: section, link: link, label: link.textContent.trim(), icon: use ? use.getAttribute("href") : "" } : null;
  }).filter(Boolean);
  var shownSpot = null;

  function sizeIsland() {
    if (!isl) return;
    if (islOpen) {
      var width = Math.min(760, root.clientWidth - 24);
      var room = window.innerHeight - isl.getBoundingClientRect().top - 12;
      isl.style.setProperty("--pw", width + "px");
      isl.style.setProperty("--ph", room + "px");
      isl.style.setProperty("--w", width + "px");
      isl.style.setProperty("--h", Math.min(panel.scrollHeight, room) + "px");
    } else {
      isl.style.setProperty("--w", pill.offsetWidth + "px");
      isl.style.setProperty("--h", pill.offsetHeight + "px");
    }
  }

  function setLabel(spot) {
    if (spot) {
      nowIn.innerHTML = '<svg aria-hidden="true"><use href="' + spot.icon + '"/></svg><span></span>';
      nowIn.lastChild.textContent = spot.label;
    } else {
      nowIn.innerHTML = restLabel;
    }
  }

  // The label's slot is as wide as the longest label, so the pill keeps one
  // size while the section changes and only the words slide.
  function fitLabelSlot() {
    if (!nowIn) return;
    var slot = nowIn.parentNode;
    slot.style.minWidth = "";
    var widest = 0;
    [null].concat(spots).forEach(function (spot) {
      setLabel(spot);
      widest = Math.max(widest, slot.getBoundingClientRect().width);
    });
    setLabel(shownSpot);
    slot.style.minWidth = Math.ceil(widest) + "px";
  }

  function showSpot(spot) {
    if (!nowIn || spot === shownSpot) return;
    shownSpot = spot;
    setLabel(spot);
    if (where) where.textContent = spot ? spot.label : restWhere;
    islLinks.forEach(function (link) {
      var on = !!spot && link === spot.link;
      link.classList.toggle("on", on);
      if (on) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
    });
    if (!reduceMotion && nowIn.animate) {
      nowIn.animate([
        { transform: "translateY(80%)", opacity: 0, filter: "blur(3px)" },
        { transform: "none", opacity: 1, filter: "none" }
      ], { duration: 420, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
    if (!islOpen) sizeIsland();
  }

  function setIsland(open) {
    if (!isl || open === islOpen) return;
    islOpen = open;
    isl.classList.toggle("open", open);
    islShell.classList.toggle("open", open);
    pill.setAttribute("aria-expanded", open ? "true" : "false");
    pill.tabIndex = open ? -1 : 0;
    panel.inert = !open;
    if (!open && lenis) lenis.start();
    if (!open && panel.contains(document.activeElement)) pill.focus({ preventScroll: true });
    sizeIsland();
  }

  if (isl && pill && panel) {
    panel.inert = true;
    // A click from the keyboard (Enter or Space) moves focus into the menu.
    pill.addEventListener("click", function (e) {
      setIsland(true);
      if (lenis) lenis.stop();
      if (e.detail === 0 && islLinks[0]) islLinks[0].focus({ preventScroll: true });
    });
    $(".isl-close").addEventListener("click", function () { setIsland(false); });
    $all("a", panel).forEach(function (a) { a.addEventListener("click", function () { setIsland(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && islOpen) { setIsland(false); pill.focus({ preventScroll: true }); } });
    document.addEventListener("pointerdown", function (e) { if (islOpen && !isl.contains(e.target)) setIsland(false); });
    isl.addEventListener("focusout", function (e) { if (islOpen && e.relatedTarget && !isl.contains(e.relatedTarget)) setIsland(false); });
    // With a mouse it opens on hover, after a beat so passing over it doesn't.
    var hoverTimer;
    isl.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { setIsland(true); }, 90);
    });
    isl.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { setIsland(false); }, 320);
    });
    window.addEventListener("resize", sizeIsland);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitLabelSlot(); sizeIsland(); });
    fitLabelSlot();
    sizeIsland();
  }

  var scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    var y = window.scrollY;
    if (toTop) toTop.classList.toggle("show", y > window.innerHeight * 1.2);
    if (ring) {
      var max = root.scrollHeight - window.innerHeight;
      ring.style.strokeDashoffset = (100 - (max > 0 ? Math.min(1, y / max) : 0) * 100).toFixed(2);
    }
    if (spots.length) {
      var line = window.innerHeight * 0.42;
      var current = null;
      spots.forEach(function (spot) { if (spot.el.getBoundingClientRect().top <= line) current = spot; });
      showSpot(current);
    }
  }
  window.addEventListener("scroll", function () {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // ---------- Headings rise in word by word ----------
  // Only plain-text headings; each word keeps its space for screen readers.
  if (!reduceMotion) {
    $all(".section-head h2, .coach-grid .h2, .plates-grid .h2, .skin-grid .h2, .rest-panel h2, .privacy-panel h2, .closing h2").forEach(function (heading) {
      if (heading.children.length) return;
      var words = heading.textContent.trim().split(/\s+/);
      heading.textContent = "";
      words.forEach(function (word, i) {
        var span = document.createElement("span");
        span.className = "w";
        span.style.setProperty("--i", i);
        span.textContent = word;
        heading.appendChild(span);
        if (i < words.length - 1) heading.appendChild(document.createTextNode(" "));
      });
      heading.classList.add("split");
    });
    $all(".split").forEach(function (heading) {
      var words = $all(".w", heading);
      var closing = !!heading.closest(".closing");
      scrollFx.push(function () {
        var p = closing ? progressOf(heading, 0.95, 0.6) : progressOf(heading, 0.88, 0.42);
        var lit = closing ? p * (words.length + 0.3) - 0.15 : p * words.length;
        words.forEach(function (w, i) { w.classList.toggle(closing ? "land" : "lit", i < lit); });
      });
    });
  }

  // ---------- Reveal on scroll ----------
  var reveals = $all(".reveal, .split");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); revealer.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { revealer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // ---------- Numbers count up ----------
  var counters = $all("[data-count]");
  if ("IntersectionObserver" in window && !reduceMotion && counters.length) {
    var counted = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        counted.unobserve(entry.target);
        var el = entry.target;
        var end = Number(el.getAttribute("data-count"));
        var start = performance.now();
        (function frame(now) {
          var t = Math.min(1, (now - start) / 1200);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(end * eased).toLocaleString("en-US");
          if (t < 1) requestAnimationFrame(frame);
        })(start);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { counted.observe(el); });
  }

  // ---------- Segmented controls ----------
  function placePill(control) {
    var pill = $(".seg-pill", control);
    var on = $('[aria-selected="true"]', control);
    if (!pill || !on) return;
    pill.style.left = on.offsetLeft + "px";
    pill.style.width = on.offsetWidth + "px";
  }

  // ---------- Tour ----------
  // Tabs with a phone that slides between screens. Numbered points beside
  // it light their dot on the phone. It moves on every 6 s while it's on
  // screen and nobody's touching it; a swipe on the phone changes tab.
  var tour = $("#tour");
  if (tour) {
    var tabs = $all('[role="tab"]', tour);
    var control = $(".segmented", tour);
    var stack = $(".tour-phone .stack", tour);
    var tourPhone = $(".tour-phone", tour);
    var tourIndex = 0;
    var tourTimer = null;
    var tourHeldUntil = 0;
    var tourHover = false;
    var tourOnScreen = false;
    var TOUR_MS = 6000;
    function select(tab, focus) {
      var next = tabs.indexOf(tab);
      if (stack) stack.style.setProperty("--dir", next >= tourIndex ? "1" : "-1");
      tourIndex = next;
      var name = tab.getAttribute("data-tab");
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      // The new screen opens out from its first dot; the old one sinks back.
      $all(".stack .shot", tour).forEach(function (shot) {
        var wasOn = shot.classList.contains("on");
        var on = shot.getAttribute("data-tab") === name;
        if (on && !wasOn) {
          var first = $(".tpin", shot);
          shot.style.setProperty("--ox", first && first.classList.contains("right") ? "100%" : "0%");
          shot.style.setProperty("--oy", first ? first.style.getPropertyValue("--y") : "50%");
        }
        shot.classList.toggle("on", on);
        if (wasOn && !on) {
          shot.classList.add("was");
          setTimeout(function () { shot.classList.remove("was"); }, 820);
        }
      });
      if (stack && !reduceMotion) {
        stack.classList.remove("sweep");
        void stack.offsetWidth;
        stack.classList.add("sweep");
      }
      $all(".tpin.lit, .points li.lit", tour).forEach(function (el) { el.classList.remove("lit"); });
      placePill(control);
      if (focus) tab.focus();
      tourSchedule();
    }
    // On a big enough screen the tour pins in place and scrolling moves it
    // through the screens; the tabs then scroll to their screen.
    var tourBody = $(".tour-body", tour);
    var tourStick = $(".tour-stick", tour);
    var pinQuery = window.matchMedia("(min-width: 901px) and (min-height: 640px)");
    var pinned = false;
    var STICK_TOP = 84;
    var tourTimer = $(".tour-timer", tour);
    function tourDistance() { return Math.max(1, tourBody.offsetHeight - tourStick.offsetHeight); }
    function scrollToStep(i) {
      var top = tourBody.getBoundingClientRect().top + window.scrollY - STICK_TOP + tourDistance() * (i + 0.5) / tabs.length;
      scrollToY(top);
    }
    var unsnap = [];
    function setTourSnaps() {
      unsnap.forEach(function (remove) { remove(); });
      unsnap = [];
      if (!snap || !pinned) return;
      var top = tourBody.getBoundingClientRect().top + window.scrollY - STICK_TOP;
      tabs.forEach(function (tab, i) { unsnap.push(snap.add(top + tourDistance() * (i + 0.5) / tabs.length)); });
    }
    function setPinned() {
      pinned = !reduceMotion && pinQuery.matches && !!tourStick;
      if (tourBody) tourBody.classList.toggle("pinned", pinned);
      tourSchedule();
      setTourSnaps();
    }
    window.addEventListener("resize", function () { setTimeout(setTourSnaps, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setTourSnaps);
    function tourCanPlay() { return !pinned && !reduceMotion && tourOnScreen && !tourHover && !document.hidden && Date.now() >= tourHeldUntil; }
    function tourSchedule() {
      clearTimeout(tourTimer);
      tour.classList.remove("playing");
      if (reduceMotion || pinned) return;
      void tour.offsetWidth;
      tour.classList.add("playing");
      tour.classList.toggle("held", !tourCanPlay());
      tourTimer = setTimeout(function () {
        if (tourCanPlay()) select(tabs[(tourIndex + 1) % tabs.length]); else tourSchedule();
      }, Math.max(TOUR_MS, tourHeldUntil - Date.now()));
    }
    function tourHold() { tourHeldUntil = Date.now() + 12000; }
    function tourRefresh() { tour.classList.toggle("held", !tourCanPlay()); }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        if (pinned) { scrollToStep(i); return; }
        tourHold();
        select(tab);
      });
      tab.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = (i + step + tabs.length) % tabs.length;
        if (pinned) { scrollToStep(next); tabs[next].focus(); return; }
        tourHold();
        select(tabs[next], true);
      });
    });
    // A point lights its dot on the phone.
    $all(".points li[data-pin]", tour).forEach(function (li) {
      function light(on) {
        var shot = $(".stack .shot.on", tour);
        var pin = shot && $('.tpin[data-pin="' + li.getAttribute("data-pin") + '"]', shot);
        li.classList.toggle("lit", on);
        if (pin) pin.classList.toggle("lit", on);
      }
      li.addEventListener("pointerenter", function () { light(true); });
      li.addEventListener("pointerleave", function () { light(false); });
      li.addEventListener("click", function () { tourHold(); light(!li.classList.contains("lit")); });
    });
    if (tourBody) {
      tourBody.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { tourHover = true; tourRefresh(); } });
      tourBody.addEventListener("pointerleave", function () { tourHover = false; tourRefresh(); });
    }
    // Swipe the phone to change tab.
    if (tourPhone) {
      var swipeX = null;
      tourPhone.addEventListener("pointerdown", function (e) { swipeX = e.clientX; });
      tourPhone.addEventListener("pointerup", function (e) {
        if (swipeX === null) return;
        var dx = e.clientX - swipeX;
        swipeX = null;
        if (Math.abs(dx) < 40) return;
        if (pinned) { scrollToStep((tourIndex + (dx < 0 ? 1 : -1) + tabs.length) % tabs.length); return; }
        tourHold();
        select(tabs[(tourIndex + (dx < 0 ? 1 : -1) + tabs.length) % tabs.length]);
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        tourOnScreen = entries[0].isIntersecting;
        tourRefresh();
      }, { threshold: 0.35 }).observe(tourBody || tour);
    }
    document.addEventListener("visibilitychange", tourRefresh);
    window.addEventListener("resize", function () { placePill(control); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(control); });
    placePill(control);
    if (pinQuery.addEventListener) pinQuery.addEventListener("change", setPinned);
    setPinned();
    scrollFx.push(function () {
      if (!pinned) return;
      var p = clamp01((STICK_TOP - tourBody.getBoundingClientRect().top) / tourDistance());
      setVar(tourTimer || tour, "--tp", p.toFixed(3));
      var i = Math.min(tabs.length - 1, Math.floor(p * tabs.length));
      if (i !== tourIndex) select(tabs[i]);
    });
  }

  // ---------- Lock Screen: a day of reminders, in the tone you pick ----------
  // The wording comes from the app's own reminder lines (NudgeVoice). The
  // three arrive one by one; picking a tone rewrites the ones on screen.
  var lock = $("#lock-demo");
  if (lock) {
    var usual = "oats, banana and whey";
    var ideas = "Ideas from what you eat: paneer bhurji (25 g) or Greek yogurt (20 g).";
    var tones = {
      playful: [
        ["Rise and dine, Alex ☀️", "Your usual: " + usual + ". One tap and breakfast is logged."],
        ["Leg day is calling 🦵", "It's not taking no for an answer. 6 exercises, about 55 min."],
        ["Protein called. You didn't pick up 💪", "62 g to go, Alex. " + ideas]
      ],
      friendly: [
        ["How was breakfast, Alex?", "If it was your usual (" + usual + "), one tap logs it."],
        ["Lower day today, Alex", "6 exercises, about 55 min. Last time: Squat 100 kg × 6."],
        ["62 g protein left today", "You're on your way, Alex. " + ideas]
      ],
      straight: [
        ["No breakfast logged", "Usual: " + usual + ". Log it in one tap."],
        ["Lower today", "6 exercises, about 55 min. Last time: Squat 100 kg × 6."],
        ["62 g protein to go", ideas]
      ],
      tough: [
        ["Alex, breakfast won't log itself", "Your usual: " + usual + ". One tap. Do it now."],
        ["Alex, it's Lower day", "6 exercises, about 55 min. Last time: Squat 100 kg × 6. Beat it."],
        ["62 g protein still missing", "Muscle doesn't grow on good intentions, Alex. Paneer bhurji (25 g) or Greek yogurt (20 g)."]
      ]
    };
    var slots = [
      { time: "9:00", label: "9:00 AM", actions: ["Log my usual"] },
      { time: "5:30", label: "5:30 PM", actions: ["Start workout"] },
      { time: "7:15", label: "7:15 PM", actions: ["Log food"] }
    ];
    var tone = "playful";
    var list = $(".notes", lock);
    var clock = $(".lock-time", lock);
    var shown = 0;

    function makeNote(i, isNew) {
      var line = tones[tone][i];
      var li = document.createElement("li");
      li.className = "note" + (isNew ? " enter" : "");
      li.setAttribute("data-slot", String(i));
      li.innerHTML =
        '<img src="images/icon-64.png" alt="" width="34" height="34">' +
        '<div><div class="note-head"><b>REPETITE</b><span></span></div><strong></strong><p></p></div>';
      $(".note-head span", li).textContent = isNew ? "now" : slots[i].label;
      $("strong", li).textContent = line[0];
      $("p", li).textContent = line[1];
      if (isNew) {
        var actions = document.createElement("div");
        actions.className = "note-actions";
        slots[i].actions.forEach(function (label) {
          var span = document.createElement("span");
          span.textContent = label;
          actions.appendChild(span);
        });
        li.appendChild(actions);
      }
      return li;
    }
    // Shows the first n reminders, newest on top, without animating.
    function render(n) {
      list.textContent = "";
      for (var i = 0; i < n; i++) list.insertBefore(makeNote(i, i === n - 1), list.firstChild);
      if (n) clock.textContent = slots[n - 1].time;
    }
    function step() {
      if (shown >= slots.length) return;
      var i = shown;
      shown += 1;
      clock.classList.add("tick");
      setTimeout(function () {
        clock.textContent = slots[i].time;
        clock.classList.remove("tick");
        $all(".note", list).forEach(function (old) {
          var actions = $(".note-actions", old);
          if (actions) actions.remove();
          $(".note-head span", old).textContent = slots[Number(old.getAttribute("data-slot"))].label;
          old.classList.remove("enter");
        });
        list.insertBefore(makeNote(i, true), list.firstChild);
      }, 260);
    }
    // Scrolling down brings the next one in; scrolling back takes it away.
    function showCount(n) {
      if (n === shown) return;
      if (n === shown + 1) { step(); return; }
      shown = n;
      render(n);
      if (!n) clock.textContent = "8:41";
    }

    var toneSwitch = $("#tone-switch");
    if (toneSwitch) {
      var toneTabs = $all("[data-tone]", toneSwitch);
      var pickTone = function (tab, focus) {
        tone = tab.getAttribute("data-tone");
        toneTabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
        });
        placePill(toneSwitch);
        if (focus) tab.focus();
        // Rewrite what's on screen in the new voice.
        render(Math.max(shown, 1));
        if (!shown) shown = 1;
        if (!reduceMotion) {
          $all(".note", list).forEach(function (note, k) {
            note.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
              { duration: 360, delay: k * 60, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
          });
        }
      };
      toneTabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { pickTone(tab); });
        tab.addEventListener("keydown", function (e) {
          var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          pickTone(toneTabs[(i + step + toneTabs.length) % toneTabs.length], true);
        });
      });
      window.addEventListener("resize", function () { placePill(toneSwitch); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(toneSwitch); });
      placePill(toneSwitch);
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      render(slots.length);
      shown = slots.length;
    } else {
      list.textContent = "";
      clock.textContent = "8:41";
      scrollFx.push(function () {
        var p = progressOf(lock, 0.7, 0.05);
        showCount(p < 0.04 ? 0 : p < 0.36 ? 1 : p < 0.68 ? 2 : 3);
      });
    }
  }

  // ---------- Try it: reminders cancelled as things get done ----------
  var tryit = $("#tryit");
  if (tryit) {
    var plan = [
      { id: "lunch", priority: 3 },
      { id: "water", priority: 2 },
      { id: "workout", priority: 4 },
      { id: "protein", priority: 3 }
    ];
    var names = { lunch: "The lunch reminder", water: "The water check", workout: "The workout reminder", protein: "The protein reminder" };
    var foot = $(".foot", tryit);
    var empty = $(".empty", tryit);
    var count = $(".coming-head span", tryit);
    function render() {
      var done = {};
      $all("input[data-done]", tryit).forEach(function (input) { done[input.getAttribute("data-done")] = input.checked; });
      var pending = plan.filter(function (item) { return !done[item.id]; });
      // There's no daily cap: everything still missing gets its reminder.
      var kept = pending;
      var keptIds = kept.map(function (item) { return item.id; });
      $all("li[data-id]", tryit).forEach(function (li) {
        li.classList.toggle("gone", keptIds.indexOf(li.getAttribute("data-id")) === -1);
      });
      var held = pending.filter(function (item) { return keptIds.indexOf(item.id) === -1; });
      foot.textContent = held.length ? names[held[0].id] + " is held back." : "";
      empty.hidden = kept.length > 0;
      count.textContent = kept.length + (kept.length === 1 ? " reminder" : " reminders");
    }
    $all("input[data-done]", tryit).forEach(function (input) { input.addEventListener("change", render); });
    render();
  }

  // ---------- Rest timer ----------
  var rest = $("#rest-demo");
  if (rest) {
    var CIRC = 2 * Math.PI * 15;
    var countEl = $(".live-count", rest);
    var titleEl = $(".live-text b", rest);
    var islandTime = $(".il-time", rest);
    var rings = $all(".ring .fg", rest);
    var minus = $('[data-rest="minus"]', rest);
    var plus = $('[data-rest="plus"]', rest);
    var skip = $('[data-rest="skip"]', rest);
    var startButton = $("#rest-start");
    var chips = $all(".sound-chips button");
    var sound = "done";
    var state = { total: 20, endsAt: 0, running: false, over: false };
    var loop = null;

    rings.forEach(function (ring) { ring.style.strokeDasharray = CIRC; });

    function format(seconds) {
      var s = Math.max(0, seconds);
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    function playSound(name) {
      try {
        var audio = new Audio("sounds/rest-" + name + ".m4a");
        var promise = audio.play();
        if (promise && promise.catch) promise.catch(function () {});
      } catch (e) {}
    }
    function draw() {
      var remaining = state.running ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : (state.over ? 0 : state.total);
      if (state.running && remaining <= 0) {
        state.running = false;
        state.over = true;
        playSound(sound);
        if (navigator.vibrate) navigator.vibrate([200, 120, 200]);
      }
      var fraction = state.over ? 1 : remaining / Math.max(1, state.total);
      rings.forEach(function (ring) { ring.style.strokeDashoffset = CIRC * (1 - fraction); });
      countEl.textContent = state.over ? "Go" : format(remaining);
      islandTime.textContent = state.over ? "Go" : format(remaining);
      titleEl.textContent = state.over ? "Rest's up" : "Rest · Upper";
      rest.classList.toggle("running", state.running);
      rest.classList.toggle("over", state.over);
      minus.disabled = !state.running;
      plus.disabled = !state.running && !state.over;
      skip.disabled = !state.running && !state.over;
      skip.textContent = state.over ? "Done" : "Skip";
      if (!state.running) { clearInterval(loop); loop = null; }
    }
    function run() {
      if (!loop) loop = setInterval(draw, 200);
      draw();
    }
    function start(seconds) {
      state.total = seconds;
      state.endsAt = Date.now() + seconds * 1000;
      state.running = true;
      state.over = false;
      run();
    }
    function reset() {
      state = { total: 20, endsAt: 0, running: false, over: false };
      draw();
    }
    // Until someone starts a rest themselves, scrolling runs the countdown:
    // 0:20 as it comes into view, "Go" (and the buzz) once it's well in.
    var byHand = false;
    var scrollOver = false;
    if (!reduceMotion) {
      scrollFx.push(function () {
        if (byHand || state.running) return;
        var p = progressOf(rest, 0.85, 0.25);
        if (p >= 1) {
          if (!scrollOver) { scrollOver = true; state.over = true; draw(); }
          return;
        }
        if (scrollOver) { scrollOver = false; state.over = false; draw(); }
        var remaining = Math.ceil(20 * (1 - p));
        rings.forEach(function (ring) { ring.style.strokeDashoffset = CIRC * (1 - remaining / 20); });
        countEl.textContent = format(remaining);
        islandTime.textContent = format(remaining);
      });
    }
    startButton.addEventListener("click", function () { byHand = true; start(20); });
    plus.addEventListener("click", function () {
      if (state.over) { start(15); return; }
      state.endsAt += 15000;
      state.total += 15;
      run();
    });
    minus.addEventListener("click", function () {
      // Cutting rest to nothing ends it, without the alarm.
      if (state.endsAt - 15000 <= Date.now() + 1000) { reset(); return; }
      state.endsAt -= 15000;
      state.total = Math.max(1, state.total - 15);
      run();
    });
    skip.addEventListener("click", reset);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        sound = chip.getAttribute("data-sound");
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        playSound(sound);
      });
    });
    draw();
  }

  // ---------- Coach proposals ----------
  $all(".proposal").forEach(function (card) {
    var done = $(".proposal-done span", card);
    $(".apply", card).addEventListener("click", function () {
      card.classList.add("applied");
      done.textContent = card.getAttribute("data-applied");
    });
    $(".later", card).addEventListener("click", function () {
      card.classList.add("dismissed");
      done.textContent = "Not now. Nothing changed.";
    });
    $(".undo", card).addEventListener("click", function () {
      card.classList.remove("applied", "dismissed");
    });
  });

  // ---------- Hero: phones tilt toward the pointer ----------
  var hero = $(".hero");
  var heroPhones = $(".hero-phones");
  if (hero && heroPhones && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var box = hero.getBoundingClientRect();
      var px = (e.clientX - box.left) / box.width - 0.5;
      var py = (e.clientY - box.top) / box.height - 0.5;
      heroPhones.style.setProperty("--ry", (px * 10).toFixed(2) + "deg");
      heroPhones.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
      heroPhones.style.setProperty("--px", px.toFixed(3));
      heroPhones.style.setProperty("--py", py.toFixed(3));
    });
    hero.addEventListener("pointerleave", function () {
      ["--rx", "--ry", "--px", "--py"].forEach(function (name) { heroPhones.style.removeProperty(name); });
    });
  }

  // ---------- Cards light up where the pointer is ----------
  $all(".cat, .card, .rules li, .fact, .plan").forEach(function (el) { el.classList.add("spot"); });
  if (!reduceMotion) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target && e.target.closest ? e.target.closest(".spot") : null;
      if (!el) return;
      var box = el.getBoundingClientRect();
      el.style.setProperty("--sx", (e.clientX - box.left) + "px");
      el.style.setProperty("--sy", (e.clientY - box.top) + "px");
    }, { passive: true });
  }

  // ---------- Buttons lean toward the pointer ----------
  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    $all(".btn, .round-btn").forEach(function (button) {
      button.addEventListener("pointermove", function (e) {
        var box = button.getBoundingClientRect();
        var dx = (e.clientX - (box.left + box.width / 2)) / box.width;
        var dy = (e.clientY - (box.top + box.height / 2)) / box.height;
        button.style.translate = (dx * 8).toFixed(1) + "px " + (dy * 6).toFixed(1) + "px";
      });
      button.addEventListener("pointerleave", function () { button.style.translate = ""; });
    });
  }

  // ---------- Screens: a carousel of phones ----------
  // The one in front is big and tilts toward the pointer; its pins pop up
  // once it settles. Swipe, drag, the arrows, the keys or the area tabs move
  // it; on its own it moves every 5 s while it's on screen and nobody's
  // touching it. With Reduce Motion it doesn't move by itself or in 3D.
  var showcase = $("#showcase");
  if (showcase) {
    var stage = $(".stage", showcase);
    var slides = $all(".slide", showcase);
    var showTabs = $(".showcase-tabs", showcase);
    var showCaption = $(".showcase-caption", showcase);
    var showCount = $(".showcase-count", showcase);
    var showNotes = $(".showcase-notes", showcase);
    var showCurrent = 0;
    var settleTimer = null;
    var playTimer = null;
    var heldUntil = 0;
    var hovering = false;
    var onScreen = false;
    var PLAY_MS = 5000;
    var total = slides.length;
    function pad(n) { return (n < 10 ? "0" : "") + n; }

    function layout(captionToo) {
      // On a phone the side ones only peek in, flatter and fainter.
      var narrow = window.innerWidth < 640;
      var step = narrow ? 0.82 : 0.64;
      var tilt = narrow ? 14 : 24;
      slides.forEach(function (slide, i) {
        var d = i - showCurrent;
        if (d > total / 2) d -= total;
        if (d < -total / 2) d += total;
        var a = Math.abs(d);
        var sign = d < 0 ? -1 : 1;
        var x = a === 0 ? 0 : sign * (step + (a - 1) * 0.42) * 100;
        var rotate = reduceMotion ? 0 : -sign * Math.min(a, 2) * tilt;
        var scale = 1 - Math.min(a, 3) * 0.14;
        slide.style.transform = "translateX(" + x.toFixed(1) + "%) rotateY(" + rotate + "deg) scale(" + scale.toFixed(2) + ")";
        slide.style.opacity = a > 2 || (narrow && a > 1) ? "0" : String(1 - a * (narrow ? 0.45 : 0.2));
        slide.style.zIndex = String(20 - a);
        slide.style.pointerEvents = a > 2 ? "none" : "";
        slide.classList.toggle("active", a === 0);
        slide.classList.remove("settled");
        slide.setAttribute("aria-hidden", a === 0 ? "false" : "true");
        var phone = $(".phone", slide);
        phone.style.removeProperty("--tx");
        phone.style.removeProperty("--ty");
      });
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { slides[showCurrent].classList.add("settled"); }, reduceMotion ? 50 : 520);

      var active = slides[showCurrent];
      function writeCaption() {
        $("strong", showCaption).textContent = active.getAttribute("data-title");
        $("span", showCaption).textContent = active.getAttribute("data-sub");
        showCount.textContent = pad(showCurrent + 1) + " / " + pad(total);
        // Where the labels don't fit beside the phone, they're listed under it.
        if (showNotes) {
          showNotes.textContent = "";
          $all(".pin b", active).forEach(function (label, i) {
            var item = document.createElement("li");
            var number = document.createElement("i");
            number.textContent = String(i + 1);
            item.appendChild(number);
            item.appendChild(document.createTextNode(label.textContent));
            showNotes.appendChild(item);
          });
        }
      }
      if (captionToo === false) {
        writeCaption();
      } else {
        showCaption.classList.add("swap");
        if (showNotes) showNotes.classList.add("swap");
        setTimeout(function () {
          writeCaption();
          showCaption.classList.remove("swap");
          if (showNotes) showNotes.classList.remove("swap");
        }, 180);
      }
      var group = active.getAttribute("data-group");
      $all("[data-group]", showTabs).forEach(function (tab) {
        var on = tab.getAttribute("data-group") === group;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
      });
      placePill(showTabs);
      schedule();
    }

    function go(index, byPerson) {
      showCurrent = (index + total) % total;
      if (byPerson) heldUntil = Date.now() + 9000;
      layout();
    }

    // Plays when it's on screen, not hovered, the page is showing, and
    // nobody moved it in the last few seconds.
    function canPlay() { return !reduceMotion && onScreen && !hovering && !document.hidden && Date.now() >= heldUntil; }
    function schedule() {
      clearTimeout(playTimer);
      showcase.classList.remove("playing");
      if (reduceMotion) return;
      void showcase.offsetWidth;
      showcase.classList.add("playing");
      showcase.classList.toggle("held", !canPlay());
      playTimer = setTimeout(function () {
        if (canPlay()) go(showCurrent + 1, false); else schedule();
      }, Math.max(PLAY_MS, heldUntil - Date.now()));
    }
    function refreshHold() { showcase.classList.toggle("held", !canPlay()); }

    $("#showcase-back").addEventListener("click", function () { go(showCurrent - 1, true); });
    $("#showcase-next").addEventListener("click", function () { go(showCurrent + 1, true); });
    $all("[data-group]", showTabs).forEach(function (tab) {
      tab.addEventListener("click", function () {
        var group = tab.getAttribute("data-group");
        var first = slides.findIndex(function (s) { return s.getAttribute("data-group") === group; });
        if (first >= 0) go(first, true);
      });
    });
    showTabs.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var tabs = $all("[data-group]", showTabs);
      var at = tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; });
      var next = tabs[(at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.click();
      next.focus();
      e.preventDefault();
    });
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(showCurrent + 1, true); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(showCurrent - 1, true); e.preventDefault(); }
    });

    // Tap a phone at the side to bring it to the front; swipe or drag to move.
    var press = null;
    var dragged = false;
    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      press = { x: e.clientX, y: e.clientY };
      dragged = false;
    });
    stage.addEventListener("pointerup", function (e) {
      if (!press) return;
      var dx = e.clientX - press.x;
      var dy = e.clientY - press.y;
      press = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        dragged = true;
        go(showCurrent + (dx < 0 ? 1 : -1), true);
      }
    });
    stage.addEventListener("pointercancel", function () { press = null; });
    slides.forEach(function (slide, i) {
      slide.addEventListener("click", function () {
        if (dragged) { dragged = false; return; }
        if (i !== showCurrent) go(i, true);
      });
    });

    // The phone in front leans toward the pointer.
    if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
      stage.addEventListener("pointermove", function (e) {
        var phone = $(".phone", slides[showCurrent]);
        var r = phone.getBoundingClientRect();
        var px = (e.clientX - (r.left + r.width / 2)) / r.width;
        var py = (e.clientY - (r.top + r.height / 2)) / r.height;
        phone.style.setProperty("--tx", Math.max(-1, Math.min(1, px)) * 8 + "deg");
        phone.style.setProperty("--ty", Math.max(-1, Math.min(1, py)) * -6 + "deg");
      });
    }
    stage.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hovering = true; refreshHold(); } });
    stage.addEventListener("pointerleave", function () {
      hovering = false;
      refreshHold();
      var phone = $(".phone", slides[showCurrent]);
      phone.style.removeProperty("--tx");
      phone.style.removeProperty("--ty");
    });
    document.addEventListener("visibilitychange", refreshHold);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        refreshHold();
      }, { threshold: 0.35 }).observe(stage);
    }
    window.addEventListener("resize", function () { layout(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(showTabs); });
    layout(false);
  }

  // ---------- Pricing: monthly or yearly, and which plan fits ----------
  var billing = $("#billing");
  var plansBox = $("#plans");
  if (billing && plansBox) {
    var proAmount = $("#pro-amount");
    var proSub = $("#pro-sub");
    function rollTo(el, to) {
      var from = parseFloat(el.textContent) || 0;
      if (reduceMotion) { el.textContent = to.toFixed(2); return; }
      var start = performance.now();
      function frame(now) {
        var t = Math.min(1, (now - start) / 480);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (from + (to - from) * eased).toFixed(2);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      // Lands on the exact price even if frames were skipped (a hidden tab).
      setTimeout(function () { el.textContent = to.toFixed(2); }, 520);
    }
    function setBilling(mode) {
      plansBox.setAttribute("data-billing", mode);
      $all("[data-billing]", billing).forEach(function (b) {
        var on = b.getAttribute("data-billing") === mode;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      placePill(billing);
      rollTo(proAmount, parseFloat(proAmount.getAttribute("data-" + mode)));
      proSub.classList.add("swap");
      setTimeout(function () { proSub.textContent = proSub.getAttribute("data-" + mode); proSub.classList.remove("swap"); }, 160);
    }
    $all("[data-billing]", billing).forEach(function (b) {
      b.addEventListener("click", function () { setBilling(b.getAttribute("data-billing")); });
    });
    placePill(billing);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(billing); });
    window.addEventListener("resize", function () { placePill(billing); });
    // The ticks draw in one after another.
    $all(".plan", plansBox).forEach(function (plan) {
      $all("li", plan).forEach(function (li, i) { li.style.setProperty("--i", i); });
    });

    var fitInput = $("#fit-meals");
    var fitAnswer = $("#fit-answer");
    var fitBox = $("#fit");
    if (fitInput && fitAnswer) {
      function renderFit() {
        var meals = parseInt(fitInput.value, 10);
        var pro = meals > 3;
        fitBox.style.setProperty("--fill", (meals / 6 * 100) + "%");
        fitBox.style.setProperty("--fit-color", pro ? "var(--brand)" : "var(--ok)");
        if (meals === 0) {
          fitAnswer.innerHTML = "<b>Free</b> is all you need. The 12,000+ built-in foods and the barcode scanner have no limits.";
        } else if (!pro) {
          fitAnswer.innerHTML = "<b>Free</b> has you covered: 3 AI food logs a day" + (meals === 3 ? ", which is exactly your 3" : "") + ", plus 3 coach messages.";
        } else {
          fitAnswer.innerHTML = "<b>Pro</b> makes more sense. " + meals + " a day is more than Free's 3, and Pro has no limit.";
        }
        $all(".plan", plansBox).forEach(function (plan) {
          plan.classList.toggle("pick", plan.getAttribute("data-plan") === (pro ? "pro" : "free"));
        });
      }
      fitInput.addEventListener("input", renderFit);
      renderFit();
    }
  }

  // ---------- Plate maths: load the bar ----------
  var loader = $(".loader");
  var weightInput = $("#plate-weight");
  if (loader && weightInput) {
    var SETS = {
      lb: { bar: 45, min: 45, max: 495, step: 5, plates: [
        { w: 45, h: "92%", width: 24, color: "#2E5BEA" },
        { w: 35, h: "80%", width: 20, color: "#E9B308" },
        { w: 25, h: "68%", width: 17, color: "#1F9D55" },
        { w: 10, h: "50%", width: 13, color: "#F2EFEA" },
        { w: 5, h: "40%", width: 11, color: "#3A332F" },
        { w: 2.5, h: "32%", width: 9, color: "#D9412E" }
      ] },
      kg: { bar: 20, min: 20, max: 250, step: 2.5, plates: [
        { w: 25, h: "92%", width: 26, color: "#D9412E" },
        { w: 20, h: "92%", width: 23, color: "#2E5BEA" },
        { w: 15, h: "92%", width: 19, color: "#E9B308" },
        { w: 10, h: "92%", width: 15, color: "#1F9D55" },
        { w: 5, h: "52%", width: 12, color: "#F2EFEA" },
        { w: 2.5, h: "42%", width: 10, color: "#3A332F" },
        { w: 1.25, h: "34%", width: 8, color: "#B9B3AE" }
      ] }
    };
    var unit = "lb";
    var leftStack = $("#plates-left");
    var rightStack = $("#plates-right");
    var unitControl = $("#plate-units");
    function fmt(n) { return Number(n.toFixed(2)).toLocaleString("en-US"); }
    function load(total, set) {
      var remaining = (total - set.bar) / 2;
      var out = [];
      set.plates.forEach(function (plate) {
        while (remaining >= plate.w - 1e-9) { out.push(plate); remaining -= plate.w; }
      });
      return { plates: out, rest: Math.max(0, Math.round(remaining * 100) / 100) };
    }
    function stack(container, plates) {
      var current = Array.prototype.filter.call(container.children, function (c) { return !c.classList.contains("out"); });
      var same = 0;
      while (same < current.length && same < plates.length && current[same].getAttribute("data-w") === String(plates[same].w)) same++;
      var leaving = current.slice(same);
      leaving.forEach(function (el) {
        el.classList.add("out");
        setTimeout(function () { el.remove(); }, reduceMotion ? 0 : 200);
      });
      plates.slice(same).forEach(function (plate, i) {
        var el = document.createElement("span");
        el.className = "plate";
        el.setAttribute("data-w", plate.w);
        el.style.setProperty("--h", plate.h);
        el.style.setProperty("--w", plate.width + "px");
        el.style.setProperty("--pc", plate.color);
        el.style.animationDelay = (i * 45) + "ms";
        container.insertBefore(el, leaving[0] || null);
      });
    }
    function render() {
      var set = SETS[unit];
      var total = Number(weightInput.value);
      var result = load(total, set);
      stack(leftStack, result.plates);
      stack(rightStack, result.plates);
      $("#plate-total").textContent = fmt(total);
      $("#plate-unit").textContent = unit;
      $("#plate-side").textContent = result.plates.length ? result.plates.map(function (p) { return fmt(p.w); }).join(" + ") : "just the bar";
      $("#plate-note").textContent = result.rest > 0
        ? "Each side is " + fmt(result.rest) + " " + unit + " short: no plate that small."
        : "On a " + set.bar + " " + unit + " bar.";
      weightInput.style.setProperty("--fill", ((total - set.min) / (set.max - set.min) * 100).toFixed(1) + "%");
      weightInput.setAttribute("aria-valuetext", fmt(total) + " " + unit);
    }
    function setUnit(next) {
      if (next === unit) return;
      var set = SETS[next];
      var value = Number(weightInput.value);
      var converted = next === "kg" ? value * 0.45359237 : value / 0.45359237;
      converted = Math.round(converted / set.step) * set.step;
      unit = next;
      weightInput.min = set.min;
      weightInput.max = set.max;
      weightInput.step = set.step;
      weightInput.value = Math.min(set.max, Math.max(set.min, converted));
      leftStack.textContent = "";
      rightStack.textContent = "";
      $all("[data-unit]", unitControl).forEach(function (b) {
        var on = b.getAttribute("data-unit") === next;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      placePill(unitControl);
      render();
    }
    weightInput.addEventListener("input", render);
    $all("[data-unit]", unitControl).forEach(function (b) {
      b.addEventListener("click", function () { setUnit(b.getAttribute("data-unit")); });
    });
    placePill(unitControl);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(unitControl); });
    window.addEventListener("resize", function () { placePill(unitControl); });
    render();
  }

  // ---------- Skincare: tick off a routine ----------
  // Morning is already done; finish the night routine and today joins the
  // streak, as in the app.
  var skin = $("#skin-demo");
  if (skin) {
    var ROUTINES = {
      morning: [
        { name: "Cleanser", done: true },
        { name: "Moisturizer", done: true },
        { name: "Sunscreen", done: true, note: "Daily SPF 50 · 7 days left" }
      ],
      night: [
        { name: "Cleanser", done: true },
        { name: "Face wash after training", done: false, note: "Days you train" },
        { name: "Exfoliant", done: false, note: "Mon, Wed, Fri" },
        { name: "Moisturizer", done: false }
      ]
    };
    var STREAK = 12;
    var time = "night";
    var timeControl = $("#skin-time");
    var stepsList = $("#skin-steps");
    var fill = $("#skin-fill");
    var count = $("#skin-count");
    var statusLine = $("#skin-status");
    var streakBox = $(".skin-streak", skin);
    var streakNumber = $("#skin-streak");
    var burst = $("#skin-burst");
    var week = $("#skin-week");
    var CIRCUMFERENCE = 314.16;

    function complete(list) { return list.every(function (step) { return step.done; }); }
    function dayDone() { return complete(ROUTINES.morning) && complete(ROUTINES.night); }

    // The last seven days, today last: the six before it all finished.
    var today = new Date();
    for (var back = 6; back >= 0; back--) {
      var day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      var cell = document.createElement("span");
      cell.className = back === 0 ? "today" : "done";
      cell.innerHTML = '<i><svg aria-hidden="true"><use href="#i-check"/></svg></i>' +
        day.toLocaleDateString(undefined, { weekday: "narrow" });
      week.appendChild(cell);
    }
    var todayCell = $(".today", week);

    function renderSteps() {
      stepsList.textContent = "";
      ROUTINES[time].forEach(function (step, index) {
        var li = document.createElement("li");
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-pressed", step.done ? "true" : "false");
        button.innerHTML = '<span class="name"><b></b>' + (step.note ? "<small></small>" : "") + "</span>" +
          '<span class="tick"><svg aria-hidden="true"><use href="#i-check"/></svg></span>';
        $("b", button).textContent = step.name;
        if (step.note) $("small", button).textContent = step.note;
        button.addEventListener("click", function () { toggle(index); });
        li.appendChild(button);
        stepsList.appendChild(li);
      });
    }

    function render() {
      var list = ROUTINES[time];
      var done = list.filter(function (step) { return step.done; }).length;
      var left = list.length - done;
      fill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - done / list.length));
      var finished = left === 0;
      count.classList.toggle("done", finished);
      count.textContent = finished ? "\u2713" : done + "/" + list.length;
      var other = time === "night" ? "morning" : "night";
      if (!finished) {
        statusLine.textContent = left + (left === 1 ? " step" : " steps") + " to go " + (time === "night" ? "tonight." : "this morning.");
      } else if (dayDone()) {
        statusLine.textContent = "Both routines done. Today counts toward your streak.";
      } else {
        statusLine.textContent = (time === "night" ? "Night" : "Morning") + " routine done. The " + other + " one is still open.";
      }
      todayCell.classList.toggle("done", dayDone());
      streakNumber.textContent = String(STREAK + (dayDone() ? 1 : 0));
    }

    function toggle(index) {
      var list = ROUTINES[time];
      var wasComplete = complete(list);
      var wasDay = dayDone();
      list[index].done = !list[index].done;
      var button = $all("button", stepsList)[index];
      button.setAttribute("aria-pressed", list[index].done ? "true" : "false");
      render();
      if (!wasComplete && complete(list)) {
        burst.classList.remove("go");
        void burst.offsetWidth;
        burst.classList.add("go");
      }
      if (!wasDay && dayDone()) {
        streakBox.classList.remove("bump");
        void streakBox.offsetWidth;
        streakBox.classList.add("bump");
      }
    }

    function setTime(next) {
      time = next;
      skin.setAttribute("data-time", next);
      $all("[data-time]", timeControl).forEach(function (b) {
        var on = b.getAttribute("data-time") === next;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      placePill(timeControl);
      renderSteps();
      render();
    }

    $all("[data-time]", timeControl).forEach(function (b) {
      b.addEventListener("click", function () { setTime(b.getAttribute("data-time")); });
    });
    placePill(timeControl);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(timeControl); });
    window.addEventListener("resize", function () { placePill(timeControl); });
    renderSteps();
    render();
  }
  // ---------- Hero: a scene you scroll through ----------
  // On big screens the hero holds while you scroll a little: the arcs spin,
  // the main phone comes forward, the others swing away. Elsewhere it just
  // fans out as it scrolls off. --hp is 0 at the top, 1 at the end.
  var hero = $(".hero");
  if (hero) {
    var heroQuery = window.matchMedia("(min-width: 901px) and (min-height: 640px)");
    var heroLayout = function () { hero.classList.toggle("pinned", !reduceMotion && heroQuery.matches); };
    heroLayout();
    if (heroQuery.addEventListener) heroQuery.addEventListener("change", heroLayout);
    scrollFx.push(function () {
      var p = hero.classList.contains("pinned")
        ? clamp01(window.scrollY / Math.max(1, hero.offsetHeight - window.innerHeight))
        : clamp01(window.scrollY / (hero.offsetHeight * 0.85));
      setVar(hero, "--hp", p.toFixed(3));
    });
  }

  // ---------- Pricing: the plans slide in from either side ----------
  var plansRow = $("#plans");
  if (plansRow) {
    scrollFx.push(function () {
      setVar(plansRow, "--pp", progressOf(plansRow, 1, 0.6).toFixed(3));
    });
  }

  // ---------- A day, hour by hour: sideways as you scroll down ----------
  // On big screens the day pins and moves sideways with the scroll, the
  // card in the middle lit; elsewhere it's a strip you swipe.
  var dayScroller = $("#day-scroller");
  if (dayScroller) {
    var dayTrack = $(".day-track", dayScroller);
    var daySticky = $(".day-sticky", dayScroller);
    var dayCards = $all(".day-card", dayScroller);
    var dayQuery = window.matchMedia("(min-width: 901px) and (min-height: 640px)");
    var dayPinned = false;
    var dayLayout = function () {
      dayPinned = !reduceMotion && dayQuery.matches;
      dayScroller.classList.toggle("pinned", dayPinned);
      if (dayPinned) {
        var extra = Math.max(0, dayTrack.scrollWidth - dayTrack.clientWidth);
        dayScroller.style.height = Math.round(daySticky.offsetHeight + extra * 1.1) + "px";
      } else {
        dayScroller.style.height = "";
        dayTrack.style.transform = "";
      }
    };
    dayLayout();
    window.addEventListener("resize", dayLayout);
    if (dayQuery.addEventListener) dayQuery.addEventListener("change", dayLayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dayLayout);
    scrollFx.push(function () {
      if (!dayPinned) return;
      var distance = Math.max(1, dayScroller.offsetHeight - daySticky.offsetHeight);
      var p = clamp01((84 - dayScroller.getBoundingClientRect().top) / distance);
      dayTrack.style.transform = "translateX(" + (-p * Math.max(0, dayTrack.scrollWidth - dayTrack.clientWidth)).toFixed(1) + "px)";
      var now = Math.round(p * (dayCards.length - 1));
      dayCards.forEach(function (card, i) { card.classList.toggle("now", i === now); });
    });
  }

  // ---------- Speed: the strip and headings answer how fast you scroll ----------
  if (lenis) {
    var mq = $(".marquee");
    var mqTrack = $(".marquee-track");
    if (mq && mqTrack) {
      var mqPos = 0, mqLast = 0, mqDir = 1, mqOn = true, mqHover = false;
      var mqTick = function (now) {
        var dt = mqLast ? Math.min(0.05, (now - mqLast) / 1000) : 0;
        mqLast = now;
        var v = lenis.velocity || 0;
        if (Math.abs(v) > 0.5) mqDir = v > 0 ? 1 : -1;
        var speed = mqHover ? 0 : 42 + Math.min(900, Math.abs(v) * 26);
        var half = mqTrack.scrollWidth / 2 + 5;
        mqPos -= speed * mqDir * dt;
        if (mqPos <= -half) mqPos += half;
        if (mqPos > 0) mqPos -= half;
        mqTrack.style.transform = "translate3d(" + mqPos.toFixed(1) + "px, 0, 0)";
        if (mqOn) requestAnimationFrame(mqTick); else mqLast = 0;
      };
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          var was = mqOn;
          mqOn = entries[0].isIntersecting;
          if (mqOn && !was) requestAnimationFrame(mqTick);
        }).observe(mq);
      }
      mq.addEventListener("pointerenter", function () { mqHover = true; });
      mq.addEventListener("pointerleave", function () { mqHover = false; });
      requestAnimationFrame(mqTick);
    }
    // Only the headings on screen lean, skewed directly.
    var leaners = $all(".section-head h2, .h2, .rest-panel h2, .privacy-panel h2");
    var leanSeen = leaners.slice();
    if ("IntersectionObserver" in window) {
      leanSeen = [];
      var leanIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = leanSeen.indexOf(en.target);
          if (en.isIntersecting && i < 0) leanSeen.push(en.target);
          if (!en.isIntersecting && i >= 0) { leanSeen.splice(i, 1); en.target.style.transform = ""; en.target.leanSkew = ""; }
        });
      });
      leaners.forEach(function (h) { leanIO.observe(h); });
    }
    lenis.on("scroll", function () {
      var lean = Math.max(-3, Math.min(3, (lenis.velocity || 0) * 0.08));
      var skew = "skewY(" + (-lean).toFixed(2) + "deg)";
      leanSeen.forEach(function (h) {
        if (h.leanSkew !== skew) { h.leanSkew = skew; h.style.transform = skew; }
      });
    });
  }

  // ---------- Between sections ----------
  var mainEl = $("main");
  var flowSections = $all("main > section.section");
  // 5's giant words are real elements, not ::after, so the scroll can move
  // them without restyling their sections.
  flowSections.forEach(function (sec) {
    if (!sec.hasAttribute("data-word")) return;
    var word = document.createElement("span");
    word.className = "sec-word";
    word.setAttribute("aria-hidden", "true");
    word.textContent = sec.getAttribute("data-word");
    sec.appendChild(word);
  });
  if (mainEl && flowSections.length && !reduceMotion) {
    // 1. The momentum line: down the page edges, crossing sides in the gap
    //    between sections, drawn up to just below the middle of the screen.
    //    Parts that hold in place while you scroll (the tour, the day) are
    //    squeezed out of the drawing, and the line slides down with them
    //    while they hold, so it stays still on screen like they do. It fades
    //    out around the day, which runs edge to edge.
    var flow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    flow.setAttribute("class", "flow");
    flow.setAttribute("aria-hidden", "true");
    flow.innerHTML =
      '<defs><linearGradient id="flow-in" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
      '<linearGradient id="flow-out" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
      '<mask id="flow-mask" maskUnits="userSpaceOnUse"></mask></defs>' +
      '<g mask="url(#flow-mask)"><path class="track"/><path class="trail"/><circle class="ring" r="6"/><circle class="head" r="6"/></g>';
    mainEl.appendChild(flow);
    var track = $(".track", flow), trail = $(".trail", flow), ring = $(".ring", flow), head = $(".head", flow), flowMask = $("mask", flow);
    var flowLen = 0, flowTable = [], flowHeads = [], flowHit = -1, flowOn = false, flowShift = "";
    var closingEl = $(".closing");
    var holdParts = $all(".tour-body, .day-scroller");
    var holds = [];
    // Distance from the top of main, ignoring transforms (sections receding).
    var docTop = function (el) {
      var y = 0;
      while (el && el !== mainEl) { y += el.offsetTop; el = el.offsetParent; }
      return y;
    };
    // A y on the page → the same y on the line, each hold's extra scroll taken out.
    var squeeze = function (y) {
      var s = y;
      holds.forEach(function (h) { s -= Math.min(h.extra, Math.max(0, y - h.end)); });
      return s;
    };
    var buildFlow = function () {
      var W = mainEl.clientWidth;
      flowOn = W >= 1260;
      flow.classList.toggle("on", flowOn);
      if (!flowOn) return;
      holds = [];
      holdParts.forEach(function (part) {
        if (!part.classList.contains("pinned")) return;
        var stick = part.firstElementChild, top = docTop(part);
        holds.push({ part: part, end: top + stick.offsetHeight, extra: Math.max(0, part.offsetHeight - stick.offsetHeight),
          stickTop: parseFloat(getComputedStyle(stick).top) || 0 });
      });
      var H = squeeze(mainEl.offsetHeight);
      flow.setAttribute("width", W); flow.setAttribute("height", H);
      flow.setAttribute("viewBox", "0 0 " + W + " " + H);
      var gutter = Math.max(40, ((W - 1160) / 2 + 20) / 2);
      var xs = [gutter, W - gutter];
      var at = function (el) { return squeeze(docTop(el)); };
      var y0 = at(flowSections[0]) + 40, side = 0;
      var d = "M" + (W / 2) + " " + (y0 - 30) + " C" + (W / 2) + " " + (y0 + 60) + " " + xs[0] + " " + (y0 + 20) + " " + xs[0] + " " + (y0 + 140);
      flowHeads = [];
      flowSections.forEach(function (sec, i) {
        var h = $("h2", sec);
        if (h) flowHeads.push(at(h) + 20);
        if (i === 0) return;
        var gy = at(sec), from = xs[side], to = xs[1 - side];
        d += " L" + from + " " + (gy - 110) + " C" + from + " " + gy + " " + to + " " + gy + " " + to + " " + (gy + 110);
        side = 1 - side;
      });
      var end = closingEl ? at(closingEl) + 160 : H - 200;
      d += " L" + xs[side] + " " + (end - 140) + " C" + xs[side] + " " + end + " " + (W / 2) + " " + (end - 40) + " " + (W / 2) + " " + end;
      track.setAttribute("d", d); trail.setAttribute("d", d);
      flowLen = trail.getTotalLength();
      trail.style.strokeDasharray = flowLen;
      flowTable = [];
      for (var k = 0; k <= 400; k++) { var L = flowLen * k / 400; flowTable.push([L, trail.getPointAtLength(L).y]); }
      // The gap around the day, with soft edges.
      var rect = function (y, h, fill) { return '<rect x="0" y="' + y + '" width="' + W + '" height="' + h + '" fill="' + fill + '"/>'; };
      var hole = "";
      if (dayScroller) {
        var a = at(dayScroller) - 90, b = squeeze(docTop(dayScroller) + dayScroller.firstElementChild.offsetHeight) + 10;
        hole = rect(a - 70, 70, "url(#flow-in)") + rect(a, b - a, "#000") + rect(b, 70, "url(#flow-out)");
      }
      flowMask.setAttribute("x", 0); flowMask.setAttribute("y", 0);
      flowMask.setAttribute("width", W); flowMask.setAttribute("height", H);
      flowMask.innerHTML = rect(0, H, "#fff") + hole;
    };
    var lengthAtY = function (y) {
      var best = 0;
      for (var k = 0; k < flowTable.length; k++) { if (flowTable[k][1] <= y) best = flowTable[k][0]; else if (flowTable[k][1] > y + 300) break; }
      return best;
    };
    buildFlow();
    window.addEventListener("resize", function () { setTimeout(buildFlow, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildFlow);
    window.addEventListener("load", buildFlow);
    if ("ResizeObserver" in window) { var flowRO = null; new ResizeObserver(function () { clearTimeout(flowRO); flowRO = setTimeout(buildFlow, 200); }).observe(mainEl); }
    scrollFx.push(function () {
      if (!flowOn || !flowLen) return;
      var shift = 0;
      holds.forEach(function (h) { shift += Math.min(h.extra, Math.max(0, h.stickTop - h.part.getBoundingClientRect().top)); });
      if (shift.toFixed(1) !== flowShift) {
        flowShift = shift.toFixed(1);
        flow.style.transform = "translate3d(0, " + flowShift + "px, 0)";
      }
      var tipY = window.innerHeight * 0.62 - mainEl.getBoundingClientRect().top - shift;
      var L = lengthAtY(tipY);
      trail.style.strokeDashoffset = (flowLen - L).toFixed(1);
      var pt = trail.getPointAtLength(L);
      head.setAttribute("cx", pt.x.toFixed(1)); head.setAttribute("cy", pt.y.toFixed(1));
      ring.setAttribute("cx", pt.x.toFixed(1)); ring.setAttribute("cy", pt.y.toFixed(1));
      head.style.opacity = L > 4 ? "1" : "0";
      var hit = -1;
      flowHeads.forEach(function (y, i) { if (tipY >= y) hit = i; });
      if (hit > flowHit) { ring.classList.remove("pulse"); void ring.getBoundingClientRect(); ring.classList.add("pulse"); }
      flowHit = hit;
    });

    // 2–5, per section.
    var bigScreen = window.matchMedia("(min-width: 901px)");
    var banded = { reminders: 1, skincare: 1, privacy: 1, faq: 1 };
    var night = { rest: 1, privacy: 1 };
    flowSections.forEach(function (sec) {
      var wrap = $(":scope > .wrap", sec);
      var word = $(":scope > .sec-word", sec);
      var receding = false;
      scrollFx.push(function () {
        var r = sec.getBoundingClientRect(), vh = window.innerHeight;
        if (r.bottom < -vh || r.top > vh * 2) return;
        if (night[sec.id]) {
          var nIn = clamp01((vh * 0.9 - r.top) / (vh * 0.45)), nOut = clamp01((r.bottom - vh * 0.1) / (vh * 0.45));
          setVar(sec, "--night", Math.min(nIn, nOut).toFixed(2));
        }
        if (banded[sec.id]) setVar(sec, "--arc", (1 - progressOf(sec, 1, 0.55)).toFixed(3));
        if (word) {
          var t = clamp01((vh - r.top) / (vh + Math.min(r.height, vh)));
          var slide = "translate3d(calc(-50% + " + ((0.5 - t) * window.innerWidth * 0.55).toFixed(1) + "px), 0, 0)";
          if (word.slide !== slide) { word.slide = slide; word.style.transform = slide; }
        }
        if (wrap) {
          var e = bigScreen.matches ? clamp01((vh * 0.35 - r.bottom) / (vh * 0.35)) : 0;
          if (e > 0) {
            // Its own layer while it moves, so the text isn't redrawn each frame.
            if (!receding) wrap.style.willChange = "transform, opacity";
            wrap.style.transform = "translateY(" + (e * -24).toFixed(1) + "px) scale(" + (1 - e * 0.06).toFixed(4) + ")";
            wrap.style.opacity = (1 - e * 0.65).toFixed(3);
            receding = true;
          } else if (receding) {
            wrap.style.transform = ""; wrap.style.opacity = ""; wrap.style.willChange = "";
            receding = false;
          }
        }
      });
    });
  }

  // ---------- Run the scroll motion ----------
  // With Lenis it runs on Lenis's own frames, in step with the glide.
  if (!reduceMotion && scrollFx.length) {
    var fxQueued = false;
    var runFx = function () {
      fxQueued = false;
      scrollFx.forEach(function (fn) { fn(); });
    };
    var queueFx = function () {
      if (!fxQueued) { fxQueued = true; requestAnimationFrame(runFx); }
    };
    if (lenis) lenis.on("scroll", runFx);
    else window.addEventListener("scroll", queueFx, { passive: true });
    window.addEventListener("resize", queueFx);
    runFx();
  }
})();
