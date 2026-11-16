import { NextResponse } from "next/server";
import { peethsCollection, serializePeeth, storeImage, storeLink, toObjectId } from "@/lib/server/db";
import { api, cleanImages, cleanLink, fail, optionalName, readJson, text } from "@/lib/server/http";

type Ctx = RouteContext<"/api/peeths/[id]/[kind]">;

/**
 * Add items to a Shakti Peeth:
 *   POST /api/peeths/:id/images  { images: ImageItem[] }   (images already uploaded via /api/upload)
 *   POST /api/peeths/:id/links   { url, title?, addedBy? }
 *   POST /api/peeths/:id/notes   { text, addedBy? }
 * Uses $push, so two people adding at the same time never overwrite each other.
 */
export const POST = api<Ctx>(async (req, ctx) => {
  const { id, kind } = await ctx.params;
  const _id = toObjectId(id);
  if (!_id) throw fail(404, "This Shakti Peeth was not found.");
  const body = await readJson(req);
  const now = new Date();

  let push: Record<string, unknown>;
  if (kind === "images") {
    const images = cleanImages(body.images);
    if (!images.length) throw fail(400, "No images to add.");
    push = { images: { $each: images.map(storeImage) } };
  } else if (kind === "links") {
    push = { links: storeLink({ ...cleanLink(body), createdAt: now.toISOString() }) };
  } else if (kind === "notes") {
    push = {
      notes: {
        id: crypto.randomUUID(),
        text: text(body.text, 20000, "Note", true),
        addedBy: optionalName(body.addedBy),
        createdAt: now,
        updatedAt: now,
      },
    };
  } else {
    throw fail(404, "Unknown section.");
  }

  const doc = await (await peethsCollection()).findOneAndUpdate(
    { _id },
    { $push: push, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!doc) throw fail(404, "This Shakti Peeth was not found. It may have been deleted.");
  return NextResponse.json(serializePeeth(doc), { status: 201 });
});
