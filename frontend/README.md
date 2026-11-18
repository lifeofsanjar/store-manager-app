# Store Manager Frontend

The frontend is a React application written in plain JavaScript, built with Vite and styled with Tailwind CSS. All shop-facing interface text is kept in `src/text.js` and written in Uzbek Latin script.

## Local setup

```powershell
npm install
npm run dev
```

Start the Django backend on `http://127.0.0.1:8000` as described in `backend/README.md`. The Vite development server proxies `/api` requests to it.

Create a production bundle with:

```powershell
npm run build
```
