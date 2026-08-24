# Cashflow — Premium Personal Finance Workspace

A full-stack personal finance application built with **Python Flask + SQLAlchemy + SQLite/PostgreSQL + HTML/CSS/JavaScript**.

## What makes this version different

- Every user starts with a clean workspace — no fake balance or seeded demo transactions.
- Registration and login happen **before** the private dashboard.
- Each API query is scoped to the signed-in user's ID.
- Passwords are hashed with Werkzeug.
- Add, view and delete real income/expense transactions.
- Monthly budgets and category spend tracking.
- Charts and insights generated from the user's own activity.
- CSV export for the selected month.
- Profile + currency settings.
- Responsive, mobile-friendly premium UI.

## Run locally (Windows / VS Code)

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000**.

## Production database

Local development uses SQLite automatically.
For production, set `DATABASE_URL` to a PostgreSQL database such as Supabase:

```text
postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

Also set a strong `SECRET_KEY`.

## Vercel note

The Flask app is deployable as a Python serverless application, but **SQLite on serverless storage is not a durable production database**. For a real public deployment, connect this app to PostgreSQL/Supabase with `DATABASE_URL`.

The project includes `vercel.json` and `api/index.py` for a Vercel deployment layout.

## Deployment files

- `vercel.json` — Vercel route configuration
- `api/index.py` — Vercel entrypoint
- `DEPLOYMENT.md` — deployment steps
- `.env.example` — environment variables
