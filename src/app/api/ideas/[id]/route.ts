import { NextResponse } from "next/server";
import { ideasCollection, serializeIdea, storeImage, storeLink, toObjectId } from "@/lib/server/db";
import { api, cleanImages, cleanLinks, fail, readJson, text } from "@/lib/server/http";
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

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const doc = await (await ideasCollection()).findOneAndDelete({ _id: await ideaId(ctx) });
  if (doc) await deleteFiles(doc.images);
  return NextResponse.json({ ok: true });
});
