import { NextResponse } from "next/server";
import { peethsCollection, serializePeeth, toObjectId, type PeethDoc } from "@/lib/server/db";
import { api, fail, readJson, text } from "@/lib/server/http";
import { deleteFiles } from "@/lib/server/storage";

type Ctx = RouteContext<"/api/peeths/[id]">;
const NOT_FOUND = "This Shakti Peeth was not found. It may have been deleted.";

async function peethId(ctx: Ctx) {
  const _id = toObjectId((await ctx.params).id);
  if (!_id) throw fail(404, NOT_FOUND);
  return _id;
}

export const GET = api<Ctx>(async (_req, ctx) => {
  const doc = await (await peethsCollection()).findOne({ _id: await peethId(ctx) });
  if (!doc) throw fail(404, NOT_FOUND);
  return NextResponse.json(serializePeeth(doc));
});

/** Edit basic information: number, name, place, description. */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const body = await readJson(req);
  const set: Partial<PeethDoc> = { updatedAt: new Date() };
  if ("name" in body) set.name = text(body.name, 200, "Name", true);
  if ("place" in body) set.place = text(body.place, 300, "Place");
  if ("description" in body) set.description = text(body.description, 5000, "Description");
  if ("number" in body) {
    const n = Number(body.number);
    if (!Number.isInteger(n) || n < 1 || n > 9999) throw fail(400, "Number must be a whole number (1–9999).");
    set.number = n;
  }
  const doc = await (await peethsCollection()).findOneAndUpdate(
    { _id: await peethId(ctx) },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!doc) throw fail(404, NOT_FOUND);
  return NextResponse.json(serializePeeth(doc));
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const doc = await (await peethsCollection()).findOneAndDelete({ _id: await peethId(ctx) });
  if (doc) await deleteFiles(doc.images);
  return NextResponse.json({ ok: true });
});
