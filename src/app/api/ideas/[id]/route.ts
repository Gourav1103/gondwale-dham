import { NextResponse } from "next/server";
import { ideasCollection, serializeIdea, storeImage, storeLink, toObjectId } from "@/lib/server/db";
import { api, cleanImages, cleanLinks, fail, readJson, text } from "@/lib/server/http";
import type { AnyBulkWriteOperation } from "mongodb";
import type { IdeaDoc } from "@/lib/server/db";
import { deleteFiles } from "@/lib/server/storage";

type Ctx = RouteContext<"/api/ideas/[id]">;

async function ideaId(ctx: Ctx) {
  const _id = toObjectId((await ctx.params).id);
  if (!_id) throw fail(404, "This idea was not found. It may have been deleted.");
  return _id;
}

export const GET = api<Ctx>(async (_req, ctx) => {
  const doc = await (await ideasCollection()).findOne({ _id: await ideaId(ctx) });
  if (!doc) throw fail(404, "This idea was not found. It may have been deleted.");
  return NextResponse.json(serializeIdea(doc));
});

export const PUT = api<Ctx>(async (req, ctx) => {
  const _id = await ideaId(ctx);
  const body = await readJson(req);
  const images = cleanImages(body.images);
  const col = await ideasCollection();
  const before = await col.findOne({ _id });
  if (!before) throw fail(404, "This idea was not found. It may have been deleted.");

  const after = await col.findOneAndUpdate(
    { _id },
    {
      $set: {
        title: text(body.title, 200, "Idea title", true),
        description: text(body.description, 20000, "Description"),
        links: cleanLinks(body.links).map(storeLink),
        images: images.map(storeImage),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!after) throw fail(404, "This idea was not found. It may have been deleted.");

  // Remove image files that were taken out of the idea.
  const kept = new Set(images.map((i) => i.path));
  await deleteFiles(before.images.filter((i) => !kept.has(i.path)));
  return NextResponse.json(serializeIdea(after));
});

const idList = (raw: unknown, field: string): string[] => {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 200 || raw.some((x) => typeof x !== "string")) throw fail(400, `Invalid ${field}.`);
  return raw as string[];
};

/**
 * Change only what the device sends, so two people editing different parts of the same idea
 * never undo each other:  { title?, description?, addLinks?, updateLinks?, removeLinkIds?, addImages?, removeImageIds? }
 * Adding an item whose id is already there is skipped (safe to retry).
 */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const _id = await ideaId(ctx);
  const body = await readJson(req);
  const now = new Date();
  const col = await ideasCollection();
  const before = await col.findOne({ _id });
  if (!before) throw fail(404, "This idea was not found. It may have been deleted.");

  const set: Record<string, unknown> = { updatedAt: now };
  if ("title" in body) set.title = text(body.title, 200, "Idea title", true);
  if ("description" in body) set.description = text(body.description, 20000, "Description");

  const haveLinks = new Set(before.links.map((l) => l.id));
  const haveImages = new Set(before.images.map((i) => i.id));
  const addLinks = cleanLinks(body.addLinks).filter((l) => !haveLinks.has(l.id)).map(storeLink);
  const updateLinks = cleanLinks(body.updateLinks).filter((l) => haveLinks.has(l.id));
  const removeLinkIds = idList(body.removeLinkIds, "links");
  const addImages = cleanImages(body.addImages).filter((i) => !haveImages.has(i.id)).map(storeImage);
  const removeImageIds = idList(body.removeImageIds, "images");

  // Mongo can't $push and $pull the same array in one update, so run the steps in order.
  const ops: AnyBulkWriteOperation<IdeaDoc>[] = [{ updateOne: { filter: { _id }, update: { $set: set } } }];
  for (const l of updateLinks) {
    ops.push({
      updateOne: {
        filter: { _id, "links.id": l.id },
        update: { $set: { "links.$.url": l.url, "links.$.title": l.title ?? null } },
      },
    });
  }
  if (removeLinkIds.length || removeImageIds.length) {
    ops.push({ updateOne: { filter: { _id }, update: { $pull: { links: { id: { $in: removeLinkIds } }, images: { id: { $in: removeImageIds } } } } } });
  }
  if (addLinks.length || addImages.length) {
    ops.push({ updateOne: { filter: { _id }, update: { $push: { links: { $each: addLinks }, images: { $each: addImages } } } } });
  }
  await col.bulkWrite(ops, { ordered: true });

  const after = await col.findOne({ _id });
  if (!after) throw fail(404, "This idea was not found. It may have been deleted.");

  const removed = new Set(removeImageIds);
  await deleteFiles(before.images.filter((i) => removed.has(i.id)));
  return NextResponse.json(serializeIdea(after));
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const doc = await (await ideasCollection()).findOneAndDelete({ _id: await ideaId(ctx) });
  if (doc) await deleteFiles(doc.images);
  return NextResponse.json({ ok: true });
});
