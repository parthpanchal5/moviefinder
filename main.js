// Movie Finder — vanilla JS, native fetch, debounced live search + autocomplete,
// AbortController for stale-request cancellation, in-memory + sessionStorage cache,
// dynamic "Hot in 2026" carousel, pagination, year/genre/sort filters,
// generated poster templates, and CSP-friendly (no inline event handlers).

const API_KEY = "92239507";
const API = "https://www.omdbapi.com/";
const PAGE_SIZE = 10; // OMDb returns 10 results per page
const MAX_PAGES = 100; // OMDb hard limit
const CURRENT_YEAR = 2026;

// Home browse rows. OMDb has no "trending" endpoint, so each row is a curated
// title list fetched in parallel; only titles that resolve with a poster show.
const BROWSE_ROWS = [
  {
    track: "track-hot",
    ranked: true,
    year: "2026",
    titles: [
      "Avengers: Doomsday", "Dune: Part Three", "Spider-Man: Brand New Day",
      "Avatar: Fire and Ash", "Toy Story 5", "28 Years Later", "Superman",
      "Moana", "The Mandalorian and Grogu", "Mission: Impossible",
      "Wicked: For Good", "Zootopia 2",
    ],
  },
  {
    track: "track-top",
    type: "movie",
    titles: [
      "The Shawshank Redemption", "The Godfather", "The Dark Knight",
      "Pulp Fiction", "Forrest Gump", "Inception", "Fight Club", "The Matrix",
      "Goodfellas", "Interstellar", "Gladiator",
      "The Lord of the Rings: The Return of the King",
    ],
  },
  {
    track: "track-tv",
    type: "series",
    titles: [
      "Breaking Bad", "Game of Thrones", "Stranger Things", "The Office",
      "Friends", "Peaky Blinders", "Dark", "The Witcher", "Money Heist",
      "Sherlock", "Chernobyl", "The Last of Us",
    ],
  },
  {
    track: "track-action",
    type: "movie",
    titles: [
      "Mad Max: Fury Road", "John Wick", "Top Gun: Maverick", "Die Hard",
      "Gladiator", "The Avengers", "Mission: Impossible - Fallout",
      "Casino Royale", "Inception", "Dune", "Edge of Tomorrow", "300",
    ],
  },
];

const el = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("searchText"),
  clear: document.getElementById("clearBtn"),
  suggest: document.getElementById("suggestions"),
  movies: document.getElementById("movies"),
  status: document.getElementById("status"),
  head: document.getElementById("resultsHead"),
  title: document.getElementById("resultsTitle"),
  count: document.getElementById("resultsCount"),
  year: document.getElementById("filterYear"),
  genre: document.getElementById("filterGenre"),
  sort: document.getElementById("filterSort"),
  pagination: document.getElementById("pagination"),
  chips: document.getElementById("chips"),
  browse: document.getElementById("browse"),
  bgFx: document.getElementById("bgFx"),
  modal: document.getElementById("modal"),
  modalBody: document.getElementById("modalBody"),
};

// ---------- App state ----------
const state = {
  query: "",
  page: 1,
  totalResults: 0,
  results: [], // enriched objects for the current page
  year: "",
  genre: "",
  sort: "relevance",
};

// ---------- Security: HTML/attr escaping ----------
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const esc = escapeHtml; // alias for interpolating API fields safely

