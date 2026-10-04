/* =====================================================================
   MODEL — the data and state of the app. Never touches the DOM.
   Edit your content here: featured projects, skills, image overrides.
   ===================================================================== */

const Model = {

  githubUser: "tlili-achref",

  // Where the contact form delivers (via formsubmit.co relay)
  contactEmail: "tliliachref17@gmail.com",

  // Per-section colour themes (main colour + darker shade). Edit freely.
  themes: {
    home:     { red: "#e60012", deep: "#a3000c" },
    projects: { red: "#e60012", deep: "#a3000c" },
    skills:   { red: "#e60012", deep: "#a3000c" },
    about:    { red: "#e60012", deep: "#a3000c" },
    contact:  { red: "#e60012", deep: "#a3000c" },
  },

  // Screens opened from Home with the "line out of the cut" reveal (image shown during the sweep)
  // DISABLED: Projects used to open with this special "line out of the cut" reveal.
  // Kept here (commented) in case you want it back; View.cutReveal() is still in view.js.
  // With this empty, every screen uses the same wipe transition.
  // cutReveal: { projects: "assets/menus/projects.jpg" },
  cutReveal: {},

  // App state (read/written by the Controller, displayed by the View)
  state: {
    screen: "home",        // which screen is showing
    menuIndex: 0,          // selected item on the home menu
    reposLoaded: false,
    skillsBuilt: false,
    projectsBuilt: false,
  },

  // ---- Featured projects (hand-written, shown above the GitHub feed) ----
  featured: [
    {
      title: "IA ResearchHub",
      tag: "Full-Stack · AI", color: "#3dff6e",
      url: "https://github.com/tlili-achref", cta: "View on GitHub →",
      img: "assets/projects/researchhub.png",
      desc: "A Reddit-inspired collaborative platform where researchers publish, comment on, share and discover scientific articles. A personalised recommendation system based on embeddings and semantic clustering suggests content matching each user's interests. Built with Spring Boot, FastAPI, JWT, Angular, TypeScript, PostgreSQL, PgVector, Sentence-Transformers and Docker.",
    },
    {
      title: "Drowsy: Real-Time Drowsiness Detection",
      tag: "Computer Vision", color: "#e60012",
      url: "https://github.com/tlili-achref", cta: "View on GitHub →",
      img: "assets/projects/drowsy.png",
      desc: "Real-time drowsiness and emotion detection through a mobile camera, with automatic alerts sent through Firebase. Uses the EAR/MAR (Eye/Mouth Aspect Ratio) algorithms for drowsiness and DeepFace for emotion recognition. Built with Python, FastAPI, React Native (Expo), Firebase and OpenCV.",
    },
    {
      title: "Virtual Try-On with CATVTON",
      tag: "Deep Learning", color: "#3178c6",
      url: "https://github.com/tlili-achref", cta: "View on GitHub →",
      img: "assets/projects/tryon.png",
      desc: "A virtual try-on system that lets you test clothes on a photo through a Gradio interface. Implements the CATVTON model with a complete ComfyUI workflow. Built with Python, Gradio, ComfyUI and Deep Learning.",
    },
    {
      title: "MedApp: Medical Application",
      tag: "Internship", color: "#f1e05a",
      url: "https://github.com/tlili-achref", cta: "View on GitHub →",
      img: "assets/projects/medapp.png",
      desc: "Summer internship project at Telnet Holding: a medical web application for managing patients, appointments and prescriptions, built with a TDD approach. I contributed to the frontend with Vue.js, Pinia, Axios and Vitest, connected to a Spring Boot / MongoDB REST API secured with JWT.",
    },
  ],

  // Repos already shown in "featured" get hidden from the GitHub feed
  featuredRepoNames: [
    // Add the exact names of the repos shown above to hide them from the GitHub feed
  ],

  // Shown if the GitHub API can't be reached
  fallbackRepos: [],

  // Optional thumbnail overrides: repo name → image path.
  // Anything not listed is looked up at assets/projects/<RepoName>.png
  projectImages: {
    // "DownloadGuard": "assets/projects/downloadguard.png",
  },

  langColors: {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    PHP: "#4F5D95", CSS: "#663399", HTML: "#e34c26",
    "Jupyter Notebook": "#DA5B0B", MATLAB: "#e16737", Java: "#b07219", Vue: "#41b883", C: "#555", "C++": "#f34b7d",
  },

  // ---- Skills screen ----
  skills: [
    { group: "Languages & Backend", items: [
      ["Java · Spring Boot", 85], ["Python · FastAPI", 85],
      ["JavaScript / TypeScript", 85], ["NestJS · Node.js", 78],
      ["REST APIs · JWT", 85], ["PostgreSQL · PgVector · MongoDB", 80],
    ]},
    { group: "Frontend & Mobile", items: [
      ["Angular", 82], ["Vue.js · Pinia", 80],
      ["React Native (Expo)", 72], ["Vitest · TDD", 78],
    ]},
    { group: "AI & Data Science", items: [
      ["Data Analysis", 80], ["Sentence-Transformers · Embeddings", 75],
      ["OpenCV · DeepFace", 75], ["Deep Learning · CATVTON · ComfyUI", 70],
    ]},
    { group: "Tools & Automation", items: [
      ["Git & GitHub · GitHub Actions", 85], ["Docker", 78],
      ["Firebase", 70], ["Selenium · Openpyxl", 75],
    ]},
    { group: "Spoken Languages", items: [
      ["Arabic (native)", 100], ["French (advanced)", 85], ["English (advanced)", 85],
    ]},
  ],

  // ---- Data fetching ----
  async fetchRepos() {
    const skip = new Set(this.featuredRepoNames);
    try {
      const res = await fetch(
        `https://api.github.com/users/${this.githubUser}/repos?per_page=100&sort=updated`
      );
      if (!res.ok) throw new Error(res.status);
      const repos = (await res.json()).filter(r => !r.fork && !skip.has(r.name));
      return { repos, live: true };
    } catch {
      return { repos: this.fallbackRepos.filter(r => !skip.has(r.name)), live: false };
    }
  },
};
