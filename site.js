// Repetite's website: the theme switch, the floating navbar, and the live
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

  // ---------- Navbar: shrinks on scroll, a capsule follows the section ----------
  var shell = $(".nav-shell");
  var links = $all(".nav-links a");
  var indicator = $(".nav-indicator");
  var glassNav = $(".glass-nav");
  var toTop = $(".to-top");
  var scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    var y = window.scrollY;
    if (shell) shell.classList.toggle("scrolled", y > 24);
    if (toTop) toTop.classList.toggle("show", y > window.innerHeight * 1.2);
    if (glassNav) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      glassNav.style.setProperty("--progress", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
    }
  }
  window.addEventListener("scroll", function () {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // The light on the glass follows the pointer.
  if (glassNav && !reduceMotion) {
    glassNav.addEventListener("pointermove", function (e) {
      var box = glassNav.getBoundingClientRect();
      glassNav.style.setProperty("--mx", (e.clientX - box.left) + "px");
      glassNav.style.setProperty("--my", (e.clientY - box.top) + "px");
    });
  }

  // The capsule moves like a drop of liquid: it stretches across to the
  // new link, then settles. It previews the link you point at, and goes
  // back to the section you're reading when you leave.
  var activeLink = null;
  var shownLink = null;
  function moveIndicatorTo(link) {
    if (!indicator) return;
    if (!link || link.offsetParent === null) {
      indicator.style.opacity = "0";
      shownLink = null;
      return;
    }
    var toLeft = link.offsetLeft;
    var toWidth = link.offsetWidth;
    var wasHidden = indicator.style.opacity !== "1" || !shownLink;
    var fromLeft = indicator.offsetLeft;
    var fromWidth = indicator.offsetWidth;
    indicator.style.left = toLeft + "px";
    indicator.style.width = toWidth + "px";
    indicator.style.opacity = "1";
    if (!wasHidden && link !== shownLink && !reduceMotion && indicator.animate) {
      var spanLeft = Math.min(fromLeft, toLeft);
      var spanWidth = Math.max(fromLeft + fromWidth, toLeft + toWidth) - spanLeft;
      indicator.animate([
        { left: fromLeft + "px", width: fromWidth + "px", transform: "scaleY(1)" },
        { left: spanLeft + "px", width: spanWidth + "px", transform: "scaleY(0.82)", offset: 0.42 },
        { left: toLeft + "px", width: toWidth + "px", transform: "scaleY(1.06)", offset: 0.78 },
        { left: toLeft + "px", width: toWidth + "px", transform: "scaleY(1)" }
      ], { duration: 560, easing: "cubic-bezier(.3, .9, .4, 1)" });
    }
    shownLink = link;
  }
  function placeIndicator() { moveIndicatorTo(activeLink); }
  var linksBox = $(".nav-links");
  if (linksBox) {
    links.forEach(function (link) {
      link.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") moveIndicatorTo(link); });
    });
    linksBox.addEventListener("pointerleave", function () { moveIndicatorTo(activeLink); });
  }
  function setActive(id) {
    activeLink = null;
    links.forEach(function (link) {
      var on = link.getAttribute("href") === "#" + id;
      link.classList.toggle("active", on);
      if (on) { activeLink = link; link.setAttribute("aria-current", "true"); } else { link.removeAttribute("aria-current"); }
    });
    placeIndicator();
  }
  var spied = links.map(function (link) {
    var href = link.getAttribute("href");
    return href && href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
  }).filter(Boolean);
  if (spied.length && "IntersectionObserver" in window) {
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      var current = null;
      spied.forEach(function (section) { if (visible[section.id]) current = section.id; });
      setActive(current);
    }, { rootMargin: "-40% 0px -55% 0px" });
    spied.forEach(function (section) { spy.observe(section); });
  }
  window.addEventListener("resize", placeIndicator);

  var menuButton = $(".menu-btn");
  var menu = $("#nav-menu");
  function closeMenu() {
    if (!menu || !menuButton) return;
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  }
  if (menuButton && menu) {
    menuButton.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $all("a", menu).forEach(function (a) { a.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    window.addEventListener("resize", function () { if (innerWidth > 1080) closeMenu(); });
  }

  // ---------- Headings rise in word by word ----------
  // Only plain-text headings; each word keeps its space for screen readers.
  if (!reduceMotion) {
    $all(".section-head h2, .coach-grid .h2, .plates-grid .h2, .rest-panel h2, .privacy-panel h2, .closing h2").forEach(function (heading) {
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(control); placeIndicator(); });
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
      // At most three a day; the most useful win.
      var kept = pending.slice().sort(function (a, b) { return b.priority - a.priority; }).slice(0, 3);
      var keptIds = kept.map(function (item) { return item.id; });
      $all("li[data-id]", tryit).forEach(function (li) {
        li.classList.toggle("gone", keptIds.indexOf(li.getAttribute("data-id")) === -1);
      });
      var held = pending.filter(function (item) { return keptIds.indexOf(item.id) === -1; });
      foot.textContent = held.length ? names[held[0].id] + " is held back: never more than 3 a day." : "";
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

  // ---------- Gallery arrows ----------
  var gallery = $(".gallery");
  if (gallery) {
    var back = $("#gallery-back");
    var next = $("#gallery-next");
    function update() {
      back.disabled = gallery.scrollLeft < 8;
      next.disabled = gallery.scrollLeft + gallery.clientWidth > gallery.scrollWidth - 8;
    }
    function scrollBy(direction) {
      gallery.scrollBy({ left: direction * gallery.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
    }
    back.addEventListener("click", function () { scrollBy(-1); });
    next.addEventListener("click", function () { scrollBy(1); });
    gallery.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }
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
    $all(".btn, .nav-cta, .round-btn").forEach(function (button) {
      button.addEventListener("pointermove", function (e) {
        var box = button.getBoundingClientRect();
        var dx = (e.clientX - (box.left + box.width / 2)) / box.width;
        var dy = (e.clientY - (box.top + box.height / 2)) / box.height;
        button.style.translate = (dx * 8).toFixed(1) + "px " + (dy * 6).toFixed(1) + "px";
      });
      button.addEventListener("pointerleave", function () { button.style.translate = ""; });
    });
  }

  // ---------- Gallery: drag with the mouse ----------
  if (gallery && window.matchMedia("(pointer: fine)").matches) {
    var drag = null;
    gallery.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: gallery.scrollLeft, moved: false, id: e.pointerId };
    });
    gallery.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) {
        drag.moved = true;
        gallery.classList.add("dragging");
        try { gallery.setPointerCapture(drag.id); } catch (err) {}
      }
      if (drag.moved) gallery.scrollLeft = drag.left - dx;
    });
    function endDrag() {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      if (moved) gallery.classList.remove("dragging");
    }
    gallery.addEventListener("pointerup", endDrag);
    gallery.addEventListener("pointercancel", endDrag);
    gallery.addEventListener("dragstart", function (e) { e.preventDefault(); });
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
})();
