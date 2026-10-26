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
    if (!open && panel.contains(document.activeElement)) pill.focus({ preventScroll: true });
    sizeIsland();
  }

  if (isl && pill && panel) {
    panel.inert = true;
    // A click from the keyboard (Enter or Space) moves focus into the menu.
    pill.addEventListener("click", function (e) {
      setIsland(true);
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
  var tour = $("#tour");
  if (tour) {
    var tabs = $all('[role="tab"]', tour);
    var control = $(".segmented", tour);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      var name = tab.getAttribute("data-tab");
      $all(".stack .shot", tour).forEach(function (shot) {
        shot.classList.toggle("on", shot.getAttribute("data-tab") === name);
      });
      placePill(control);
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
    window.addEventListener("resize", function () { placePill(control); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(control); });
    placePill(control);
  }

  // ---------- Lock Screen: a day of smart reminders ----------
  var lock = $("#lock-demo");
  if (lock) {
    var days = [
      { date: "Monday, October 19", notes: [
        { time: "9:00", label: "9:00 AM", title: "No breakfast logged yet", body: "Your usual: oats, banana and whey (520 kcal). Log it in one tap, or add something else.", actions: ["Log my usual", "Something else"] },
        { time: "5:30", label: "5:30 PM", title: "Upper day today", body: "7 exercises, about 55 min. Last time: Bench Press 80 kg × 8.", actions: ["Start workout"] },
        { time: "7:15", label: "7:15 PM", title: "62 g protein to go today", body: "Ideas from what you eat: paneer bhurji (25 g) or Greek yogurt (20 g).", actions: ["Log food"] }
      ] },
      { date: "Tuesday, October 20", notes: [
        { time: "9:00", label: "9:00 AM", title: "Yesterday's Upper got skipped", body: "Today's a rest day, so there's room to fit it in. Or pick up with the next one.", actions: ["Start workout"] },
        { time: "3:00", label: "3:00 PM", title: "Water check", body: "1.2 of 3 L so far today. A glass now keeps you on pace.", actions: ["+1 glass"] },
        { time: "8:30", label: "8:30 PM", title: "Your 14-day streak ends tonight", body: "Log anything before 3:00 AM to keep it going.", actions: [] }
      ] }
    ];
    var list = $(".notes", lock);
    var clock = $(".lock-time", lock);
    var date = $(".lock-date", lock);
    var dayIndex = 0;
    var noteIndex = -1;
    var timer = null;

    function makeNote(note, isNew) {
      var li = document.createElement("li");
      li.className = "note" + (isNew ? " enter" : "");
      li.innerHTML =
        '<img src="images/icon-64.png" alt="" width="34" height="34">' +
        '<div><div class="note-head"><b>REPETITE</b><span></span></div><strong></strong><p></p></div>';
      $(".note-head span", li).textContent = isNew ? "now" : note.label;
      $("strong", li).textContent = note.title;
      $("p", li).textContent = note.body;
      if (isNew && note.actions.length) {
        var actions = document.createElement("div");
        actions.className = "note-actions";
        note.actions.forEach(function (label) {
          var span = document.createElement("span");
          span.textContent = label;
          actions.appendChild(span);
        });
        li.appendChild(actions);
      }
      return li;
    }
    function step() {
      noteIndex += 1;
      if (noteIndex >= days[dayIndex].notes.length) {
        // A new day: the stack clears, at most three again.
        dayIndex = (dayIndex + 1) % days.length;
        noteIndex = 0;
        list.innerHTML = "";
        date.textContent = days[dayIndex].date;
      }
      var note = days[dayIndex].notes[noteIndex];
      clock.classList.add("tick");
      setTimeout(function () {
        clock.textContent = note.time;
        clock.classList.remove("tick");
        // Older notes lose their buttons and show their time.
        $all(".note", list).forEach(function (old, i) {
          var previous = days[dayIndex].notes[noteIndex - 1 - i];
          var actions = $(".note-actions", old);
          if (actions) actions.remove();
          if (previous) $(".note-head span", old).textContent = previous.label;
          old.classList.remove("enter");
        });
        list.insertBefore(makeNote(note, true), list.firstChild);
      }, 260);
    }
    function play() {
      if (timer) return;
      step();
      timer = setInterval(step, 3400);
    }
    function pause() { clearInterval(timer); timer = null; }

    if (!reduceMotion && "IntersectionObserver" in window) {
      list.innerHTML = "";
      clock.textContent = "8:41";
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) play(); else pause(); });
      }, { threshold: 0.35 }).observe(lock);
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
    startButton.addEventListener("click", function () { start(20); });
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
})();
