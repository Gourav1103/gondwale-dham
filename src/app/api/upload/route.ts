import { NextResponse } from "next/server";
import { api, fail, optionalName } from "@/lib/server/http";
import { saveFile } from "@/lib/server/storage";
import type { ImageItem } from "@/lib/types";

const MAX_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Uploads ONE image to storage and returns its details.
 * The UI then attaches the returned image to an idea or a Shakti Peeth.
 * Form fields: file (required), folder ("ideas" | "peeths/<number>"), addedBy (optional)
 */
export const POST = api(async (req) => {
  const form = await req.formData().catch(() => {
    throw fail(400, "Invalid upload.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw fail(400, "No image selected.");
  const ext = EXT[file.type];
  if (!ext) throw fail(400, `"${file.name}" is not a supported image (use JPG, PNG, WEBP or GIF).`);
  if (file.size > MAX_BYTES) throw fail(400, `"${file.name}" is too large (max 15 MB).`);

  const rawFolder = String(form.get("folder") || "misc").toLowerCase();
  const folder = /^(ideas|peeths\/[a-z0-9-]{1,40}|misc)$/.test(rawFolder) ? rawFolder : "misc";

  const id = crypto.randomUUID();
  const stored = await saveFile(folder, `${id}.${ext}`, Buffer.from(await file.arrayBuffer()));

  const image: ImageItem = {
    id,
    ...stored,
    name: file.name.slice(0, 200) || undefined,
    addedBy: optionalName(form.get("addedBy")),
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(image, { status: 201 });
});
