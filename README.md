# 🎬 Movie Finder

A fast, Netflix-style movie & series search app built with **vanilla JavaScript** — no frameworks, no build step. Search thousands of titles instantly, browse curated category rows, view rich detail pages, and install it as a Progressive Web App.

🔗 **Live:** [movies-series-finder.netlify.app](https://movies-series-finder.netlify.app/)

![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e) ![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8) ![No build step](https://img.shields.io/badge/build-none-brightgreen)

---

## ✨ Features

- **Live search with autocomplete** — debounced search-as-you-type with a suggestions dropdown (poster thumbnails, highlighted matches, keyboard ↑/↓/Enter navigation).
- **Netflix-style UI** — dark theme, red accent, hero section, hover-zoom poster cards, and a slick detail **modal** (no page reloads).
- **Browse rows on the home page** — curated carousels: 🔥 Hot in 2026, ⭐ Top Rated, 📺 Bingeworthy Series, and 💥 Action & Adventure. Each loads in parallel and only shows titles with valid posters.
- **Filters & sorting** — filter by **Year** (server-side via OMDb) and **Genre** (client-side), and sort by Rating, Year, or Title.
- **Pagination** — server-backed paging through large result sets (10/page), shown only once results are populated.
- **Generated poster fallback** — missing/broken posters render a branded SVG placeholder with the title, a film-reel icon, and a "Poster Unavailable" label.
- **Dynamic parallax background** — drifting colored orbs that respond to mouse movement and scroll (respects `prefers-reduced-motion`).
- **Installable PWA** — web manifest, app icons, and a service worker for offline support and an "Install" button.
- **Fully responsive** — adaptive layouts for desktop, tablet, and phones, including a full-screen modal sheet and swipeable carousels on touch devices.

---

## 🚀 Performance

The app prioritizes speed and a snappy feel:

- **Native `fetch`** instead of axios/jQuery (smaller payload, faster load).
- **In-memory + `sessionStorage` cache** — repeat searches and detail views are instant.
- **`AbortController`** cancels stale in-flight searches so only the latest query renders.
- **Parallel enrichment** — per-result ratings/genres are fetched concurrently.
- **Service worker caching** — stale-while-revalidate for API data, cache-first for posters and static assets.
- **Lazy-loaded images** and `preconnect` hints to the API/font hosts.

---

## 🔒 Security

- **Content-Security-Policy** restricting scripts to `'self'`, API connections to OMDb only, and blocking framing/objects.
- **No inline event handlers** — image fallbacks use a delegated error listener so the strict CSP holds.
- **HTML escaping** on every API field interpolated into the DOM (defense-in-depth against XSS).
- External links use `rel="noopener noreferrer"`.

> ⚠️ **Note:** The OMDb API key lives in `main.js` — unavoidable for a static front-end with no backend. It's a free, rate-limited key. To hide it, add a small serverless proxy (e.g. a Netlify Function).

---

## 🗂️ Project Structure

```
moviefinder/
├── index.html            # Markup, CSP, PWA meta, layout
├── style.css             # All styling (theme, grid, modal, parallax, responsive)
├── main.js               # App logic (search, filters, carousels, modal, PWA)
├── movie.html            # Legacy detail page → redirects to index (details now in a modal)
├── manifest.webmanifest  # PWA manifest (name, icons, theme, display)
├── sw.js                 # Service worker (offline shell + runtime caching)
├── icons/                # PWA + favicon icons (192/512/maskable/apple-touch + SVG source)
└── README.md
```

---

## 🛠️ Tech Stack

| Area        | Choice                                              |
|-------------|-----------------------------------------------------|
| Language    | Vanilla JavaScript (ES2020+), HTML5, CSS3           |
| Data        | [OMDb API](https://www.omdbapi.com/)                |
| Fonts       | Poppins (Google Fonts)                              |
| PWA         | Web App Manifest + Service Worker                   |
| Hosting     | Netlify (static)                                    |
| Build step  | None — plain static files                           |

---

## ▶️ Running Locally

Because the app uses a service worker and `fetch`, serve it over HTTP (not `file://`). Any static server works:

```bash
# Node
npx serve -l 8000 .

# or Python 3
python -m http.server 8000
```

Then open **http://localhost:8000**. `localhost` counts as a secure context, so the PWA/service worker will work.

---

## 📦 Deployment

It's a static site — deploy the folder as-is. On Netlify, just connect the repo (no build command, publish directory = root). The PWA requires HTTPS, which Netlify provides automatically.

> When updating assets, bump the `?v=` query strings in `index.html` and the `VERSION` constant in `sw.js` together so clients pick up the new version cleanly.

---

## 🧩 How It Works

1. **Search** → `OMDb ?s=<query>` returns up to 10 results per page; the UI renders cards immediately.
2. **Enrich** → each result's full details (rating, genre) are fetched in parallel to power badges and the Genre/Rating filters.
3. **Detail** → clicking a card fetches `OMDb ?i=<imdbID>&plot=full` and opens the modal.
4. **Browse rows** → curated title lists are fetched by title (`?t=`), keeping only those with posters.
5. **Caching** → every API response is cached in memory + `sessionStorage`, and again by the service worker for offline use.

---

## 💡 Possible Improvements

- Serverless proxy to hide the API key (and tighten CSP to `connect-src 'self'`).
- Migrate to **TMDb** for real trending data, backdrops, cast, and trailers.
- Deep-linkable URLs (`?q=...&page=...`) and modal history for shareable links.
- Focus-trap in the modal and richer ARIA live announcements.

---

## 📄 Credits

Built by **Parth** · Movie data from the [OMDb API](https://www.omdbapi.com/).
