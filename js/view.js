/* =====================================================================
   VIEW — everything that draws to the screen. No app logic lives here;
   the Controller tells the View what to show.
   ===================================================================== */

const View = {

  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,

  els: {
    screens: {},   // filled in init()
    menuItems: [],
    wipe: document.getElementById("wipe"),
    reveal: document.getElementById("reveal"),
    revealLine: document.getElementById("reveal-line"),
    seq: document.getElementById("seq"),
    projectsBody: document.getElementById("projects-body"),
    skillsBody: document.getElementById("skills-body"),
    sfx: document.getElementById("sfx-select"),
    sfxSg: document.getElementById("sfx-sg"),
    sfxReload: document.getElementById("sfx-reload"),
    cursor: document.getElementById("cursor"),
    clock: document.getElementById("clock"),
  },

  init() {
    document.querySelectorAll(".screen").forEach(s => {
      this.els.screens[s.id.replace("screen-", "")] = s;
    });
    this.els.menuItems = [...document.querySelectorAll(".menu-item")];
    document.querySelectorAll("[data-ransom]").forEach(el => this.ransomize(el));
    this.els.sfx.volume = 0.45;
    // preload the transition images so the first run is not blank
    this.els.sfxSg.volume = 0.6;
    this.els.sfxReload.volume = 0.6;
    this.startClock();
    this.startParallax();
    this.startCursor();
    document.body.classList.add("loaded");
  },

  // Deterministic pseudo-random hash (so letters look the same every visit)
  hash(str) {
    let h = 9;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 387420489);
    return (h ^ h >>> 9) >>> 0;
  },

  /* ---------- Ransom-note lettering ---------- */
  ransomize(el) {
    const text = el.dataset.ransom || el.textContent;
    el.textContent = "";
    [...text].forEach((c, i) => {
      const span = document.createElement("span");
      span.className = "ch display";
      span.textContent = c;
      const h = this.hash(text + i);
      const rot = (h % 17) - 8;                 // -8..8 degrees
      const scale = 0.86 + ((h >> 3) % 30) / 100; // 0.86..1.15
      const dy = ((h >> 5) % 9) - 4;            // -4..4 px
      const t = `rotate(${rot}deg) scale(${scale}) translateY(${dy}px)`;
      span.style.setProperty("--t", t);
      span.style.transform = t;
      const variant = (h >> 7) % 10;
      if (variant === 0) span.classList.add("box");
      else if (variant === 1) span.classList.add("boxw");
      else if (variant === 2) span.classList.add("red");
      el.appendChild(span);
    });
  },

  /* ---------- Screens & menu ---------- */
  showScreen(name) {
    const s = this.els.screens;
    Object.values(s).forEach(sc => sc.classList.remove("active"));
    s[name].classList.add("active");
    s[name].scrollTop = 0;
    document.body.dataset.screen = name;
    const t = Model.themes[name];
    if (t) {
      document.body.style.setProperty("--red", t.red);
      document.body.style.setProperty("--red-deep", t.deep);
    }
  },

  setMenuSelection(index) {
    this.els.menuItems.forEach((m, j) => m.classList.toggle("sel", j === index));
  },

  // Diagonal wipe; calls swap() mid-way while the screen is covered
  wipe(swap, done, color) {
    if (this.reducedMotion) { swap(); done(); return; }
    const w = this.els.wipe;
    if (color) w.style.setProperty("--wipe", color);
    w.classList.remove("go"); void w.offsetWidth;  // restart animation
    w.classList.add("go");
    setTimeout(swap, 340);
    setTimeout(done, 720);
  },

  // The line leaves the home art's diagonal cut and sweeps right -> left,
  // opening a fan that reveals the next screen's art. swap() runs at the end.
  cutReveal(src, swap, done) {
    const el = this.els.reveal, line = this.els.revealLine;
    el.querySelector("img").src = src;
    const W = innerWidth, H = innerHeight, s = Math.max(W / 1200, H / 675);
    const ox = (W - 1200 * s) / 2, oy = (H - 675 * s) / 2;
    const P = { x: ox + 506 * s, y: oy + 675 * s };   // bottom of the cut (pivot)
    const T = { x: ox + 712 * s, y: oy };             // top of the cut
    const a0 = Math.atan2(T.x - P.x, P.y - T.y) * 180 / Math.PI;  // deg clockwise from up
    const ease = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const dur = 1000, start = performance.now();

    document.body.classList.add("revealing");
    el.style.transition = "none"; el.style.opacity = 1; el.style.display = "block";
    Object.assign(line.style, {
      display: "block", left: P.x - 2 + "px", top: P.y - 3000 + "px",
      width: "4px", height: "3000px", transformOrigin: "50% 100%",
    });

    const frame = now => {
      const t = Math.min(1, (now - start) / dur);
      const L = a0 - (a0 + 95) * ease(t);
      const R = a0 + (95 - a0) * ease(Math.min(1, t * 1.35));
      const mask = `conic-gradient(from ${L}deg at ${P.x}px ${P.y}px, #000 0deg, #000 ${R - L}deg, transparent ${R - L}deg)`;
      el.style.webkitMaskImage = el.style.maskImage = mask;
      line.style.transform = `rotate(${L}deg)`;
      if (t < 1) { requestAnimationFrame(frame); return; }
      // finished: swap screens underneath, then fade the overlay out
      line.style.display = "none";
      document.body.classList.add("instant");
      swap();
      document.body.classList.remove("revealing");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove("instant");
        el.style.transition = "opacity .3s"; el.style.opacity = 0;
        setTimeout(() => { el.style.display = "none"; done(); }, 320);
      }));
    };
    requestAnimationFrame(frame);
  },

  /* ---------- Sound ---------- */
  playSelect() {
    try {
      this.els.sfx.currentTime = 0;
      const p = this.els.sfx.play();
      if (p && p.catch) p.catch(() => { });  // blocked before first user gesture — fine
    } catch { }
  },

  // "sg" sound: played when a skills category is shown (s1 -> s2)
  playSkillSfx() {
    try {
      this.els.sfxSg.currentTime = 0;
      const p = this.els.sfxSg.play();
      if (p && p.catch) p.catch(() => { });
    } catch { }
  },

  // gun "reload" sound: played when the Skills background goes back from skills2 to skills
  playReloadSfx() {
    try {
      this.els.sfxReload.currentTime = 0;
      const p = this.els.sfxReload.play();
      if (p && p.catch) p.catch(() => { });
    } catch { }
  },

  /* ---------- Project cards ---------- */
  cardThumb(src) {
    return `<div class="thumb"><img src="${src}" alt="" loading="lazy"
      onerror="this.closest('.thumb').remove()"></div>`;
  },

  // Split "Medical Image…" so the first word renders red
  splitTitle(title) {
    const first = title.split(" ")[0];
    return `<em>${first}</em>${title.slice(first.length)}`;
  },

  /* LEGACY cards grid (Featured + All repositories), replaced by the list + detail panel below.
     Kept as a comment in case you want the cards back (needs #feat-grid / #repo-grid in index.html).

  renderFeatured(list) {
    if (this.els.featGrid.childElementCount) return;
    list.forEach((f, i) => {
      const a = document.createElement("a");
      a.className = "card feat";
      a.href = f.url; a.target = "_blank"; a.rel = "noopener";
      a.style.setProperty("--tilt", ((this.hash(f.title) % 5) - 2) * 0.8 + "deg");
      a.style.setProperty("--d", i * 70 + "ms");
      a.innerHTML = `
        ${this.cardThumb(f.img)}
        <span class="lang" style="--lc:${f.color}">${f.tag}</span>
        <h3>${f.live ? '<span class="live-dot"></span>' : ""}${this.splitTitle(f.title)}</h3>
        <p>${f.desc}</p>
        <div class="meta"><span>${f.live ? "LIVE NOW" : "HIGHLIGHT"}</span><span class="go">${f.cta}</span></div>`;
      this.els.featGrid.appendChild(a);
    });
  },

  renderRepos(repos, statusText, model) {
    this.els.repoStatus.textContent = statusText;
    this.els.repoGrid.innerHTML = "";
    repos.forEach((r, i) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = r.html_url; a.target = "_blank"; a.rel = "noopener";
      a.style.setProperty("--tilt", ((this.hash(r.name) % 5) - 2) * 0.8 + "deg");
      a.style.setProperty("--d", i * 70 + "ms");
      a.style.setProperty("--lc", model.langColors[r.language] || "#e60012");
      const pretty = r.name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const img = model.projectImages[r.name] || `assets/projects/${r.name}.png`;
      a.innerHTML = `
        ${this.cardThumb(img)}
        <span class="lang">${r.language || "Repo"}</span>
        <h3>${this.splitTitle(pretty)}</h3>
        <p>${r.description || "No description yet, but the code speaks for itself."}</p>
        <div class="meta">
          <span>★ ${r.stargazers_count || 0}</span>
          <span class="go">View on GitHub →</span>
        </div>`;
      this.els.repoGrid.appendChild(a);
    });
  },
  */

  /* ---------- Projects (same principle as Skills) ---------- */
  // projects.jpg (s1): list of projects. Click one -> projects1.jpg (s2) with the details
  // in its big black panel. `onPick(index)` is called by the controller.
  renderProjects(featured, onPick) {
    // entries = the featured projects + one "All repositories" entry (GitHub feed)
    this.projectItems = [
      ...featured.map(f => ({ ...f, label: f.title.split(":")[0] })),
      { repos: true, label: "All repositories", title: "All repositories", tag: "GitHub", color: "#e60012" },
    ];
    this.projectIndex = -1;
    this.repoList = null;

    this.els.projectsBody.innerHTML = `
      <div class="sk-stage">
        <ul class="sk-cats pj-cats"></ul>
        <div class="pj-detail" aria-live="polite"></div>
      </div>
      <div class="sk-fx pj-fx" aria-hidden="true">
        <i class="r"></i><i class="b"></i><i class="w"></i><span class="slash"></span>
      </div>`;

    const list = this.els.projectsBody.querySelector(".pj-cats");
    this.projectItems.forEach((it, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--w", 32);
      li.innerHTML = `
        <button class="sk-cat" type="button" data-pi="${i}">
          <span class="sk-label">${it.label}</span>
        </button>
        <span class="sk-tag" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>`;
      list.appendChild(li);
    });

    // one delegated listener for the list buttons and the number chips of the detail panel
    this.els.projectsBody.addEventListener("click", e => {
      const b = e.target.closest("[data-pi]");
      if (b && onPick) onPick(+b.dataset.pi);
    });

    // play select sound when hovering project list items
    let _lastPjHover = null;
    this.els.projectsBody.addEventListener("mouseover", e => {
      const b = e.target.closest(".pj-cats .sk-cat");
      if (b && b !== _lastPjHover) { _lastPjHover = b; this.playSelect(); }
      if (!b) _lastPjHover = null;
    }, { passive: true });

    // play select sound when hovering repo links
    let _lastRepoHover = null;
    this.els.projectsBody.addEventListener("mouseover", e => {
      const a = e.target.closest(".pj-repos a");
      if (a && a !== _lastRepoHover) { _lastRepoHover = a; this.playSelect(); }
      if (!a) _lastRepoHover = null;
    }, { passive: true });
  },

  // Same Persona 5 shards as the Skills page, with a white "slash" line instead of the gunshot.
  // `swap` runs while the shards cover the screen, so the background change is hidden.
  projectFx(forward, swap) {
    const fx = this.els.projectsBody.querySelector(".pj-fx");
    if (this.reducedMotion || !fx) { swap(); return; }

    fx.classList.remove("run", "fwd", "rev"); void fx.offsetWidth;   // restart the animation
    fx.classList.add("run", forward ? "fwd" : "rev");
    if (forward) {
      document.body.classList.remove("pj-shake"); void document.body.offsetWidth;
      document.body.classList.add("pj-shake");
    }
    clearTimeout(this._pjFxEnd);
    setTimeout(swap, forward ? 340 : 260);
    this._pjFxEnd = setTimeout(() => {
      fx.classList.remove("run", "fwd", "rev");
      document.body.classList.remove("pj-shake");
    }, forward ? 700 : 520);
  },

  // Navigate focus through repo links with arrow keys. Returns true if repos are shown.
  stepRepoFocus(delta) {
    const links = [...this.els.projectsBody.querySelectorAll(".pj-repos a")];
    if (!links.length) return false;
    const cur = links.indexOf(document.activeElement);
    const next = (cur + delta + links.length) % links.length;
    links[next].focus();
    return true;
  },

  isProjectOpen() {
    return !!this._pjOpen;                               // logical state (the class changes mid-transition)
  },

  // GitHub feed arrives (or fails) after the screen is built
  setRepos(repos, status) {
    this.repoList = { repos, status };
    const last = this.projectItems ? this.projectItems.length - 1 : -1;
    if (this.isProjectOpen() && this.projectIndex === last) this.fillProjectDetail(last);
  },

  fillProjectDetail(i) {
    const it = this.projectItems[i];
    const detail = this.els.projectsBody.querySelector(".pj-detail");
    const chips = this.projectItems.map((p, k) => `
      <button class="pj-chip${k === i ? " on" : ""}" type="button" data-pi="${k}"
        title="${p.label}" aria-label="${p.label}">${String(k + 1).padStart(2, "0")}</button>`).join("");

    let body;
    if (it.repos) {
      const r = this.repoList;
      body = !r
        ? `<p class="pj-status">Contacting GitHub…</p>`
        : `<p class="pj-status">${r.status}</p>
           <ul class="pj-repos">${r.repos.map((x, k) => `
             <li style="--k:${k}"><a href="${x.html_url}" target="_blank" rel="noopener">
               <span class="rp-name">${x.name.replace(/[-_]/g, " ")}</span>
               <span class="rp-info"><span class="l">${x.language || "Repo"}</span><span class="s">★ ${x.stargazers_count || 0}</span></span>
             </a></li>`).join("") || `<li style="--k:0"><a href="https://github.com/${Model.githubUser}" target="_blank" rel="noopener">
               <span class="rp-name">Open my GitHub profile</span>
               <span class="rp-info"><span class="l">GitHub</span><span class="s">→</span></span>
             </a></li>`}</ul>`;
    } else {
      body = `
        <span class="pj-tag" style="--lc:${it.color}">${it.tag}</span>
        <h3>${this.splitTitle(it.title)}</h3>
        ${it.img ? `<div class="pj-thumb"><img src="${it.img}" alt="" loading="lazy"
            onerror="this.closest('.pj-thumb').remove()"></div>` : ""}
        <p>${it.desc}</p>
        <a class="pj-cta" href="${it.url}" target="_blank" rel="noopener">${it.cta || "View on GitHub →"}</a>`;
    }
    detail.innerHTML = `<div class="pj-chips">${chips}</div>${it.repos ? `<h3>${this.splitTitle(it.title)}</h3>` : ""}${body}`;
  },

  openProject(i) {
    if (!this.projectItems[i]) return;
    this.projectIndex = i;
    this.highlightProject(i);

    this._pjOpen = true;

    const detail = this.els.projectsBody.querySelector(".pj-detail");
    detail.classList.remove("show");
    this.fillProjectDetail(i);
    detail.scrollTop = 0;

    // when the shards cover the screen: switch to projects1.jpg and slide the details in
    this.projectFx(true, () => {
      if (!this._pjOpen) return;                       // closed again in the meantime
      document.body.classList.add("projects-detail");
      void detail.offsetWidth;
      detail.classList.add("show");
    });
  },

  highlightProject(i) {
    this.projectIndex = i;
    this.els.projectsBody.querySelectorAll(".sk-cat")
      .forEach((b, k) => b.classList.toggle("on", k === i));
  },

  // instant = true: no transition (used when the Projects screen is entered)
  closeProject(instant) {
    const wasOpen = this._pjOpen;
    this.projectIndex = -1;
    this._pjOpen = false;
    const body = this.els.projectsBody;
    body.querySelectorAll(".sk-cat").forEach(b => b.classList.remove("on"));
    const detail = body.querySelector(".pj-detail");
    if (detail) detail.classList.remove("show");

    const back = () => {
      if (this._pjOpen) return;                        // opened again in the meantime
      document.body.classList.remove("projects-detail");
    };
    if (instant || !wasOpen) back();
    else this.projectFx(false, back);                  // shards sweep back to projects.jpg
  },

  /* ---------- Skills ---------- */
  // Categories live in the black area of the s1 background.
  // Clicking one swaps the background to s2 and shows its skills + levels
  // in the red area. `onPick(index)` is called by the controller's click handler.
  renderSkills(groups, onPick) {
    this.skillGroups = groups;
    this.skillIndex = -1;

    this.els.skillsBody.innerHTML = `
      <div class="sk-splats" aria-hidden="true">
        ${this.splatSvg(0, 74, 17, 1)}${this.splatSvg(1, 92, 50, .8)}${this.splatSvg(2, 61, 73, .7)}
      </div>
      <div class="sk-stage">
        <ul class="sk-cats"></ul>
        <div class="sk-detail" aria-live="polite"></div>
        <div class="sk-flash"></div>
      </div>
      <div class="sk-fx" aria-hidden="true">
        <i class="r"></i><i class="b"></i><i class="w"></i>
      </div>`;

    const list = this.els.skillsBody.querySelector(".sk-cats");
    groups.forEach((g, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--w", 24 - i * 2);          // staircase that follows the diagonal
      li.innerHTML = `
        <button class="sk-cat" type="button" data-i="${i}">
          <span class="sk-label">${g.group}</span>
        </button>
        <span class="sk-tag" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>`;
      list.appendChild(li);
    });

    list.addEventListener("click", e => {
      const btn = e.target.closest(".sk-cat");
      if (btn && onPick) onPick(+btn.dataset.i);
    });

    // play select sound when hovering skill category items
    let _lastSkHover = null;
    this.els.skillsBody.addEventListener("mouseover", e => {
      const b = e.target.closest(".sk-cats .sk-cat");
      if (b && b !== _lastSkHover) { _lastSkHover = b; this.playSelect(); }
      if (!b) _lastSkHover = null;
    }, { passive: true });
  },

  // Persona 5 style ink splat (spiky blob), deterministic so it looks the same every time
  splatSvg(seed, x, y, scale) {
    const n = 18, pts = [];
    for (let k = 0; k < n * 2; k++) {
      const h = this.hash("splat" + seed + k);
      const r = (k % 2 ? 22 + (h % 14) : 52 + (h % 40)) * (k % 6 === 0 ? 1.35 : 1);
      const ang = (k / (n * 2)) * Math.PI * 2;
      pts.push(`${(Math.cos(ang) * r).toFixed(1)},${(Math.sin(ang) * r).toFixed(1)}`);
    }
    return `<svg class="splat" style="left:${x}%;top:${y}%;--sc:${scale}" viewBox="-110 -110 220 220">
      <polygon points="${pts.join(" ")}" fill="#0b0b0d"/></svg>`;
  },

  // The "gunshot" transition between the two skills backgrounds:
  // forward (s1 -> s2): muzzle flash + screen shake, then red / black / white shards sweep across
  // (left -> right, like the bullet) and ink splats pop. Backward (s2 -> s1): shards sweep back.
  // `swap` runs while the shards cover the screen, so the background change is hidden.
  skillFx(forward, swap) {
    const fx = this.els.skillsBody.querySelector(".sk-fx");
    if (this.reducedMotion || !fx) { swap(); return; }
    const stage = this.els.skillsBody.querySelector(".sk-stage");
    const splats = this.els.skillsBody.querySelector(".sk-splats");

    fx.classList.remove("run", "fwd", "rev"); void fx.offsetWidth;   // restart the animation
    fx.classList.add("run", forward ? "fwd" : "rev");
    splats.classList.remove("go");
    if (forward) {
      void splats.offsetWidth; splats.classList.add("go");
      stage.classList.remove("shot"); void stage.offsetWidth; stage.classList.add("shot");
      document.body.classList.remove("sk-shake"); void document.body.offsetWidth;
      document.body.classList.add("sk-shake");
    }
    clearTimeout(this._fxEnd);
    setTimeout(swap, forward ? 340 : 260);
    this._fxEnd = setTimeout(() => {
      fx.classList.remove("run", "fwd", "rev");
      splats.classList.remove("go");
      document.body.classList.remove("sk-shake");
    }, forward ? 1450 : 520);
  },

  isSkillOpen() {
    return !!this._skOpen;                            // logical state (the class changes mid-transition)
  },

  openSkillGroup(i) {
    const g = this.skillGroups[i];
    if (!g) return;
    this.skillIndex = i;
    this._skOpen = true;

    this.els.skillsBody.querySelectorAll(".sk-cat")
      .forEach((b, k) => b.classList.toggle("on", k === i));

    const detail = this.els.skillsBody.querySelector(".sk-detail");
    detail.classList.remove("show");
    detail.innerHTML = `
      <h3>${g.group}</h3>
      <div class="sk-grid">
        ${g.items.map(([name, value]) => `
          <div class="sk-row">
            <div class="sk-top"><span class="sk-name">${name}</span><span class="lv">${value}%</span></div>
            <div class="sk-bar"><div class="fill" data-v="${value}"></div></div>
          </div>`).join("")}
      </div>`;

    // when the shards cover the screen: switch to the s2 background and slide the details in
    this.skillFx(true, () => {
      if (!this._skOpen) return;                      // closed again in the meantime
      document.body.classList.add("skills-detail");
      void detail.offsetWidth;
      detail.classList.add("show");
      this.animateSkillBars();
    });
  },

  // Highlight a category before its detail is shown (used while the screen flashes back to s1)
  highlightSkill(i) {
    this.skillIndex = i;
    this.els.skillsBody.querySelectorAll(".sk-cat")
      .forEach((b, k) => b.classList.toggle("on", k === i));
  },

  // instant = true: no transition (used when the Skills screen is entered)
  closeSkillGroup(instant) {
    const wasOpen = this._skOpen;
    this.skillIndex = -1;
    this._skOpen = false;
    const body = this.els.skillsBody;
    body.querySelectorAll(".sk-cat").forEach(b => b.classList.remove("on"));
    const detail = body.querySelector(".sk-detail");
    if (detail) detail.classList.remove("show");

    const back = () => {
      if (this._skOpen) return;                       // opened again in the meantime
      document.body.classList.remove("skills-detail");
    };
    if (instant || !wasOpen) back();
    else this.skillFx(false, back);                   // shards sweep back to s1
  },

  animateSkillBars() {
    const fills = this.els.skillsBody.querySelectorAll(".sk-detail .fill");
    fills.forEach(f => { f.style.width = "0"; });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fills.forEach((f, i) => setTimeout(() => { f.style.width = f.dataset.v + "%"; }, i * 60));
    }));
  },

  /* ---------- Ambient: clock, parallax, animated cursor ---------- */
  startClock() {
    setInterval(() => {
      this.els.clock.textContent =
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " · TUN";
    }, 1000);
  },

  startParallax() {
    if (this.reducedMotion) return;
    const stripes = document.getElementById("bg-stripes");
    const halftone = document.getElementById("bg-halftone");
    const arts = [...document.querySelectorAll(".menu-art")];
    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener("mousemove", e => {
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
    }, { passive: true });
    const loop = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      stripes.style.transform = `translate(${cx * 22}px, ${cy * 14}px)`;
      halftone.style.transform = `translate(${cx * -34}px, ${cy * -22}px)`;
      arts.forEach(a => {
        if (a.isConnected)
          a.style.transform = `translate(${cx * 14}px, ${cy * 9}px) scale(1.04)`;
      });
      requestAnimationFrame(loop);
    };
    loop();
  },

  // 30-frame sprite-strip cursor extracted from the original .ani files
  startCursor() {
    if (!matchMedia("(pointer:fine)").matches || this.reducedMotion) return;
    const cur = this.els.cursor;
    document.body.classList.add("cursor-on");
    let x = -100, y = -100, frame = 0, last = 0, visible = false;

    addEventListener("mousemove", e => {
      x = e.clientX; y = e.clientY;
      if (!visible) { cur.style.display = "block"; visible = true; }
      const t = e.target;
      const overLink = t.closest &&
        t.closest("a,button,.card,.menu-item,.back-hint,.contact-chip,#big-name");
      cur.classList.toggle("link", !!overLink);
    }, { passive: true });

    document.documentElement.addEventListener("mouseleave", () => {
      cur.style.display = "none"; visible = false;
    });

    const tick = ts => {
      if (ts - last >= 50) {                       // 50ms = original .ani frame rate
        frame = (frame + 1) % 30; last = ts;
        cur.style.backgroundPosition = -frame * 48 + "px 0";
      }
      cur.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
};