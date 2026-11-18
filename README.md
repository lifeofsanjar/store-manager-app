# Store Manager

Store Manager is a small sales and inventory system for one shop. It replaces a paper sales notebook with a web app used by staff at a laptop and by the owner on a phone. The shop-facing interface is in Uzbek Latin script.

## What it supports

- Search for products by name or barcode and record sales. A barcode scanner is optional.
- Apply a custom sale price to an individual item while retaining its standard product price.
- Record cash, card, or unpaid sales. Debt is calculated from payments and returns; part payments can be entered later.
- Record returns, restore inventory, and send refunds through the original payment method.
- Receive restocks, add new products during a restock, and update the latest buying price.
- Set a corrected stock count directly when a physical count differs.
- Give the owner sales and profit summaries, unpaid sales, and a low-stock list.

## Roles

- **Staff** can sell, restock, return items, update stock counts, record part payments, and see today's sales.
- **Owner** can do all staff tasks and view statistics, debts, and low-stock products. The backend enforces owner-only access to these views.

## Technology

- Frontend: React with plain JavaScript, Vite, and Tailwind CSS.
- Backend: Python, Django, and Django REST Framework.
- Database: SQLite.
- API and authentication: REST API with signed bearer tokens.

## Run locally

Set up the [backend](<backend/README.md>) first, then start the [frontend](<frontend/README.md>). The frontend proxies API requests to the Django development server.
