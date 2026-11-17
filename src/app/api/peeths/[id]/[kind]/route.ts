import { NextResponse } from "next/server";
import { peethsCollection, serializePeeth, storeImage, storeLink, toObjectId } from "@/lib/server/db";
import { api, cleanImages, cleanLink, clientUuid, fail, optionalName, readJson, text } from "@/lib/server/http";

type Ctx = RouteContext<"/api/peeths/[id]/[kind]">;

/**
 * Add items to a Shakti Peeth:
 *   POST /api/peeths/:id/images  { images: ImageItem[] }   (images already uploaded via /api/upload)
 *   POST /api/peeths/:id/links   { url, title?, addedBy? }
 *   POST /api/peeths/:id/notes   { text, addedBy? }
 * Uses $push, so two people adding at the same time never overwrite each other.
 * Items carry ids made on the device; an item whose id is already there is not added again,
 * so a retried request never creates a duplicate.
 */
export const POST = api<Ctx>(async (req, ctx) => {
  const { id, kind } = await ctx.params;
  const _id = toObjectId(id);
  if (!_id) throw fail(404, "This Shakti Peeth was not found.");
  const body = await readJson(req);
  const now = new Date();

  let push: Record<string, unknown>;
  let ids: string[];
  if (kind === "images") {
    const images = cleanImages(body.images);
    if (!images.length) throw fail(400, "No images to add.");
    push = { images: { $each: images.map(storeImage) } };
    ids = images.map((i) => i.id);
  } else if (kind === "links") {
    const link = storeLink({ ...cleanLink(body), createdAt: now.toISOString() });
    push = { links: link };
    ids = [link.id];
  } else if (kind === "notes") {
    const noteId = clientUuid(body.id) ?? crypto.randomUUID();
    ids = [noteId];
    push = {
      notes: {
        id: noteId,
        text: text(body.text, 20000, "Note", true),
        addedBy: optionalName(body.addedBy),
        createdAt: now,
        updatedAt: now,
      },
    };
  } else {
    throw fail(404, "Unknown section.");
  }

  const col = await peethsCollection();
  const doc = await col.findOneAndUpdate(
    { _id, [`${kind}.id`]: { $nin: ids } },
    { $push: push, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  if (doc) return NextResponse.json(serializePeeth(doc), { status: 201 });

  // Nothing matched: either the item is already there (a retry) or the peeth is gone.
  const existing = await col.findOne({ _id });
  if (!existing) throw fail(404, "This Shakti Peeth was not found. It may have been deleted.");
  return NextResponse.json(serializePeeth(existing));
});
