# Deployment

## Recommended production setup

### 1. Create a PostgreSQL database
Use Supabase, Neon, Railway, Render PostgreSQL, or another managed Postgres provider.

### 2. Push this folder to GitHub
Create a repository and push the project root.

### 3. Deploy to Vercel
Import the repository into Vercel. Set these environment variables:

- `SECRET_KEY` = a long random secret
- `DATABASE_URL` = your PostgreSQL connection string

The included `vercel.json` routes requests to the Flask entrypoint.

### 4. Test the production flow
Register a new account, log out, register a second account, and confirm each account sees only its own transactions.

### Important
Do not use local SQLite as the final public database on serverless hosting because local serverless storage is not a durable data store.