// ---------- Generated poster template (for missing posters) ----------
function posterFallback(title) {
  const words = String(title || "Untitled").trim().split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length >= 4) break;
  }
  if (cur && lines.length < 4) lines.push(cur);
  if (lines.length === 4 && words.length > lines.join(" ").split(/\s+/).length) {
    lines[3] = lines[3].slice(0, 13) + "…";
  }
  const tspans = lines
    .map((l, i) => `<tspan x="150" dy="${i === 0 ? 0 : 30}">${esc(l)}</tspan>`)
    .join("");

  // film-perforation strips down each edge for a "filmstrip" motif
  let perfs = "";
  for (let y = 12; y < 450; y += 26) {
    perfs +=
      `<rect x="10" y="${y}" width="10" height="14" rx="2" fill="#0b0b0f" opacity=".5"/>` +
      `<rect x="280" y="${y}" width="10" height="14" rx="2" fill="#0b0b0f" opacity=".5"/>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#20202b"/><stop offset="1" stop-color="#14141c"/></linearGradient></defs>` +
    `<rect width="300" height="450" fill="url(#g)"/>` +
    perfs +
    `<rect x="26" y="0" width="248" height="6" fill="#e50914"/>` +
    // film-reel icon
    `<g transform="translate(150 150)">` +
    `<circle r="46" fill="#1b1b25" stroke="#3a3a48" stroke-width="2"/>` +
    `<circle r="13" fill="none" stroke="#3a3a48" stroke-width="2"/>` +
    `<circle cx="0" cy="-30" r="6" fill="#3a3a48"/><circle cx="0" cy="30" r="6" fill="#3a3a48"/>` +
    `<circle cx="-30" cy="0" r="6" fill="#3a3a48"/><circle cx="30" cy="0" r="6" fill="#3a3a48"/>` +
    `<path d="M-7 -11 L13 0 L-7 11 Z" fill="#e50914"/>` +
    `</g>` +
    `<text x="150" y="232" fill="#f5f5f7" font-family="Poppins,Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle">${tspans}</text>` +
    `<text x="150" y="${250 + lines.length * 24}" fill="#7a7a86" font-family="Poppins,Arial,sans-serif" font-size="12" letter-spacing="1.5" text-anchor="middle">POSTER UNAVAILABLE</text>` +
    `<text x="150" y="424" fill="#9b9ba6" font-family="Poppins,Arial,sans-serif" font-size="11" font-weight="600" letter-spacing="2.5" text-anchor="middle">MOVIE FINDER</text>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// pick a usable poster, or generate a branded template
function posterFor(m) {
  return m.Poster && m.Poster !== "N/A" ? m.Poster : posterFallback(m.Title);
}

// ---------- Cache ----------
const memCache = new Map();
function cacheGet(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const raw = sessionStorage.getItem("mf:" + key);
    if (raw) {
      const val = JSON.parse(raw);
      memCache.set(key, val);
      return val;
    }
  } catch (_) {}
  return null;
}
function cacheSet(key, val) {
  memCache.set(key, val);
  try {
    sessionStorage.setItem("mf:" + key, JSON.stringify(val));
  } catch (_) {}
}

// ---------- Fetch helper ----------
async function apiGet(params, signal) {
  const key = JSON.stringify(params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL(API);
  url.searchParams.set("apikey", API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v != null) url.searchParams.set(k, v);
  });

  const res = await fetch(url, { signal });
  const data = await res.json();
  if (data.Response === "True") cacheSet(key, data);
  return data;
}

// ---------- Search ----------
let searchController = null;

async function runSearch(page = 1) {
  const q = state.query.trim();
  if (!q) {
    resetView();
    return;
  }

  document.body.classList.add("searching");
  state.page = page;

  if (searchController) searchController.abort();
  searchController = new AbortController();

  el.head.hidden = true;
  el.pagination.hidden = true;
  el.status.textContent = "";
  el.status.className = "status";
  renderSkeletons(PAGE_SIZE);

  try {
    const data = await apiGet(
      { s: q, page, y: state.year },
      searchController.signal
    );

    if (data.Response === "False") {
      el.movies.innerHTML = "";
      el.head.hidden = true;
      el.pagination.hidden = true;
      el.status.className = "status status--error";
      el.status.textContent =
        data.Error === "Movie not found!"
          ? `No results for “${q}”${state.year ? " in " + state.year : ""}. Try another title.`
          : data.Error;
      renderSuggestions([], q);
      return;
    }

    state.totalResults = parseInt(data.totalResults, 10) || data.Search.length;
    state.results = data.Search.map((m) => ({ ...m, _rating: undefined, _genre: "" }));

    el.status.textContent = "";
    el.head.hidden = false;
    renderSuggestions(data.Search, q);
    applyView();
    enrich(state.results);
  } catch (err) {
    if (err.name === "AbortError") return;
    el.movies.innerHTML = "";
    el.status.className = "status status--error";
    el.status.textContent = "Something went wrong. Check your connection and try again.";
  }
}

// fetch details (rating + genre) for the page so genre/rating filters work
async function enrich(list) {
  await Promise.all(
    list.map(async (m) => {
      try {
        const d = await apiGet({ i: m.imdbID });
        m._rating =
          d.imdbRating && d.imdbRating !== "N/A" ? parseFloat(d.imdbRating) : null;
        m._genre = d.Genre && d.Genre !== "N/A" ? d.Genre : "";
        const badge = el.movies.querySelector(`[data-rating="${m.imdbID}"]`);
        if (badge && m._rating != null) {
          badge.textContent = "★ " + m._rating;
          badge.classList.add("show");
        }
      } catch (_) {}
    })
  );
  buildGenreOptions();
  if (state.genre || state.sort.startsWith("rating")) applyView();
}

// ---------- Filtering / sorting / rendering pipeline ----------
function applyView() {
  let list = state.results.slice();

  if (state.genre) {
    list = list.filter((m) =>
      (m._genre || "")
        .split(",")
        .map((g) => g.trim())
        .includes(state.genre)
    );
  }

  const byNum = (a, b) => a - b;
  switch (state.sort) {
    case "rating-desc":
      list.sort((a, b) => byNum(b._rating ?? -1, a._rating ?? -1));
      break;
    case "rating-asc":
      list.sort((a, b) => byNum(a._rating ?? Infinity, b._rating ?? Infinity));
      break;
    case "year-desc":
      list.sort((a, b) => byNum(parseInt(b.Year) || 0, parseInt(a.Year) || 0));
      break;
    case "year-asc":
      list.sort((a, b) => byNum(parseInt(a.Year) || 0, parseInt(b.Year) || 0));
      break;
    case "title":
      list.sort((a, b) => a.Title.localeCompare(b.Title));
      break;
  }

  el.title.textContent = `Results for “${state.query.trim()}”`;
  const shown = state.genre ? `${list.length} of ${state.totalResults}` : `${state.totalResults} found`;
  el.count.textContent = shown;

  if (!list.length) {
    el.movies.innerHTML = "";
    el.status.className = "status";
    el.status.textContent = `No ${esc(state.genre)} titles on this page. Try another page or genre.`;
  } else {
    el.status.textContent = "";
    renderCards(list);
  }
  renderPagination();
}

function buildGenreOptions() {
  const genres = new Set();
  state.results.forEach((m) =>
    (m._genre || "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => genres.add(g))
  );
  const current = state.genre;
  const opts = ['<option value="">All</option>']
    .concat(
      [...genres]
        .sort()
        .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
    )
    .join("");
  el.genre.innerHTML = opts;
  el.genre.value = current; // preserve selection if still present
  if (el.genre.value !== current) state.genre = "";
}

// ---------- Rendering ----------
function renderSkeletons(n) {
  el.movies.innerHTML = Array.from({ length: n })
    .map(
      () => `
      <div class="skeleton">
        <div class="skeleton__poster"></div>
        <div class="skeleton__line"></div>
        <div class="skeleton__line short"></div>
      </div>`
    )
    .join("");
}

function renderCards(movies) {
  el.movies.innerHTML = movies
    .map((m) => {
      const rating =
        m._rating != null
          ? `<span class="card__rating show" data-rating="${esc(m.imdbID)}">★ ${esc(m._rating)}</span>`
          : `<span class="card__rating" data-rating="${esc(m.imdbID)}"></span>`;
      return `
      <article class="card" data-id="${esc(m.imdbID)}" tabindex="0" role="button" aria-label="${esc(m.Title)}">
        <div class="card__poster">
          <img src="${esc(posterFor(m))}" data-fb="${esc(posterFallback(m.Title))}"
               alt="${esc(m.Title)} poster" loading="lazy" />
          <span class="card__type">${esc(m.Type)}</span>
          ${rating}
          <div class="card__overlay"><button class="card__play">▶ Details</button></div>
        </div>
        <div class="card__info">
          <div class="card__title">${esc(m.Title)}</div>
          <div class="card__year">${esc(m.Year)}</div>
        </div>
      </article>`;
    })
    .join("");
  // stagger the CSS entrance animation (cards are visible by default)
  el.movies.querySelectorAll(".card").forEach((c, i) => {
    c.style.animationDelay = `${(i % PAGE_SIZE) * 50}ms`;
  });
}

// ---------- Pagination ----------
function renderPagination() {
  // only show pagination once a search has populated results
  const totalPages = Math.min(Math.ceil(state.totalResults / PAGE_SIZE), MAX_PAGES);
  if (!document.body.classList.contains("searching") || !state.results.length || totalPages <= 1) {
    el.pagination.hidden = true;
    el.pagination.innerHTML = "";
    return;
  }

  const cur = state.page;
  const pages = new Set([1, totalPages, cur, cur - 1, cur + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  let html = `<button class="page-btn" data-page="${cur - 1}" ${cur === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>`;
  let prev = 0;
  for (const p of list) {
    if (p - prev > 1) html += `<span class="page-ellipsis">…</span>`;
    html += `<button class="page-btn ${p === cur ? "active" : ""}" data-page="${p}" ${
      p === cur ? 'aria-current="page"' : ""
    }>${p}</button>`;
    prev = p;
  }
  html += `<button class="page-btn" data-page="${cur + 1}" ${cur === totalPages ? "disabled" : ""} aria-label="Next page">›</button>`;

  el.pagination.innerHTML = html;
  el.pagination.hidden = false;
}

// ---------- Autocomplete suggestions ----------
let activeIndex = -1;

function renderSuggestions(movies, q) {
  if (!movies.length || document.activeElement !== el.input) {
    hideSuggestions();
    return;
  }
  activeIndex = -1;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");

  el.suggest.innerHTML = movies
    .slice(0, 6)
    .map((m) => {
      const titleHl = esc(m.Title).replace(re, "<b>$1</b>");
      return `
      <li class="suggestion" role="option" data-id="${esc(m.imdbID)}">
        <img class="suggestion__img" src="${esc(posterFor(m))}" data-fb="${esc(posterFallback(m.Title))}" alt="" loading="lazy" />
        <div class="suggestion__meta">
          <div class="suggestion__title">${titleHl}</div>
          <div class="suggestion__sub">${esc(m.Type)} · ${esc(m.Year)}</div>
        </div>
      </li>`;
    })
    .join("");
  el.suggest.hidden = false;
  el.input.setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
  el.suggest.hidden = true;
  el.suggest.innerHTML = "";
  activeIndex = -1;
  el.input.setAttribute("aria-expanded", "false");
}

function moveActive(dir) {
  const items = [...el.suggest.querySelectorAll(".suggestion")];
  if (!items.length) return;
  items[activeIndex]?.classList.remove("active");
  activeIndex = (activeIndex + dir + items.length) % items.length;
  const cur = items[activeIndex];
  cur.classList.add("active");
  cur.scrollIntoView({ block: "nearest" });
}

// ---------- Browse rows (home carousels) ----------
async function loadBrowseRows() {
  await Promise.all(BROWSE_ROWS.map(loadRow));
}

async function loadRow(cfg) {
  const track = document.getElementById(cfg.track);
  if (!track) return;
  const section = track.closest("[data-row]");

  const results = await Promise.all(
    cfg.titles.map(async (t) => {
      try {
        const m = await apiGet({ t, y: cfg.year, type: cfg.type, plot: "short" });
        return m.Response === "True" && m.Poster && m.Poster !== "N/A" ? m : null;
      } catch (_) {
        return null;
      }
    })
  );

  const movies = results.filter(Boolean);
  if (!movies.length) return; // leave row hidden if nothing resolves

  track.innerHTML = movies
    .map((m, i) => {
      const rank = cfg.ranked ? `<span class="row__rank">${i + 1}</span>` : "";
      const date = m.Released && m.Released !== "N/A" ? m.Released : m.Year;
      return `
      <div class="row__card" data-id="${esc(m.imdbID)}" tabindex="0" role="button" aria-label="${esc(m.Title)}">
        <div class="row__poster">
          <img src="${esc(m.Poster)}" data-fb="${esc(posterFallback(m.Title))}" alt="${esc(m.Title)} poster" loading="lazy" />
          ${rank}
          <div class="row__caption">
            <div class="row__name">${esc(m.Title)}</div>
            <div class="row__date">${esc(date)}</div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  if (section) section.hidden = false;
}

// ---------- Modal / details ----------
async function openMovie(id) {
  hideSuggestions();
  el.modal.classList.add("open");
  el.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  el.modalBody.innerHTML = `<div class="modal__spinner"><div class="spinner"></div></div>`;

  try {
    const m = await apiGet({ i: id, plot: "full" });
    if (m.Response === "False") {
      el.modalBody.innerHTML = `<div class="modal__spinner">Couldn't load details.</div>`;
      return;
    }
    renderDetail(m);
  } catch (_) {
    el.modalBody.innerHTML = `<div class="modal__spinner">Couldn't load details.</div>`;
  }
}

function renderDetail(m) {
  const genres = (m.Genre || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => `<span class="genre">${esc(g)}</span>`)
    .join("");

  const facts = [
    ["Director", m.Director],
    ["Writer", m.Writer],
    ["Actors", m.Actors],
    ["Released", m.Released],
    ["Runtime", m.Runtime],
    ["Language", m.Language],
    ["Country", m.Country],
    ["Awards", m.Awards],
  ]
    .filter(([, v]) => v && v !== "N/A")
    .map(([k, v]) => `<li><strong>${k}:</strong> ${esc(v)}</li>`)
    .join("");

  const imdbUrl = "https://www.imdb.com/title/" + encodeURIComponent(m.imdbID);

  el.modalBody.innerHTML = `
    <div class="detail__hero">
      <img class="detail__poster" src="${esc(posterFor(m))}" data-fb="${esc(posterFallback(m.Title))}" alt="${esc(m.Title)} poster" />
      <div class="detail__meta">
        <h2 class="detail__title" id="modalTitle">${esc(m.Title)}</h2>
        <div class="detail__tags">
          ${m.Year && m.Year !== "N/A" ? `<span class="tag">${esc(m.Year)}</span>` : ""}
          ${m.Rated && m.Rated !== "N/A" ? `<span class="tag">${esc(m.Rated)}</span>` : ""}
          ${m.Runtime && m.Runtime !== "N/A" ? `<span class="tag">${esc(m.Runtime)}</span>` : ""}
          ${m.imdbRating && m.imdbRating !== "N/A" ? `<span class="tag tag--rating">★ ${esc(m.imdbRating)} IMDb</span>` : ""}
        </div>
        <div class="detail__genres">${genres}</div>
        <p class="detail__plot">${esc(m.Plot && m.Plot !== "N/A" ? m.Plot : "No plot available.")}</p>
        <ul class="detail__facts">${facts}</ul>
      </div>
    </div>
    <div class="detail__actions">
      <a class="btn btn--primary" href="${esc(imdbUrl)}" target="_blank" rel="noopener noreferrer">▶ View on IMDb</a>
      <button class="btn btn--ghost" data-close>Close</button>
    </div>`;
}

function closeModal() {
  el.modal.classList.remove("open");
  el.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// ---------- View helpers ----------
function resetView() {
  el.movies.innerHTML = "";
  el.head.hidden = true;
  el.pagination.hidden = true;
  el.status.textContent = "";
  el.status.className = "status";
  document.body.classList.remove("searching");
  state.results = [];
  state.totalResults = 0;
  state.page = 1;
  hideSuggestions();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function populateYears() {
  const opts = ['<option value="">Any</option>'];
  for (let y = CURRENT_YEAR; y >= 1950; y--) {
    opts.push(`<option value="${y}">${y}</option>`);
  }
  el.year.innerHTML = opts.join("");
}

// ---------- Events ----------
const debouncedSearch = debounce(() => runSearch(1), 300);

el.input.addEventListener("input", (e) => {
  const v = e.target.value;
  el.clear.hidden = !v;
  state.query = v;
  if (!v.trim()) {
    resetView();
    return;
  }
  debouncedSearch();
});

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  hideSuggestions();
  state.query = el.input.value;
  runSearch(1);
});

el.input.addEventListener("keydown", (e) => {
  if (el.suggest.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
  else if (e.key === "Enter" && activeIndex > -1) {
    e.preventDefault();
    const item = el.suggest.querySelectorAll(".suggestion")[activeIndex];
    if (item) openMovie(item.dataset.id);
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

el.input.addEventListener("focus", () => {
  if (el.input.value.trim() && el.suggest.innerHTML) {
    el.suggest.hidden = false;
    el.input.setAttribute("aria-expanded", "true");
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) hideSuggestions();
});

el.suggest.addEventListener("click", (e) => {
  const item = e.target.closest(".suggestion");
  if (item) openMovie(item.dataset.id);
});

el.clear.addEventListener("click", () => {
  el.input.value = "";
  el.clear.hidden = true;
  state.query = "";
  resetView();
  el.input.focus();
});

el.chips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  el.input.value = chip.dataset.q;
  el.clear.hidden = false;
  state.query = chip.dataset.q;
  runSearch(1);
});

// filters
el.year.addEventListener("change", () => {
  state.year = el.year.value;
  runSearch(1); // year is server-side → refetch from page 1
});
el.genre.addEventListener("change", () => {
  state.genre = el.genre.value;
  applyView();
});
el.sort.addEventListener("change", () => {
  state.sort = el.sort.value;
  applyView();
});

// pagination
el.pagination.addEventListener("click", (e) => {
  const btn = e.target.closest(".page-btn");
  if (!btn || btn.disabled) return;
  const page = parseInt(btn.dataset.page, 10);
  if (page && page !== state.page) {
    runSearch(page);
    window.scrollTo({ top: el.head.offsetTop - 80, behavior: "smooth" });
  }
});

// carousels (delegated across all rows)
el.browse.addEventListener("click", (e) => {
  const arrow = e.target.closest(".row__arrow");
  if (arrow) {
    const track = document.getElementById(arrow.dataset.target);
    if (track) track.scrollBy({ left: 440 * Number(arrow.dataset.dir), behavior: "smooth" });
    return;
  }
  const card = e.target.closest(".row__card");
  if (card) openMovie(card.dataset.id);
});
el.browse.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".row__card");
    if (card) { e.preventDefault(); openMovie(card.dataset.id); }
  }
});

