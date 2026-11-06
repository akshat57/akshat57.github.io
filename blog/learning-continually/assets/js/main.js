/* Learning Continually from Inference Compute: page behaviour.
   Math rendering (KaTeX), hover cards for citations / equations / figures, figure lightbox,
   section highlighting + reading progress, and opening appendix sections on navigation. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ---------- math ---------- */
  function renderMath() {
    if (window.katex) {
      $$('script[type="math/tex; mode=display"]').forEach(function (s) {
        var div = document.createElement("div");
        try {
          window.katex.render(s.textContent, div, { displayMode: true, throwOnError: false, strict: "ignore" });
        } catch (e) {
          div.textContent = s.textContent;
        }
        s.parentNode.replaceChild(div, s);
      });
    }
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [{ left: "\\(", right: "\\)", display: false }],
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
        throwOnError: false,
        strict: "ignore"
      });
    }
  }

  /* ---------- hover cards ---------- */
  var pop = $("#pop");
  var showT = null, hideT = null, popAnchor = null;

  function cardFor(a) {
    if (a.classList.contains("cite")) {
      var r = (window.REFS || {})[a.getAttribute("data-key")];
      if (!r) return null;
      return {
        cls: "cite-pop",
        html: '<div class="pop-au">' + esc(r.au) + " (" + esc(r.yr) + ')</div><div class="pop-ti">' + esc(r.ti) + "</div>" +
          (r.ve ? '<div class="pop-ve">' + esc(r.ve) + "</div>" : "")
      };
    }
    var id = (a.getAttribute("href") || "").slice(1);
    var t = id && document.getElementById(id);
    if (!t) return null;
    if (a.classList.contains("eqref")) {
      var body = $(".eq-body", t), num = $(".eq-num", t);
      return { cls: "eq-pop", html: '<div class="pop-eq">' + (body ? body.innerHTML : "") + '</div><div class="pop-num">Equation ' + (num ? esc(num.textContent) : "") + "</div>" };
    }
    if (a.classList.contains("figref")) {
      var img = $("img", t), cap = $("figcaption", t);
      return { cls: "fig-pop", html: (img ? '<img src="' + esc(img.getAttribute("src")) + '" alt="">' : "") + '<div class="pop-cap">' + (cap ? cap.innerHTML : "") + "</div>" };
    }
    return null;
  }

  function place(a) {
    var r = a.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = r.left + window.scrollX + r.width / 2 - pw / 2;
    left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + vw - pw - 12));
    var top = r.bottom + window.scrollY + 8;
    if (r.bottom + ph + 16 > window.innerHeight && r.top - ph - 8 > 60) top = r.top + window.scrollY - ph - 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function show(a) {
    var c = cardFor(a);
    if (!c) return;
    pop.className = "pop " + c.cls;
    pop.innerHTML = c.html;
    pop.hidden = false;
    popAnchor = a;
    place(a);
  }
  function hide() { pop.hidden = true; popAnchor = null; }
  function isTrigger(el) { return el && el.closest && el.closest("a.cite, a.eqref, a.figref"); }
  var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;

  if (pop && canHover) {
    document.addEventListener("mouseover", function (e) {
      var a = isTrigger(e.target);
      if (a) {
        clearTimeout(hideT);
        if (a !== popAnchor) { clearTimeout(showT); showT = setTimeout(function () { show(a); }, 140); }
      } else if (e.target.closest && e.target.closest("#pop")) {
        clearTimeout(hideT);
      }
    });
    document.addEventListener("mouseout", function (e) {
      if (isTrigger(e.target) || (e.target.closest && e.target.closest("#pop"))) {
        clearTimeout(showT);
        hideT = setTimeout(hide, 180);
      }
    });
  }
  if (pop) {
    document.addEventListener("focusin", function (e) { var a = isTrigger(e.target); if (a) show(a); });
    document.addEventListener("focusout", function (e) { if (isTrigger(e.target)) hide(); });
    window.addEventListener("scroll", function () { if (!pop.hidden && popAnchor) place(popAnchor); }, { passive: true });
  }

  /* ---------- lightbox ---------- */
  var lb = $("#lightbox");
  var lastFocus = null;
  function openLb(panel) {
    var img = $("img", panel), fig = panel.closest("figure");
    if (!img || !lb) return;
    var lbImg = $("img", lb), lbCap = $("figcaption", lb);
    lbImg.src = img.getAttribute("src");
    lbImg.alt = img.alt;
    var sub = $(".sub", panel), row = null, cap = fig ? $("figcaption", fig) : null;
    if (!sub && panel.parentNode) {  // rows layout: the nearest preceding row label
      var p = panel.previousElementSibling;
      while (p && !p.classList.contains("rowlabel")) p = p.previousElementSibling;
      row = p;
    }
    lbCap.innerHTML = (sub ? "<strong>" + sub.innerHTML + "</strong> " : row ? "<strong>" + row.innerHTML + "</strong> " : "") + (cap ? cap.innerHTML : "");
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.classList.add("lb-open");
    $(".lb-close", lb).focus();
  }
  function closeLb() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.body.classList.remove("lb-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$(".panel").forEach(function (p) {
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    var img = $("img", p);
    p.setAttribute("aria-label", "Enlarge: " + (img ? img.alt : "figure"));
  });
  document.addEventListener("click", function (e) {
    var panel = e.target.closest && e.target.closest(".panel");
    if (panel && !e.target.closest("a")) openLb(panel);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeLb(); hide(); }
    if ((e.key === "Enter" || e.key === " ") && document.activeElement && document.activeElement.classList.contains("panel")) {
      e.preventDefault();
      openLb(document.activeElement);
    }
  });
  if (lb) lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest(".lb-close")) closeLb(); });

  /* ---------- running contents on the left, built from the post's own headings ---------- */
  var side = [];          /* { a, target, top } for every entry, in document order */
  var sideNav = $("#sidetoc-nav");
  function slug(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); }
  function sideLink(target, labelEl, topLi) {
    var a = document.createElement("a");
    a.href = "#" + target.id;
    var num = labelEl.querySelector ? labelEl.querySelector(".secnum") : null;
    var text = labelEl.textContent || "";
    if (num) text = text.replace(num.textContent, "");
    text = text.replace(/[.:]\s*$/, "").trim();
    a.innerHTML = (num ? '<span class="n">' + esc(num.textContent) + "</span>" : "") + '<span class="t">' + esc(text) + "</span>";
    side.push({ a: a, target: target, top: topLi });
    return a;
  }
  function buildSideToc() {
    if (!sideNav) return;
    var root = document.createElement("ol"), appx = false;
    $$(".article > .sec").forEach(function (sec) {
      var h2 = $("h2", sec);
      if (!h2 || !sec.id) return;
      if (sec.classList.contains("appx") && !appx) {
        appx = true;
        var sep = document.createElement("li");
        sep.className = "sidetoc-sep";
        sep.textContent = "Appendix";
        root.appendChild(sep);
      }
      var li = document.createElement("li");
      li.appendChild(sideLink(sec, h2, li));
      var kids = [];
      $$("h3[id], p > .runin, details.appx-sub", sec).forEach(function (el) {
        if (el.tagName === "DETAILS") { kids.push([el, $("summary h3", el) || el]); return; }
        if (el.tagName === "H3") { kids.push([el, el]); return; }
        var para = el.parentNode;  /* a run-in paragraph heading */
        if (para.closest("details")) return;
        if (!para.id) {
          var id = "p-" + slug(el.textContent), k = 2;
          while (document.getElementById(id)) id = "p-" + slug(el.textContent) + "-" + k++;
          para.id = id;
        }
        kids.push([para, el]);
      });
      if (kids.length) {
        var ol = document.createElement("ol");
        kids.forEach(function (kd) { var c = document.createElement("li"); c.appendChild(sideLink(kd[0], kd[1], li)); ol.appendChild(c); });
        li.appendChild(ol);
      }
      root.appendChild(li);
    });
    sideNav.appendChild(root);
  }
  function updateSide(line) {
    if (!side.length) return;
    var cur = null;
    side.forEach(function (it) { if (it.target.getBoundingClientRect().top + window.scrollY <= line) cur = it; });
    side.forEach(function (it) {
      it.a.classList.toggle("is-active", it === cur);
      if (it.top) it.top.classList.toggle("is-open", !!cur && it.top === cur.top);
    });
    var box = sideNav.closest(".sidetoc");
    if (cur && box && box.offsetParent !== null) {  /* keep the active entry in view inside the sidebar */
      var y = cur.a.offsetTop - box.offsetTop, h = box.clientHeight;
      if (y < box.scrollTop + 40) box.scrollTop = Math.max(0, y - 40);
      else if (y > box.scrollTop + h - 60) box.scrollTop = y - h + 60;
    }
  }

  /* ---------- contents: highlight + progress + mobile menu ---------- */
  var links = $$(".toc a");
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("data-sec")); });
  var bar = $(".progress span");
  var ticking = false;
  function onScroll() {
    ticking = false;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0) + "%";
    var line = window.scrollY + 140, cur = null;
    targets.forEach(function (t) { if (t && t.getBoundingClientRect().top + window.scrollY <= line) cur = t.id; });
    links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-sec") === cur); });
    updateSide(line);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener("resize", onScroll);

  var toggle = $(".toc-toggle"), toc = $("#toc");
  if (toggle && toc) {
    toggle.addEventListener("click", function () {
      var open = toc.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    toc.addEventListener("click", function (e) {
      if (e.target.closest("a")) { toc.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".topbar") && toc.classList.contains("is-open")) { toc.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- open collapsed appendix sections when something inside them is targeted ---------- */
  function openFor(id) {
    var t = id && document.getElementById(id);
    if (!t) return;
    var d = t.closest ? t.closest("details") : null;
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest("details") : null; }
    if (t.tagName === "DETAILS") t.open = true;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) openFor(a.getAttribute("href").slice(1));
  });
  window.addEventListener("hashchange", function () { openFor(location.hash.slice(1)); });

  function init() {
    renderMath();
    buildSideToc();
    if (location.hash) {
      openFor(location.hash.slice(1));
      var t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(function () { t.scrollIntoView(); }, 0);
    }
    onScroll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
