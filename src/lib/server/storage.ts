import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Image storage in a public GitHub repository (via the GitHub Contents API).
//
// Required env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
// Optional:          GITHUB_BRANCH (default "main"), GITHUB_UPLOAD_DIR (default "harihaat-2026")
//
// During local development without a GitHub token, files are saved to public/uploads instead,
// so the app can still be tried out. Production always requires GitHub.

export type StoredFile = { url: string; path: string; sha?: string };

const ROOT = (process.env.GITHUB_UPLOAD_DIR || "harihaat-2026").replace(/^\/+|\/+$/g, "");

function github() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

export function storageMode(): "github" | "local" | "missing" {
  if (github()) return "github";
  return process.env.NODE_ENV === "production" ? "missing" : "local";
}

/** Only paths we created can be deleted — protects the rest of the repository. */
export function isOurPath(p: string) {
  return typeof p === "string" && p.startsWith(`${ROOT}/`) && !p.includes("..");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gh(url: string, init: RequestInit, token: string) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "harihaat-decoration-app",
    },
    cache: "no-store",
  });
}

export async function saveFile(folder: string, fileName: string, bytes: Buffer): Promise<StoredFile> {
  const month = new Date().toISOString().slice(0, 7);
  const filePath = `${ROOT}/${folder}/${month}/${fileName}`;
  const cfg = github();

  if (!cfg) {
    if (storageMode() === "missing") {
      throw new Error("Image storage is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.");
    }
    const abs = path.join(process.cwd(), "public", "uploads", filePath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    return { url: `/uploads/${filePath}`, path: filePath };
  }

  const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(filePath)}`;
  const body = JSON.stringify({
    message: `Add image ${filePath}`,
    content: bytes.toString("base64"),
    branch: cfg.branch,
  });

  // Several people uploading at once can make GitHub reply 409 (branch moved). Retry a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await gh(api, { method: "PUT", body }, cfg.token);
    if (res.ok) {
      const json = (await res.json()) as { content: { sha: string } };
      return {
        url: `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${encodeURI(filePath)}`,
        path: filePath,
        sha: json.content.sha,
      };
    }
    // 422 = the file is already there: an earlier try of this same upload got through,
    // but its answer never reached the device. Return that file instead of failing.
    if (res.status === 422) {
      const info = await gh(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { method: "GET" }, cfg.token);
      if (info.ok) {
        return {
          url: `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${encodeURI(filePath)}`,
          path: filePath,
          sha: ((await info.json()) as { sha: string }).sha,
        };
      }
    }
    if (res.status === 409 && attempt < 3) {
      await sleep(400 * (attempt + 1) + Math.random() * 300);
      continue;
    }
    const text = await res.text();
    console.error("GitHub upload failed", res.status, text);
    throw new Error(
      res.status === 401 || res.status === 403
        ? "GitHub refused the upload. Check that GITHUB_TOKEN has write access to the repository."
        : `GitHub upload failed (${res.status}).`,
    );
  }
  throw new Error("GitHub upload failed after several tries.");
}

/** Best-effort delete. Never throws: a missing file should not block deleting the record. */
export async function deleteFile(filePath: string, sha?: string) {
  if (!isOurPath(filePath)) return;
  const cfg = github();
  try {
    if (!cfg) {
      if (storageMode() === "local") await unlink(path.join(process.cwd(), "public", "uploads", filePath));
      return;
    }
    const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(filePath)}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      let fileSha = sha;
      if (!fileSha || attempt > 0) {
        const info = await gh(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { method: "GET" }, cfg.token);
        if (info.status === 404) return;
        fileSha = ((await info.json()) as { sha: string }).sha;
      }
      const res = await gh(
        api,
        { method: "DELETE", body: JSON.stringify({ message: `Remove image ${filePath}`, sha: fileSha, branch: cfg.branch }) },
        cfg.token,
      );
      if (res.ok || res.status === 404) return;
      if (res.status === 409 || res.status === 422) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      console.error("GitHub delete failed", res.status, await res.text());
      return;
    }
  } catch (err) {
    console.error("Could not delete stored image", filePath, err);
  }
}

/** Deletes several files one after another (GitHub commits must not run in parallel). */
export async function deleteFiles(files: { path: string; sha?: string }[]) {
  for (const f of files) await deleteFile(f.path, f.sha);
}