// results grid
el.movies.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openMovie(card.dataset.id);
});
el.movies.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".card");
    if (card) { e.preventDefault(); openMovie(card.dataset.id); }
  }
});

el.modal.addEventListener("click", (e) => {
  if (e.target.matches("[data-close], .modal__backdrop")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.modal.classList.contains("open")) closeModal();
});

// CSP-friendly image fallback: swap to generated template on load error
// (replaces inline onerror handlers; error events don't bubble, so capture).
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (
      img &&
      img.tagName === "IMG" &&
      img.dataset.fb &&
      img.dataset.fbApplied !== "1"
    ) {
      img.dataset.fbApplied = "1";
      img.src = img.dataset.fb;
    }
  },
  true
);

// ---------- Parallax background ----------
let parallaxFrame = null;
function updateParallax(mx, my) {
  if (parallaxFrame) return;
  parallaxFrame = requestAnimationFrame(() => {
    if (mx != null) {
      el.bgFx.style.setProperty("--mx", mx.toFixed(3));
      el.bgFx.style.setProperty("--my", my.toFixed(3));
    }
    el.bgFx.style.setProperty("--sy", String(window.scrollY));
    parallaxFrame = null;
  });
}
window.addEventListener("mousemove", (e) => {
  updateParallax(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
});
window.addEventListener("scroll", () => updateParallax(null, null), { passive: true });

// ---------- PWA: install prompt + service worker ----------
const installBtn = document.getElementById("installBtn");
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // stop the mini-infobar; show our own button
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  installBtn.hidden = true;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  if (installBtn) installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Init ----------
window.addEventListener("DOMContentLoaded", () => {
  populateYears();
  el.input?.focus();
  loadBrowseRows();
});
