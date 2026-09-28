(function () {
  "use strict";

  var WEEKS = window.COURSE_WEEKS || [];
  var STORAGE_PROGRESS = "sd-course-progress-v1";
  var STORAGE_LAST = "sd-course-last-v1";

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  function loadProgress() {
    var raw = safeGet(STORAGE_PROGRESS);
    if (!raw) return {};
    try {
      var arr = JSON.parse(raw);
      var map = {};
      arr.forEach(function (n) { map[n] = true; });
      return map;
    } catch (e) { return {}; }
  }
  function saveProgress(map) {
    var arr = Object.keys(map).filter(function (k) { return map[k]; }).map(Number);
    safeSet(STORAGE_PROGRESS, JSON.stringify(arr));
  }

  var progress = loadProgress();
  var lastWeek = parseInt(safeGet(STORAGE_LAST), 10);
  var current = WEEKS.some(function (w) { return w.num === lastWeek; }) ? lastWeek : 1;

  var sidebarEl = document.getElementById("sidebar");
  var weekListEl = document.getElementById("weekList");
  var tabbarEl = document.getElementById("tabbar");
  var contentEl = document.getElementById("content");
  var progressFillEl = document.getElementById("progressFill");
  var topProgressEl = document.getElementById("topProgress");
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");
  var completeBtn = document.getElementById("completeBtn");
  var menuBtn = document.getElementById("menuBtn");
  var overlayEl = document.getElementById("overlay");

  function checkSvg() {
    return '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.2L4 7.7L8.5 2.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function renderSidebar() {
    weekListEl.innerHTML = "";
    WEEKS.forEach(function (w) {
      var li = document.createElement("li");
      li.className = "week-item" + (w.num === current ? " active" : "");
      li.setAttribute("data-week", w.num);

      var check = document.createElement("div");
      check.className = "week-check" + (progress[w.num] ? " done" : "");
      check.innerHTML = checkSvg();
      check.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleComplete(w.num);
      });

      var meta = document.createElement("div");
      meta.className = "week-meta";
      meta.innerHTML =
        '<div class="week-num">WEEK ' + String(w.num).padStart(2, "0") + " · " + w.readMin + " min</div>" +
        '<div class="week-title">' + escapeHtml(w.title) + "</div>" +
        '<div class="week-sub">' + escapeHtml(w.subtitle) + "</div>" +
        '<span class="week-tag">' + escapeHtml(w.tag) + "</span>";

      li.appendChild(check);
      li.appendChild(meta);
      li.addEventListener("click", function () {
        selectWeek(w.num);
        closeSidebarOnMobile();
      });
      weekListEl.appendChild(li);
    });
  }

  function renderTabbar() {
    tabbarEl.innerHTML = "";
    WEEKS.forEach(function (w) {
      var tab = document.createElement("div");
      tab.className = "tab" + (w.num === current ? " current" : "");
      tab.textContent = "wk" + String(w.num).padStart(2, "0") + ".md";
      tab.addEventListener("click", function () { selectWeek(w.num); });
      tabbarEl.appendChild(tab);
    });
    var activeTab = tabbarEl.querySelector(".tab.current");
    if (activeTab && activeTab.scrollIntoView) {
      activeTab.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : s;
    return d.innerHTML;
  }

  function renderContent() {
    var w = WEEKS.find(function (x) { return x.num === current; });
    if (!w) return;
    contentEl.innerHTML =
      '<div class="content-inner">' +
      '<span class="content-kicker">' + escapeHtml(w.tag) + " · Week " + w.num + " of " + WEEKS.length + "</span>" +
      '<h1 class="content-h1">' + escapeHtml(w.title) + "</h1>" +
      '<p class="content-sub">' + escapeHtml(w.subtitle) + " · ~" + w.readMin + " min read</p>" +
      w.html +
      "</div>";
    enhanceVocab(contentEl);
    contentEl.scrollTop = 0;
    updateCompleteButton();
    updatePagerButtons();
  }

  function enhanceVocab(root) {
    var nodes = Array.prototype.slice.call(root.querySelectorAll("h2, p"));
    nodes.forEach(function (el) {
      if (el.dataset && el.dataset.vocabDone) return;
      var txt = el.textContent || "";
      if (!/Vocabulary you must be able to say out loud/i.test(txt)) return;

      if (el.tagName === "H2") {
        el.classList.add("vocab-heading");
        var sib = el.nextElementSibling;
        if (sib && sib.tagName === "P") {
          var terms1 = splitTerms(sib.textContent.trim());
          insertChips(el, terms1);
          sib.remove();
        }
        el.dataset.vocabDone = "1";
        return;
      }

      el.classList.add("vocab-heading");
      var next = el.nextElementSibling;
      if (next && (next.tagName === "UL" || next.tagName === "OL")) {
        var terms2 = Array.prototype.slice.call(next.querySelectorAll("li")).map(function (li) {
          return li.textContent.trim();
        });
        el.textContent = "Vocabulary you must be able to say out loud";
        insertChips(el, terms2);
        next.remove();
        el.dataset.vocabDone = "1";
        return;
      }

      var full = el.textContent.replace(/Vocabulary you must be able to say out loud:?/i, "").trim();
      el.textContent = "Vocabulary you must be able to say out loud";
      var terms3 = splitTerms(full);
      insertChips(el, terms3);
      el.dataset.vocabDone = "1";
    });
  }

  function splitTerms(text) {
    text = text.replace(/\.$/, "").trim();
    if (!text) return [];
    var parts = text.indexOf(" · ") !== -1 ? text.split(" · ") : text.split(/,\s*/);
    return parts.map(function (s) { return s.replace(/\.$/, "").trim(); }).filter(Boolean);
  }

  function insertChips(afterEl, terms) {
    if (!terms.length) return;
    var wrap = document.createElement("div");
    wrap.className = "vocab-chips";
    terms.forEach(function (t) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = t;
      wrap.appendChild(chip);
    });
    afterEl.insertAdjacentElement("afterend", wrap);
  }

  function updateProgressUI() {
    var done = Object.keys(progress).filter(function (k) { return progress[k]; }).length;
    var pct = Math.round((done / WEEKS.length) * 100);
    progressFillEl.style.width = pct + "%";
    topProgressEl.textContent = done + " / " + WEEKS.length;
  }

  function updateCompleteButton() {
    var isDone = !!progress[current];
    completeBtn.textContent = isDone ? "✓ Week complete" : "Mark week complete";
    completeBtn.classList.toggle("done", isDone);
  }

  function updatePagerButtons() {
    var idx = WEEKS.findIndex(function (w) { return w.num === current; });
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx >= WEEKS.length - 1;
  }

  function toggleComplete(num) {
    progress[num] = !progress[num];
    if (!progress[num]) delete progress[num];
    saveProgress(progress);
    renderSidebar();
    updateProgressUI();
    if (num === current) updateCompleteButton();
  }

  function selectWeek(num) {
    current = num;
    safeSet(STORAGE_LAST, String(num));
    renderSidebar();
    renderTabbar();
    renderContent();
  }

  function openSidebar() { document.body.classList.add("sidebar-open"); }
  function closeSidebar() { document.body.classList.remove("sidebar-open"); }
  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 860px)").matches) closeSidebar();
  }

  menuBtn.addEventListener("click", function () {
    document.body.classList.toggle("sidebar-open");
  });
  overlayEl.addEventListener("click", closeSidebar);

  prevBtn.addEventListener("click", function () {
    var idx = WEEKS.findIndex(function (w) { return w.num === current; });
    if (idx > 0) selectWeek(WEEKS[idx - 1].num);
  });
  nextBtn.addEventListener("click", function () {
    var idx = WEEKS.findIndex(function (w) { return w.num === current; });
    if (idx < WEEKS.length - 1) selectWeek(WEEKS[idx + 1].num);
  });
  completeBtn.addEventListener("click", function () { toggleComplete(current); });

  // initial render
  renderSidebar();
  renderTabbar();
  renderContent();
  updateProgressUI();

  // register service worker for offline / installable use
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* ignore */ });
    });
  }
})();
