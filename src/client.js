/*
 * @almazom/dsh-needs-attention — client half (lazy ModuleLoader factory,
 * boot-graph contract per dsh-client-inject-plugin / dsh-message-fullscreen).
 *
 * Zero-core-edit seams:
 *   - anchor: the sidebar's FIRST section header ([class*="_sectionLabel"] lifted to
 *     its [class*="_sectionHeader"]). Its text is "Workspaces" / "工作区" in the
 *     grouped view and "Sessions" / "会话" in the flat view — both are matched, with
 *     a structural fallback for future renames. With no section header at all the
 *     block does NOT attach anywhere else — a wrong slot is worse than a missing
 *     block (product review P3).
 *   - block inserted BEFORE that header = FIRST section under nav.
 *   - rows clone the production row anatomy (h30 r12 pad 0 8px; ttl 14/20;
 *     time 10/16) per SPIKE.md measurements; theme via --dna-* vars.
 * Data: GET /api/dsh-needs-attention/sessions (same-origin cookie auth), poll 30s.
 * Design SSOT: ~/projects/dsh/proto/error-sessions/index.html (variant A, approved).
 *
 * Review round 3 (product + reliability + security):
 *   - amber TEXT uses --dna-warn-text (light #8a5300 = 4.9:1 on white, the old
 *     #dd8629 was 2.79:1 and failed AA); --dna-warn stays a FILL color.
 *   - dismissal key is `id@at` (error timestamp), pruned to the current error set,
 *     so a session that errors again later is visible again.
 *   - the group scrolls (max-height 196px ≈ 6 rows) and collapses the tail into a
 *     "+N more" row — it can never push Workspaces off-screen.
 *   - error text is exposed to assistive tech (aria-label + title), not only a tooltip.
 *   - head/rows are keyboard reachable (tabindex + Enter/Space), dismiss is visible
 *     on focus instead of display:none.
 *   - the deep-link fallback validates the session id before writing it to the
 *     core-owned dsh.sessions.current key (same-origin poisoning, security P2).
 */
