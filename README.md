# Shyam Invoice (Repo Template)

Files:
- docs/index.html     -> The invoice web app (GitHub Pages)
- inventory.json      -> Current inventory (merged)
- invoices/           -> Saved invoices (JSON files)
- api/index.js        -> Serverless API (for Vercel) to commit invoices/inventory to GitHub
- package.json        -> server dependencies

How to use:
1. Create a GitHub repo and push these files.
2. Deploy `api/` to Vercel (or Netlify Functions) and set environment variables:
   - GH_PAT (Personal Access Token with repo access)
   - OWNER (your GitHub username or org)
   - REPO (repo name)
3. Update `API_BASE` in docs/index.html to your deployed API URL.
4. Enable GitHub Pages from `docs/` folder (Settings > Pages).

Security: Keep GH_PAT secret; never put it in client-side code.
