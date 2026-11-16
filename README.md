# Harihaat 2026 – Decoration & Idea Management

Web app for **Shree Gondawale Dham, Indore** to plan the Harihaat 2026 decoration on the theme of the **51 Shakti Peeths**.

- **Idea Contributor**: share, search, edit and delete decoration ideas, each with photos and reference links.
- **Decoration Management**: all 51 Shakti Peeths (in Hindi). Each one has editable basic info, a photo gallery, reference links and notes.
- Password-protected entry (default password: `shri ram`).
- Works on phones, tablets and desktops.

Built with **Next.js 16** (frontend and API in one app), **MongoDB** for data, a **public GitHub repo** for images, and **IndexedDB** caching in the browser.

---

## 1. Run it on your computer

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local      # then edit .env.local (see below)
npm run dev                      # open http://localhost:3000
```

The 51 Shakti Peeths are added to the database automatically the first time the app opens.
They are added **only once**. After that, edit everything from the app.

If no `GITHUB_*` values are set during local development, photos are saved to `public/uploads` so you can try the app without a token.
In production a GitHub repository is required.

## 2. Settings (`.env.local`)

| Variable | What it is |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster is enough. |
| `MONGODB_DB` | Database name (default `harihaat2026`). |
| `APP_PASSWORD` | Entry password (default `shri ram`). Capital letters and extra spaces are ignored. |
| `AUTH_SECRET` | Long random text used to sign the login cookie. Generate one with `openssl rand -hex 32`. If you change it, everyone has to log in again. |
| `GITHUB_TOKEN` | GitHub token that can write to the image repo (see below). |
| `GITHUB_OWNER` / `GITHUB_REPO` | Owner and name of the **public** image repository. |
| `GITHUB_BRANCH` | Branch to store images in (default `main`). |
| `GITHUB_UPLOAD_DIR` | Folder inside that repo (default `harihaat-2026`). |

### Setting up the GitHub image repository

1. Create a new **public** repository, e.g. `harihaat-2026-images`, with a README so the `main` branch exists.
2. Go to GitHub → *Settings → Developer settings → Fine-grained personal access tokens → Generate new token*.
   - Repository access: *Only select repositories* → your image repo.
   - Permissions → *Contents*: **Read and write**.
3. Put the token, your username and the repo name in `.env.local`.

Photos are shrunk in the browser before upload (max 2000 px, WebP), so a typical phone photo becomes about 300–600 KB.
Deleting a photo, idea or Shakti Peeth in the app also deletes the image files from GitHub.

## 3. Deploy

The easiest option is **Vercel**:

1. Push this project to a GitHub repository (a different one from the image repo).
2. Import it on vercel.com.
3. Add all the variables from section 2 under *Project → Settings → Environment Variables*.
4. In MongoDB Atlas → *Network Access*, allow `0.0.0.0/0` (Vercel servers have changing IP addresses).

Any host that runs Node.js also works: `npm run build && npm start`.

## 4. How the code is organised

```
src/
  proxy.ts                    password check on every page and API call
  app/
    login/                    entry screen
    (app)/                    pages behind the password (home, ideas, peeths)
    api/
      auth/                   login / logout
      upload/                 uploads one image to GitHub
      ideas/                  ideas: list, create, read, update, delete
      peeths/                 Shakti Peeths, plus /[id]/images|links|notes
  components/
    views/                    one component per page
    images/  links/  ui/      reusable pieces (gallery, link cards, buttons, dialogs…)
  lib/
    server/                   MongoDB, GitHub storage, auth, input checks
    client/                   API calls, IndexedDB cache, image compression
    seed-data.ts              initial 51 Shakti Peeths (Hindi)
```

**Data model (MongoDB)**

- `ideas`: `{ title, description, links[], images[], addedBy, createdAt, updatedAt }`
- `peeths`: `{ number, name, place, description, images[], links[], notes[], createdAt, updatedAt }`

Images, links and notes on a Shakti Peeth are changed with atomic updates (`$push`, `$pull` and the positional `$`).
So when several team members add things at the same time, nobody's change overwrites anyone else's.

**Caching:** pages first show data saved in the browser (IndexedDB), so they appear instantly.
The app then checks the server in the background and also when you come back to the tab.
Every change updates the cache straight from the server's reply. MongoDB is always the source of truth.

**Names:** there are no user accounts. Each person can set their name from the top bar; it is saved on that device and shown as "Added by …".
