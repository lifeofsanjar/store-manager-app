# AGENTS.md

Instructions for AI coding agents working on this project. Read this file fully before writing any code.

## 1. Project summary

A small sales system for ONE small shop in a border city. Two people use it:

- **Owner** - uses a phone (browser) to see statistics.
- **Staff** - uses one laptop with a barcode scanner to sell, restock and return items.

The shop currently uses paper. The system replaces the paper notebook. It is hosted online by the developer. The shop has stable internet.

**Core principle: keep it as simple and as small as possible.** New features will be added later, one at a time. Do not build anything that is not described in this file.

## 2. Stack

- Frontend: React.js (built with Vite) + Tailwind CSS (web app, must work well on a phone screen for the owner and on a laptop for staff)
- Backend: Django + Django REST Framework (JSON API used by the React frontend)
- Database: SQLite
- UI language: Uzbek, Latin script (all text the shop sees is in Uzbek)
- Single shop only. NOT multi-tenant. No `store_id` anywhere.

## 3. Users and roles

Only two roles, stored in `users.role`: `owner` and `staff`.

- **staff**: sell, restock, return items, see what was sold today.
- **owner**: everything staff can do, plus statistics (sales, profit, debts, low stock, etc.).
- Staff must NOT be able to open the statistics screens. Enforce this in the backend (permissions on the API), not only by hiding buttons in the frontend.
- Both owner and staff can see buying prices (`buy_price`). Profit and all statistics are owner-only.
- Login is username and password only (no phone codes, no social login). Use Django's built-in secure password hashing and never store plain passwords.

## 4. Data model (8 tables)

All money is stored as **whole integers in so'm** (one currency). All quantities are **whole numbers** (the shop sells by pieces only). Never use floats for money or quantity.

```
users
  id, name, login, password_hash, role ('owner' | 'staff'), is_active

products
  id, name, barcode (unique), sell_price, buy_price (latest),
  stock_qty, min_stock, is_active

sales
  id, user_id -> users, total_amount, note, created_at

sale_items
  id, sale_id -> sales, product_id -> products,
  quantity, unit_price (price actually charged), buy_price (copied at time of sale)

payments
  id, sale_id -> sales, method ('cash' | 'card'), amount, paid_at
  (amount may be negative: a refund of money already paid)

returns
  id, sale_item_id -> sale_items, user_id -> users,
  quantity, refund_amount, created_at

restocks
  id, user_id -> users, note, created_at

restock_items
  id, restock_id -> restocks, product_id -> products, quantity, buy_price
```

Relationships:

- one user -> many sales, restocks, returns
- one sale -> many sale_items and many payments
- one product -> many sale_items and restock_items
- one sale_item -> many returns
- one restock -> many restock_items

## 5. Business rules

**Selling**
- Staff add items to a sale by typing or scanning a barcode, or by searching the product name. The barcode scanner is OPTIONAL: the system must work fully without one. Every product has a barcode saved.
- Each product has one fixed `sell_price` for everyone.
- The owner can update a product's current `sell_price` and latest `buy_price` from the stock screen. These changes apply to future sales only; every sale keeps the buying price copied when it was created. Staff can edit stock counts but cannot change product prices.
- A "custom price" button lets staff type a different price for an item in a sale. The price actually charged is saved in `sale_items.unit_price`. `products.sell_price` is never changed by a sale.
- On every sale item, copy the product's current `buy_price` into `sale_items.buy_price` so profit stays correct if buying prices change later.
- Reduce `products.stock_qty` when a sale is saved.

**Payment and debt**
- Payment methods in the database are only `cash` and `card`.
- Staff may choose cash, card, or debt on the sale screen and must confirm. "Debt" is NOT a payment method: it simply means the sale is not fully paid.
- Debt is never stored. Always compute it:
  `debt = sale.total_amount - sum(returns.refund_amount for that sale's items) - sum(payments.amount for that sale)`
- Customers can pay a debt in parts. Each part payment is a new row in `payments` for the same sale.
- There is NO customers table. For a sale with any unpaid amount, staff must write the customer's name and phone number in `sales.note`. The backend must reject a sale with debt and an empty note.
- The owner sees debts as a list of unpaid sales: date/time, unpaid amount, and note. No totals per person.

**Returns**
- Staff return single items from a sale (returning every item = cancelling the sale). There is no separate cancel flag.
- A return adds the returned `quantity` back to `products.stock_qty` and saves `refund_amount = quantity * sale_item.unit_price`.
- Returned quantity for a sale item can never exceed its sold quantity minus what was already returned.
- If a return requires cash back, record negative `payments` row(s) using the original payment method(s). Reverse the newest positive payment method first; split a refund across methods only when needed.
- Stats and profit count `quantity - returned quantity`.

**Restocking**
- Restock records quantity and buying price per product.
- It increases `stock_qty` and updates `products.buy_price` to the latest buying price.
- Restocking is done by staff. Starting stock (from paper) is entered by the staff member through the same restock screen. Staff can create a product there by entering its name, barcode, sell price, and initial stock details.
- A wrong stock count is fixed by directly editing `stock_qty` on the product. There is no correction history table (developer decision).

**Statistics (owner only)**
- Sales total and profit per day, per week, per month.
- Debts list (see above).
- Low stock: `stock_qty < min_stock`.
- Other reports that come directly from the existing tables are welcome if they are small: best-selling products, sales per staff member, cash vs card totals, sales where `unit_price` differs from `sell_price`.
- Profit = sum of `(unit_price - buy_price) * (quantity - returned quantity)`.

## 6. Screens

Staff (laptop):
1. Sale screen (barcode or name input, item list, custom price button, payment choice, note, confirm)
2. Restock screen
3. Return screen
4. Today's sales
5. Edit stock count (direct edit of `stock_qty`)

Owner (phone):
1. Statistics (day / week / month, profit)
2. Debts list
3. Low stock list

## 7. Not in scope (do not build unless asked)

Customers table, per-customer or friend prices, categories, suppliers, discounts, delivery, offline mode, native mobile app, multi-store support, stock correction history.

## 8. Open decisions - ASK the developer, do not guess

- Backup retention is 7 copies in cloud storage. The deployment host and provider are not selected yet. At deployment, set `SQLITE_BACKUP_DIR` to a cloud-mounted or cloud-synced location outside the application server; do not substitute a local server folder.

If anything else is unclear, ask before building.

## 9. Engineering rules

- Stock changes, payments and returns must happen inside a database transaction. A failed sale must not leave half-updated stock.
- Keep business logic (debt calculation, profit, return limits) in one place in the backend, not scattered across views and the frontend.
- Add tests for money and stock logic: sales, custom price, part payments, returns of single items, refunds, debt calculation.
- Backups are required: the SQLite database must be backed up automatically every day to a location outside the server that runs the app. Keep several recent copies, never only one, and write a short note on how to restore from a backup. A backup stored only on the same disk as the database does not count.
- Keep all UI text (Uzbek) in one place instead of spreading it across components, so it is easy to change.
- Do not add libraries, tables, columns or features that are not in this file without asking.
- Prefer the simplest solution that works. If a task seems to need a bigger design, stop and ask.

## 10. Workflow

- Work in small phases and continue between phases unless blocked by an unresolved decision that affects the next change. Summarize progress when the requested work is complete or such a decision blocks further work.
- The developer reviews all generated code and tests it by hand. Do not claim something works unless it was run.
- If requirements are unclear or conflict with this file, ask a question instead of making up an answer.
- If you change the data model or a business rule, update this file in the same change.
