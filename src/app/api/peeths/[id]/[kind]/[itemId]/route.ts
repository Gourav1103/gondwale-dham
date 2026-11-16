import { NextResponse } from "next/server";
import { peethsCollection, serializePeeth, toObjectId } from "@/lib/server/db";
import { api, cleanUrl, fail, readJson, text } from "@/lib/server/http";
import { deleteFile } from "@/lib/server/storage";

type Ctx = RouteContext<"/api/peeths/[id]/[kind]/[itemId]">;
const KINDS = ["images", "links", "notes"] as const;
type Kind = (typeof KINDS)[number];

async function target(ctx: Ctx) {
  const { id, kind, itemId } = await ctx.params;
  const _id = toObjectId(id);
  if (!_id) throw fail(404, "This Shakti Peeth was not found.");
  if (!KINDS.includes(kind as Kind)) throw fail(404, "Unknown section.");
  return { _id, kind: kind as Kind, itemId };
}

/** Edit one link ({ url?, title? }) or one note ({ text }). Uses a positional update ($). */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const { _id, kind, itemId } = await target(ctx);
  const body = await readJson(req);
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };

  if (kind === "links") {
    if ("url" in body) set["links.$.url"] = cleanUrl(body.url);
    if ("title" in body) set["links.$.title"] = text(body.title, 200, "Link title") || null;
  } else if (kind === "notes") {
    set["notes.$.text"] = text(body.text, 20000, "Note", true);
    set["notes.$.updatedAt"] = now;
  } else {
    throw fail(400, "Images cannot be edited — delete and upload again.");
  }

  const doc = await (await peethsCollection()).findOneAndUpdate(
    { _id, [`${kind}.id`]: itemId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!doc) throw fail(404, "This item was not found. Someone may have deleted it.");
  return NextResponse.json(serializePeeth(doc));
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const { _id, kind, itemId } = await target(ctx);
  const col = await peethsCollection();
  // Read the old item first (to know which image file to delete), then pull it atomically.
  const before = await col.findOne({ _id }, { projection: { [kind]: 1 } });
  if (!before) throw fail(404, "This Shakti Peeth was not found. It may have been deleted.");

  const doc = await col.findOneAndUpdate(
    { _id },
    { $pull: { [kind]: { id: itemId } }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!doc) throw fail(404, "This Shakti Peeth was not found. It may have been deleted.");

  if (kind === "images") {
    const img = before.images?.find((i) => i.id === itemId);
    if (img) await deleteFile(img.path, img.sha);
  }
  return NextResponse.json(serializePeeth(doc));
});
