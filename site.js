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
    var dark = effectiveTheme() === "dark";
    if (toggle) {
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
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
      // The new theme spreads out in a circle from the switch.
      var box = toggle.getBoundingClientRect();
      var x = box.left + box.width / 2;
      var y = box.top + box.height / 2;
      var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var applied = false;
      function apply() { if (!applied) { applied = true; applyTheme(next); } }
      // If the browser can't run the animation, the theme still changes.
      setTimeout(apply, 400);
      var transition = document.startViewTransition(apply);
      transition.ready.then(function () {
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
          { duration: 700, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(function () {});
    });
  }
  if (systemDark.addEventListener) systemDark.addEventListener("change", syncToggle);
  syncToggle();

  // ---------- Navbar: shrinks on scroll, a capsule follows the section ----------
  var shell = $(".nav-shell");
  var links = $all(".nav-links a");
  var indicator = $(".nav-indicator");
  function onScroll() {
    if (shell) shell.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var activeLink = null;
  function placeIndicator() {
    if (!indicator) return;
    if (!activeLink || activeLink.offsetParent === null) { indicator.style.opacity = "0"; return; }
    indicator.style.left = activeLink.offsetLeft + "px";
    indicator.style.width = activeLink.offsetWidth + "px";
    indicator.style.opacity = "1";
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

  // ---------- Reveal on scroll ----------
  var reveals = $all(".reveal");
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
})();
