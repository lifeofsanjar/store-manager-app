# Store Manager Backend

The backend uses Django, Django REST Framework, and SQLite. Its application data is stored in the eight tables described in the repository's `AGENTS.md`.

## Local setup

From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py create_shop_user --login owner --name "Shop Owner" --role owner
python manage.py runserver
```

Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, and `DJANGO_ALLOWED_HOSTS` in the process environment or deployment settings. Set `SQLITE_BACKUP_DIR` to a cloud storage path mounted or synced on the host, outside the project directory. The backup command keeps the 7 newest copies. For local PowerShell, for example:

```powershell
$env:DJANGO_SECRET_KEY = 'local-development-secret'
$env:DJANGO_DEBUG = 'true'
$env:DJANGO_ALLOWED_HOSTS = 'localhost,127.0.0.1'
# Replace this with the path mounted or synced by the chosen cloud provider.
$env:SQLITE_BACKUP_DIR = 'R:\StoreManagerCloud\backups'
```

Use a long random secret before deployment and set `DJANGO_DEBUG=false` in production. The backend refuses to start in production without `DJANGO_SECRET_KEY`.

The user creation command prompts for a password twice and stores it using Django's password hashing. Repeat it with `--role staff` to create each staff login.

## Django Admin

After migrations, open `http://127.0.0.1:8000/admin/` while the backend server is running. Sign in with the separate Django administrator login, not a normal owner or staff app login. Create another administrator with `python manage.py createsuperuser`.

The admin lists store data for review and keeps business records read-only so stock, sales, payments, and returns continue to be changed through the app's validated workflows.

## API routes

All routes are under `/api/`. Login returns a short-lived bearer token; send it in `Authorization: Bearer <token>` for protected routes.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login/` | Public | Authenticate with login and password. |
| GET | `/products/?q=...` or `/products/?barcode=...` | Owner and staff | Search active products. |
| POST | `/sales/` | Owner and staff | Record a sale and reduce stock. |
| GET | `/sales/today/` | Owner and staff | View today's sales. |
| GET | `/sales/{id}/` | Owner and staff | View a sale and remaining returnable quantities. |
| POST | `/sales/{id}/payments/` | Owner and staff | Record a part payment against debt. |
| POST | `/returns/` | Owner and staff | Return sold items and refund through the original payment method. |
| POST | `/restocks/` | Owner and staff | Receive existing stock or create a product with its initial stock. |
| PATCH | `/products/{id}/stock/` | Owner and staff | Set the current stock count; only the owner may also update `buy_price` and `sell_price`. |
| GET | `/statistics/?period=day`, `week`, or `month` | Owner only | View net sales, profit, receipt count, units sold, and the five best-selling products for the selected period. Product quantities and revenue exclude returned units. |
| GET | `/sales/debts/` | Owner only | List unpaid sales. |
| GET | `/low-stock/` | Owner only | List active products below minimum stock. |

Sale request example:

```json
{
  "items": [{"product_id": 1, "quantity": 2}],
  "payment_choice": "cash",
  "note": ""
}
```

For a debt sale, set `payment_choice` to `debt` and include the customer's name and phone in `note`. On returns, the backend reverses the most recent original payment method first; when a sale used both cash and card, it can create refund rows for both methods.

Restock an existing product with `product_id`, or create a product from the same screen with its basic details:

```json
{
  "items": [{
    "new_product": {
      "name": "Choy",
      "barcode": "1000002",
      "sell_price": 5000,
      "min_stock": 3
    },
    "quantity": 6,
    "buy_price": 3500
  }],
  "note": "Boshlang‘ich qoldiq"
}
```

## Daily backups

Run `python manage.py backup_sqlite` once per day from this directory. It creates a consistent SQLite copy, checks its integrity, and retains the 7 newest backups. `SQLITE_BACKUP_DIR` must point to a cloud-mounted or cloud-synced directory outside the project; a normal folder on the application server is not an off-server backup.

Configure the command in the host's scheduler:

- **Windows Task Scheduler:** create a daily task with the virtual environment's `python.exe`, argument `manage.py backup_sqlite`, and this directory as the working directory. Make `SQLITE_BACKUP_DIR` available to the task account through its environment or a small launch script.
- **Linux cron:** add a daily entry with the backend directory, virtual environment Python path, and `SQLITE_BACKUP_DIR` set to the cloud mount.

To restore, stop the app, keep a copy of the current `db.sqlite3`, replace it with the newest valid backup, then start the app. Check the restored file with SQLite's `PRAGMA integrity_check` before reopening the app.

## Manual demo data

For a local manual walkthrough, `python manage.py load_manual_demo --clear` replaces products and store activity with a small sample catalog, sales across several dates, restocks, returns, and partially paid debts. The command requires `--clear`, makes no user accounts changes, and should only be run against a development database. Take a database snapshot first if existing data may be needed.

## Verification

```powershell
python manage.py check
python manage.py test shop
```
