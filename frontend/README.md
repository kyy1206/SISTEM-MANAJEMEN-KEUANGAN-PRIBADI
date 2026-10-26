# Bocor Halus Frontend

React and Vite frontend for the Bocor Halus personal-finance application.

## Run locally

Install dependencies with `npm install`, then start the frontend with `npm run dev`. Start the Laravel API separately; the default API URL is `http://localhost:8000/api`. Set `VITE_API_URL` when the API is hosted elsewhere.

Run `npm run lint` and `npm run build` to validate the frontend. Use `npm run preview` to serve the production build locally.

## Progressive Web App

The production build includes `manifest.webmanifest`, an SVG app icon, and a Service Worker. The app can be installed from a supported browser when served over HTTPS or from `localhost`. The Service Worker caches the application shell and Vite's static build assets so app routes can open offline after the first successful load.

API requests and authenticated user data are not cached. Offline mode therefore supports opening the app shell, but data that requires the backend remains unavailable until the connection returns. Development mode does not register the Service Worker.

The Service Worker cache is versioned in `public/service-worker.js`. Increment `CACHE_NAME` when changing the cache strategy or shell assets during a release so clients move to the new cache.
