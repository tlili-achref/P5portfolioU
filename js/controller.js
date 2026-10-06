/* =====================================================================
   CONTROLLER — listens to the user, updates the Model, tells the View.
   ===================================================================== */

const Controller = {

  transitioning: false,
  audioUnlocked: false,
  skillToken: 0,
  projectToken: 0,
  SKILL_FLASH_MS: 440,   // length of the s2 -> s1 shards before the next category is shown

  init() {
    View.init();
    this.bindMenu();
    this.bindKeyboard();
    this.bindAudioUnlock();
    this.bindContactForm();
  },

  /* ---------- Contact form (relayed via formsubmit.co, mailto fallback) ---------- */
  bindContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const status = document.getElementById("form-status");
    const btn = form.querySelector(".form-send");

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (data._honey) return;  // honeypot caught a bot
      if (!data.name.trim() || !data.email.trim() || !data.message.trim()) {
        status.textContent = "Fill in all three fields first.";
        return;
      }
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${Model.contactEmail}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            message: data.message,
            _subject: `Portfolio message from ${data.name}`,
          }),
        });
        if (!res.ok) throw new Error(res.status);
        status.textContent = "Sent! I'll get back to you soon.";
        form.reset();
        this.play();
      } catch {
        // relay unreachable: open the visitor's own mail app instead
        status.textContent = "Couldn't reach the relay, opening your email app instead…";
        const subject = encodeURIComponent(`Portfolio message from ${data.name}`);
        const body = encodeURIComponent(`${data.message}\n\nReply to: ${data.email}`);
        location.href = `mailto:${Model.contactEmail}?subject=${subject}&body=${body}`;
      } finally {
        btn.disabled = false;
      }
    });
  },

  /* ---------- Navigation ---------- */
  goTo(screen) {
    if (this.transitioning || screen === Model.state.screen) return;
    this.transitioning = true;
    this.play();

    const swap = () => {            // swap screens while the view is covered
      Model.state.screen = screen;
      View.showScreen(screen);
      if (screen === "projects") this.loadProjects();
      if (screen === "skills") this.loadSkills();
    };
    const finish = () => { this.transitioning = false; };

    // every screen (Home -> Projects included) uses the same red wipe
    View.wipe(swap, finish, Model.themes[screen] && Model.themes[screen].red);
  },

  select(index) {
    const n = View.els.menuItems.length;
    const next = (index + n) % n;
    if (next !== Model.state.menuIndex) this.play();
    Model.state.menuIndex = next;
    View.setMenuSelection(next);
  },

  /* ---------- Screen data loading ---------- */
  async loadProjects() {
    if (!Model.state.projectsBuilt) {
      View.renderProjects(Model.featured, i => this.pickProject(i));
      Model.state.projectsBuilt = true;
    }
    this.closeProject(true);           // always start on the projects.jpg background (no transition)
    if (Model.state.reposLoaded) return;
    const { repos, live } = await Model.fetchRepos();
    const status = live
      ? `${repos.length} repositories · live from GitHub`
      : "Showing pinned work · GitHub API unavailable right now";
    View.setRepos(repos, status);
    Model.state.reposLoaded = true;
  },

  loadSkills() {
    if (!Model.state.skillsBuilt) {
      View.renderSkills(Model.skills, i => this.pickSkill(i));
      Model.state.skillsBuilt = true;
    }
    this.closeSkill(true);             // always start on the s1 background (no transition)
  },

  // Click on a category. Same category again -> back to s1.
  pickSkill(i) {
    if (View.isSkillOpen() && View.skillIndex === i) {
      this.closeSkill();                        // back to s1 (plays the reload sound)
    } else {
      this.showSkill(i);
    }
  },

  // Show a category with the "sg" sound. If another category is already open,
  // the background goes s2 -> s1, then back to s2 with the new category + sound.
  showSkill(i) {
    const token = ++this.skillToken;
    const go = () => {
      if (token !== this.skillToken) return;   // a newer click replaced this one
      this.playSg();
      View.openSkillGroup(i);
    };
    if (View.isSkillOpen()) {
      this.playReload();                        // gun reload while the shards sweep back
      View.closeSkillGroup();                   // s2 -> s1
      View.highlightSkill(i);                   // new choice is already lit during the flash
      setTimeout(go, this.SKILL_FLASH_MS);
    } else {
      go();
    }
  },

  closeSkill(instant) {
    this.skillToken++;                          // cancel any pending s1 -> s2 switch
    if (!instant && View.isSkillOpen()) this.playReload();
    View.closeSkillGroup(instant);
  },

  // up/down on the skills screen: previous / next category
  stepSkill(delta) {
    const n = Model.skills.length;
    const from = View.skillIndex < 0 ? (delta > 0 ? -1 : 0) : View.skillIndex;
    this.showSkill((from + delta + n) % n);
  },

  playSg() {
    if (this.audioUnlocked) View.playSkillSfx();
  },

  // gun reload: every time the Skills background goes back from skills2 to skills
  playReload() {
    if (this.audioUnlocked) View.playReloadSfx();
  },

  /* ---------- Projects: same principle as Skills ---------- */
  // Click on a project. Same project again -> back to the list background.
  pickProject(i) {
    if (View.isProjectOpen() && View.projectIndex === i) {
      this.closeProject();                      // back to list (plays the reload sound)
    } else {
      this.showProject(i);
    }
  },

  // Show a project with the "sg" sound. If another one is open, the background goes
  // projects1 -> projects (flash), then back to projects1 with the new project + sound.
  showProject(i) {
    const token = ++this.projectToken;
    const go = () => {
      if (token !== this.projectToken) return;   // a newer click replaced this one
      this.playSg();
      View.openProject(i);
    };
    if (View.isProjectOpen()) {
      this.playReload();                         // reload sound while the shards sweep back
      View.closeProject();
      View.highlightProject(i);                  // new choice is already lit during the flash
      setTimeout(go, this.SKILL_FLASH_MS);
    } else {
      go();
    }
  },

  closeProject(instant) {
    this.projectToken++;                         // cancel any pending switch
    if (!instant && View.isProjectOpen()) this.playReload();
    View.closeProject(instant);
  },

  stepProject(delta) {
    const n = View.projectItems.length;
    const from = View.projectIndex < 0 ? (delta > 0 ? -1 : 0) : View.projectIndex;
    this.showProject((from + delta + n) % n);
  },

  /* ---------- Sound (browsers block audio until first user gesture) ---------- */
  play() {
    if (this.audioUnlocked) View.playSelect();
  },

  bindAudioUnlock() {
    const unlock = () => { this.audioUnlocked = true; };
    addEventListener("pointerdown", unlock, { once: true, capture: true });
    addEventListener("keydown", unlock, { once: true, capture: true });
  },

  /* ---------- Input bindings ---------- */
  bindMenu() {
    View.els.menuItems.forEach((item, i) => {
      item.addEventListener("mouseenter", () => this.select(i));
      item.addEventListener("click", () => this.goTo(item.dataset.target));
    });

    document.querySelectorAll("[data-back]").forEach(b =>
      b.addEventListener("click", () => this.goTo("home")));

    // Clicking the name always takes you home
    document.getElementById("big-name").addEventListener("click", () => {
      if (Model.state.screen !== "home") this.goTo("home");
      else this.play();
    });
  },

  bindKeyboard() {
    addEventListener("keydown", e => {
      // screenshot viewer open: Esc closes it (not the project), arrows switch picture
      if (View.lightboxOpen()) {
        if (e.key === "Escape") View.closeLightbox();
        else if (e.key === "ArrowRight") View.stepLightbox(1);
        else if (e.key === "ArrowLeft") View.stepLightbox(-1);
        else if (e.key === "Tab") { /* keep focus on the viewer */ View.lbEls.close.focus(); }
        else return;
        e.preventDefault();
        return;
      }
      if (Model.state.screen === "home") {
        if (e.key === "ArrowDown") { this.select(Model.state.menuIndex + 1); e.preventDefault(); }
        else if (e.key === "ArrowUp") { this.select(Model.state.menuIndex - 1); e.preventDefault(); }
        else if (e.key === "Enter") {
          this.goTo(View.els.menuItems[Model.state.menuIndex].dataset.target);
        }
      } else if (Model.state.screen === "skills" && !this.transitioning) {
        if (e.key === "ArrowDown") { this.stepSkill(1); e.preventDefault(); }
        else if (e.key === "ArrowUp") { this.stepSkill(-1); e.preventDefault(); }
        else if (e.key === "Escape") {
          // first Esc closes the open category (back to s1), second Esc goes home
          if (View.isSkillOpen()) this.closeSkill();
          else this.goTo("home");
        }
      } else if (Model.state.screen === "projects" && !this.transitioning) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          if (View.stepRepoFocus(1)) { this.play(); }   // navigate repo links
          else this.stepProject(1);                      // navigate project list
          e.preventDefault();
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          if (View.stepRepoFocus(-1)) { this.play(); }
          else this.stepProject(-1);
          e.preventDefault();
        } else if (e.key === "Escape") {
          // first Esc closes the open project (back to the list), second Esc goes home
          if (View.isProjectOpen()) this.closeProject();
          else this.goTo("home");
        }
      } else if (e.key === "Escape") {
        this.goTo("home");
      }
    });
  },
};

Controller.init();