if (typeof window !== "undefined" && window.__ModuleLoader__) window.__ModuleLoader__.load({
  id: "@almazom/dsh-needs-attention",
  factory: function () {
    "use strict";
    if (window.__DSH_NA__) return { name: "@almazom/dsh-needs-attention", apply: function () {} };
    window.__DSH_NA__ = true;

    /** Mount-aware route (2026-10-31 operator report, measured): the panel serves
     *  under a path prefix (dsh-abu.ru/stable/duty) and the page carries
     *  `<base href="./">`, so a hardcoded "/api/..." leaves the mount, hits the
     *  edge root and comes back with an EMPTY body — "Unexpected end of JSON
     *  input", zero rows, block auto-hidden. Resolve against document.baseURI the
     *  same way the boot HTML writes "plugins/??...". */
    var ROUTE_REL = "api/dsh-needs-attention/sessions";
    function routeUrl() {
      try { return new URL(ROUTE_REL, document.baseURI).href; } catch (e) { return "/" + ROUTE_REL; }
    }
    var LS_DISMISSED = "dsh-needs-attention.dismissed";
    var LS_COLLAPSED = "dsh-needs-attention.collapsed";
    var LS_EXPANDED = "dsh-needs-attention.expanded";
    var VISIBLE_ROWS = 6;
    var SESSION_ID_RE = /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    var ERR_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.7v4.4"/><path d="M8 11.15v.05"/></svg>';
    var WARN_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2.1"/><path d="M8 4.7v4.4"/><path d="M8 11.15v.05"/></svg>';
    var X_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4.6 4.6l6.8 6.8"/><path d="M11.4 4.6l-6.8 6.8"/></svg>';
    var UNDO_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.2 7.2h6.1a3.4 3.4 0 1 1 0 6.8H7.4"/><path d="M6.7 4.5 4.1 7.2l2.6 2.6"/></svg>';
    var CHEV_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6.4 8 9.4l3-3"/></svg>';
    var LVL = {
      fatal: { cls: "dna-lv-red", icon: ERR_ICON, word: "Error · session stopped" },
      limit: { cls: "dna-lv-amber", icon: WARN_ICON, word: "Rate limit · 429, still alive" },
    };

    var CSS = [
      "body { --dna-bg:#ffffff; --dna-ink:#1b1b1c; --dna-ink2:#61666b; --dna-hover:rgba(0,0,0,.05); --dna-err:#ec1313; --dna-warn:#dd8629; --dna-warn-text:#8a5300; --dna-badge-bg:#c02a2a; }",
      "body[data-ds-dark-theme] { --dna-bg:#1b1b1c; --dna-ink:#f9fafb; --dna-ink2:#adb2b8; --dna-hover:rgba(255,255,255,.08); --dna-err:#f25a5a; --dna-warn:#f59e0b; --dna-warn-text:#f59e0b; --dna-badge-bg:#c02a2a; }",
      ".dna-block { margin: 2px 0 6px; }",
      ".dna-head { display:flex; align-items:center; height:36px; padding:0 16px; gap:8px; cursor:pointer; border-radius:8px; }",
      ".dna-head:hover { background: var(--dna-hover); }",
      ".dna-head:focus-visible { outline:2px solid var(--dna-err); outline-offset:-2px; }",
      ".dna-label { font-size:14px; font-weight:400; color: var(--dna-ink2); }",
      ".dna-hspace { flex:1; }",
      ".dna-chev { color: var(--dna-ink2); display:flex; transition: transform .15s; }",
      ".dna-head.dna-collapsed .dna-chev { transform: rotate(-90deg); }",
      ".dna-head.dna-collapsed + .dna-group { display:none; }",
      ".dna-badge { min-width:16px; height:16px; border-radius:8px; background: var(--dna-badge-bg); color:#fff; font: 700 10px/16px -apple-system, system-ui, sans-serif; text-align:center; padding:0 4px; }",
      ".dna-badge.dna-amb { background: var(--dna-warn); color:#1b1b1c; }",
      ".dna-badge.dna-mix { background: linear-gradient(90deg, var(--dna-badge-bg) 50%, var(--dna-warn) 50%); }",
      ".dna-group { max-height:196px; overflow-y:auto; overscroll-behavior:contain; }",
      ".dna-arow { display:flex; align-items:center; height:30px; margin:0 16px; padding:0 8px; border-radius:12px; font-size:14px; cursor:pointer; color: var(--dna-ink); }",
      ".dna-arow:hover { background: var(--dna-hover); }",
      ".dna-arow:focus-visible { outline:2px solid var(--dna-err); outline-offset:-2px; }",
      ".dna-slot { width:16px; height:20px; margin-right:4px; display:flex; align-items:center; flex:none; }",
      ".dna-arow.dna-lv-red .dna-slot, .dna-arow.dna-lv-red .dna-t { color: var(--dna-err); }",
      ".dna-arow.dna-lv-amber .dna-slot, .dna-arow.dna-lv-amber .dna-t { color: var(--dna-warn-text); }",
      ".dna-ttl { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:20px; }",
      ".dna-t { font-size:10px; line-height:16px; flex:none; margin-left:6px; }",
      ".dna-x { flex:none; border:0; background:transparent; color: var(--dna-ink2); cursor:pointer; width:18px; height:18px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; padding:0; margin-left:4px; opacity:0; }",
      ".dna-arow:hover .dna-x, .dna-x:focus-visible { opacity:1; }",
      ".dna-x:hover { color: var(--dna-err); }",
      ".dna-more { display:flex; align-items:center; height:26px; margin:0 16px; padding:0 8px 0 28px; border-radius:12px; font-size:12px; color: var(--dna-ink2); cursor:pointer; }",
      ".dna-more:hover { background: var(--dna-hover); }",
      ".dna-toast { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:2147483000; background: var(--dna-ink); color: var(--dna-bg); border-radius:10px; padding:9px 12px; font-size:12px; display:none; align-items:center; gap:10px; box-shadow:0 10px 30px rgba(0,0,0,.35); }",
      ".dna-undo { border:0; background:transparent; color:inherit; font: 700 12px/1 -apple-system, system-ui, sans-serif; cursor:pointer; display:inline-flex; gap:5px; align-items:center; text-decoration:underline; }",
      "[data-dna-stale] { opacity:.55; }",
      ".dna-block[data-dna-stale] .dna-label::after { content:' · stale'; color: var(--dna-warn-text); }",
      ".dna-deg { width:6px; height:6px; border-radius:50%; background: var(--dna-warn); display:inline-block; margin-left:6px; flex:none; }",
    ].join("\n");
    var style = document.createElement("style");
    style.setAttribute("data-plugin-css", "dsh-needs-attention");
    style.textContent = CSS;
    document.head.appendChild(style);

    var rows = [];
    var meta = { total: 0, degraded: 0, windowH: 12 };
    var lastFetchAt = 0;
    var lastDismissed = null;
    var toastTimer = null;
    var dismissed = loadSet(LS_DISMISSED);
    var expanded = false;
    try { expanded = localStorage.getItem(LS_EXPANDED) === "1"; } catch (e) {}

    function loadSet(key) {
      try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch (e) { return new Set(); }
    }
    function saveSet(key, set) {
      try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
    }
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function cssEsc(s) {
      return (window.CSS && window.CSS.escape) ? window.CSS.escape(String(s)) : String(s).replace(/["\\\]]/g, "\\$&");
    }
    /** Dismissal is keyed by the error instance, not the session: a session that
     *  errors again at a newer timestamp becomes visible again (product P1). */
    function dismissKey(r) { return String(r.id) + "@" + String(r.at || 0); }
    function isDismissed(r) { return dismissed.has(dismissKey(r)); }
    function fmtRel(ms) {
      if (!ms) return "";
      var d = lastFetchAt - ms;
      if (d < 60e3) return "now";
      if (d < 3600e3) return Math.max(1, Math.round(d / 60e3)) + "min";
      if (d < 172800e3) return Math.round(d / 3600e3) + "h";
      return Math.round(d / 86400e3) + "d";
    }
    function fmtAbs(ms) { return ms ? new Date(ms).toLocaleString() : "—"; }
    function id8(id) { return String(id).replace(/^session-/, "").slice(0, 8); }
    function rowTip(r) {
      var lv = LVL[r.severity] || LVL.fatal;
      return lv.word + "\n" + (r.lastError || "") + "\nerror at " + fmtAbs(r.at) + " · checked " + fmtAbs(lastFetchAt) + " · session " + id8(r.id);
    }

    function rowHtml(r, hidden) {
      var lv = LVL[r.severity] || LVL.fatal;
      var tip = rowTip(r);
      return '<div class="dna-arow ' + lv.cls + '" data-dna-id="' + esc(r.id) + '" data-dna-key="' + esc(dismissKey(r)) + '"'
        + ' role="button" tabindex="0" aria-label="' + esc((r.title || id8(r.id)) + " — " + (r.lastError || lv.word)) + '"'
        + ' title="' + esc(tip) + '"' + (hidden ? ' style="display:none"' : "") + '>'
        + '<span class="dna-slot">' + lv.icon + '</span>'
        + '<span class="dna-ttl">' + esc(r.title || r.id) + '</span>'
        + '<span class="dna-t">' + esc(fmtRel(r.at)) + '</span>'
        + '<button class="dna-x" type="button" data-dna-x="' + esc(dismissKey(r)) + '" aria-label="Dismiss ' + esc(r.title || id8(r.id)) + '">' + X_ICON + '</button></div>';
    }

    /** The block hangs on the sidebar's first section header. That header is not
     *  always called "Workspaces": WorkspaceBrowser.tsx renders
     *  `groupBy === 'flat' ? t('section.sessions') : t('section.workspaces')`, so a
     *  sidebar switched to the flat view says "Sessions" / "会话" and a text-only
     *  anchor produced no block at all (2026-10-31 operator report, reproduced:
     *  groupBy=flat → label "Sessions" → 0 blocks while the plugin is in the boot
     *  graph). Labels first; the structural fallback (first section header that
     *  owns a section label) survives the next rename. Product P3 still holds:
     *  with no section header anywhere the block attaches nowhere. */
    var SECTION_LABELS = ["Workspaces", "工作区", "Sessions", "会话"];
    /** Anchors, in order: a labelled section header → any section header that owns
     *  a section label → the first section header anywhere → the sidebar container
     *  itself. The last two exist because a sidebar can be re-drawn by another
     *  plugin with different class names; a block in the sidebar beats no block,
     *  and the status object below makes a miss visible instead of silent. */
    function findAnchor() {
      var labels = document.querySelectorAll('[class*="_sectionLabel"]');
      var labelled = null, structural = null;
      for (var i = 0; i < labels.length; i++) {
        var text = (labels[i].textContent || "").trim();
        var header = labels[i].closest('[class*="_sectionHeader"]') || labels[i].parentElement;
        if (!header) continue;
        if (SECTION_LABELS.indexOf(text) !== -1) return { el: header, how: "label:" + text };
        if (!labelled && text) labelled = { el: header, how: "sectionLabel:" + text };
      }
      if (labelled) return labelled;
      var anyHeader = document.querySelector('[class*="_sectionHeader"]');
      if (anyHeader && anyHeader.parentElement) return { el: anyHeader, how: "sectionHeader" };
      var side = document.querySelector('[class*="_sidebar"], [class*="_sidebarBody"], aside');
      if (side) return { el: side.firstElementChild || null, how: "sidebar", host: side };
      return null;
    }

    function parseHTML(html) {
      var t = document.createElement("template");
      t.innerHTML = html;
      return t.content.firstElementChild;
    }

    /** Diagnostic surface: a miss must be readable from the browser, not guessed
     *  from a screenshot. `window.__DNA_STATUS__` is the one place to look. */
    var DNA_BUILD = "anchor3";
    function setStatus(patch) {
      try {
        var prev = window.__DNA_STATUS__ || {};
        window.__DNA_STATUS__ = Object.assign({ build: DNA_BUILD, at: new Date().toISOString() }, prev, patch);
      } catch (e) {}
    }

    var lastSig = "";
    function render(force) {
      var anchor = findAnchor();
      if (!anchor || !anchor.el) {
        setStatus({ anchor: null, block: !!document.querySelector("[data-dna-block]"), rows: rows.length, err: "no-anchor" });
        return; /* never a wrong slot */
      }
      var host = anchor.host || (anchor.el && anchor.el.parentElement);
      var ref = anchor.el;
      if (!host) { setStatus({ anchor: anchor.how, block: false, rows: rows.length, err: "no-host" }); return; }
      var alive = rows.filter(function (r) { return !isDismissed(r); });
      var block = document.querySelector("[data-dna-block]");
      if (!alive.length) { if (block) { block.remove(); lastSig = ""; } setStatus({ anchor: anchor.how, block: false, rows: 0, err: null }); return; } /* auto-hide at 0 (REQ-003) */
      var sig = JSON.stringify([alive.map(function (r) { return [r.id, r.severity, r.title, r.at, r.lastError]; }), Array.from(dismissed), meta, expanded]);
      if (!force && sig === lastSig && block) { setStatus({ anchor: anchor.how, block: true, rows: alive.length, err: null }); return; } /* P3: no DOM churn on unchanged polls */
      lastSig = sig;
      var red = 0, amb = 0;
      alive.forEach(function (r) { if (r.severity === "limit") amb++; else red++; });
      var badgeCls = "dna-badge" + (red && amb ? " dna-mix" : amb && !red ? " dna-amb" : "");
      var collapsed = false;
      try { collapsed = localStorage.getItem(LS_COLLAPSED) === "1"; } catch (e) {}
      var headTitle = "Needs Attention — showing " + alive.length + (meta.total > alive.length ? " of " + meta.total : "")
        + " · last " + meta.windowH + "h" + (meta.degraded ? " · " + meta.degraded + " unreadable log(s)" : "");
      var html = '<div class="dna-block" data-dna-block data-dna-build="' + DNA_BUILD + '">'
        + '<div class="dna-head' + (collapsed ? " dna-collapsed" : "") + '" role="button" tabindex="0" aria-expanded="' + String(!collapsed) + '" title="' + esc(headTitle) + '">'
        + '<span class="dna-label">Needs Attention</span>'
        + (meta.degraded ? '<span class="dna-deg" title="' + esc(meta.degraded + " unreadable log(s)") + '"></span>' : '')
        + '<span class="dna-hspace"></span>'
        + '<span class="' + badgeCls + '">' + alive.length + '</span><span class="dna-chev">' + CHEV_ICON + '</span></div>'
        + '<div class="dna-group">';
      for (var i = 0; i < alive.length; i++) html += rowHtml(alive[i], !expanded && i >= VISIBLE_ROWS);
      var hiddenCount = expanded ? 0 : Math.max(0, alive.length - VISIBLE_ROWS);
      if (hiddenCount) html += '<div class="dna-more" data-dna-more role="button" tabindex="0">+' + hiddenCount + " more</div>";
      else if (expanded && alive.length > VISIBLE_ROWS) html += '<div class="dna-more" data-dna-more role="button" tabindex="0">show less</div>';
      html += "</div></div>";
      if (block) {
        block.replaceWith(parseHTML(html));
      } else if (ref && ref.parentElement === host) {
        host.insertBefore(parseHTML(html), ref);
      } else {
        host.insertBefore(parseHTML(html), host.firstChild);
      }
      setStatus({ anchor: anchor.how, block: !!document.querySelector("[data-dna-block]"), rows: alive.length, err: null });
    }

    function toggleHead(head) {
      var c = head.classList.toggle("dna-collapsed");
      head.setAttribute("aria-expanded", String(!c));
      try { localStorage.setItem(LS_COLLAPSED, c ? "1" : "0"); } catch (e) {}
    }

    function openSession(sid) {
      var native = document.querySelector('[data-row-key="session:' + cssEsc(sid) + '"]');
      if (native) { native.click(); return; } /* same open-session dispatch as native rows (REQ-002) */
      /* P1-B: the target row is often NOT rendered (workspace groups collapse at 5 rows),
         so fall back to the canonical deep-link path — but only for a well-formed id,
         because dsh.sessions.current is core-owned state (security P2). */
      if (!SESSION_ID_RE.test(String(sid))) { toast("cannot open this session id", false); return; }
      try { localStorage.setItem("dsh.sessions.current", JSON.stringify({ sessionId: sid })); }
      catch (e) { toast("cannot open this session", false); return; }
      toast("opening " + id8(sid) + "…", false);
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 150);
    }

    document.addEventListener("click", function (ev) {
      var x = ev.target.closest("[data-dna-x]");
      if (x) {
        ev.preventDefault();
        ev.stopPropagation();
        var key = x.getAttribute("data-dna-x");
        dismissed.add(key);
        lastDismissed = key;
        saveSet(LS_DISMISSED, dismissed);
        render();
        toast("dismissed — " + id8(String(key).split("@")[0]), true);
        return;
      }
      var head = ev.target.closest(".dna-head");
      if (head) { toggleHead(head); return; }
      var more = ev.target.closest("[data-dna-more]");
      if (more) {
        expanded = !expanded;
        try { localStorage.setItem(LS_EXPANDED, expanded ? "1" : "0"); } catch (e) {}
        render(true);
        return;
      }
      var row = ev.target.closest("[data-dna-id]");
      if (row) openSession(row.getAttribute("data-dna-id"));
    });

    /* keyboard parity: the head and rows are tabbable (product P2) */
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest(".dna-head")) { ev.preventDefault(); toggleHead(t.closest(".dna-head")); return; }
      var more = t.closest("[data-dna-more]");
      if (more) { ev.preventDefault(); expanded = !expanded; try { localStorage.setItem(LS_EXPANDED, expanded ? "1" : "0"); } catch (e) {} render(true); return; }
      var row = t.closest("[data-dna-id]");
      if (row) { ev.preventDefault(); openSession(row.getAttribute("data-dna-id")); }
    });

    function toast(msg, undoable) {
      var t = document.querySelector("[data-dna-toast]");
      if (!t) {
        t = document.createElement("div");
        t.className = "dna-toast";
        t.setAttribute("data-dna-toast", "");
        t.innerHTML = '<span class="dna-toastmsg"></span><button class="dna-undo" type="button">' + UNDO_ICON + "Undo</button>";
        document.body.appendChild(t);
        t.querySelector(".dna-undo").addEventListener("click", function () {
          if (lastDismissed) {
            dismissed.delete(lastDismissed);
            lastDismissed = null;
            saveSet(LS_DISMISSED, dismissed);
            render();
          }
          t.style.display = "none";
        });
      }
      t.querySelector(".dna-toastmsg").textContent = msg;
      t.querySelector(".dna-undo").style.display = undoable ? "inline-flex" : "none"; /* no Undo on a non-undoable toast */
      if (!undoable) lastDismissed = null;
      t.style.display = "flex";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.style.display = "none"; }, 7000);
    }

    var failStreak = 0;
    var warnedStale = false;
    function poll() {
      if (document.hidden) return; /* P3: no polling while the tab is hidden */
      fetch(routeUrl(), { credentials: "same-origin", headers: { accept: "application/json" } })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error("http " + res.status)); })
        .then(function (data) {
          if (!data) return;
          failStreak = 0;
          warnedStale = false;
          rows = Array.isArray(data.sessions) ? data.sessions : [];
          meta = {
            total: typeof data.total === "number" ? data.total : rows.length,
            degraded: typeof data.degraded === "number" ? data.degraded : 0,
            windowH: data.windowH || 12,
          };
          lastFetchAt = data.at || Date.now();
          pruneDismissed(rows);
          var blk = document.querySelector("[data-dna-block]");
          if (blk) blk.removeAttribute("data-dna-stale"); /* P2-6: recovery clears the stale marker */
          render();
        })
        .catch(function (err) {
          /* P2-6: never freeze silently — after 3 failures mark the block stale + warn once */
          failStreak++;
          if (failStreak >= 3 && !warnedStale) {
            warnedStale = true;
            try { console.warn("[needs-attention] refresh failing:", String((err && err.message) || err)); } catch (e) {}
            var b = document.querySelector("[data-dna-block]");
            if (b) b.setAttribute("data-dna-stale", "1");
          }
        })
        .then(schedule, schedule);
    }

    /** Keep only dismissal keys that correspond to the CURRENT error set, so the
     *  store cannot grow without bound and an old dismissal cannot hide a new error. */
    function pruneDismissed(current) {
      var live = {};
      current.forEach(function (r) { live[dismissKey(r)] = 1; });
      var changed = false;
      Array.from(dismissed).forEach(function (k) { if (!live[k]) { dismissed.delete(k); changed = true; } });
      if (changed) saveSet(LS_DISMISSED, dismissed);
    }

    setStatus({ booted: true, anchor: null, block: false, rows: 0, err: null });
    poll();
    /** Cadence (operator expectation 2026-10-31): a session that recovers must
     *  LEAVE the list promptly. The route answers in ~1-2 ms warm, so a block
     *  that is showing rows polls every 10 s and an empty block every 30 s;
     *  returning to the tab or focusing the window polls immediately. */
    var POLL_ACTIVE_MS = 10000;
    var POLL_EMPTY_MS = 30000;
    var pollTimer = null;
    function schedule() {
      if (pollTimer) clearTimeout(pollTimer);
      var every = document.querySelector("[data-dna-block]") ? POLL_ACTIVE_MS : POLL_EMPTY_MS;
      pollTimer = setTimeout(function () { poll(); }, every);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
    window.addEventListener("focus", function () { poll(); });

    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        if (rows.length && !document.querySelector("[data-dna-block]")) render(true);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return {
      name: "@almazom/dsh-needs-attention",
      apply: function () {},
      dispose: function () {
        try { observer.disconnect(); } catch (e) {}
        try { clearTimeout(pollTimer); pollTimer = null; } catch (e) {}
      },
    };
  },
});
