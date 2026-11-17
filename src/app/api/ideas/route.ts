import { NextResponse } from "next/server";
import { ideasCollection, serializeIdea, storeImage, storeLink, type IdeaDoc } from "@/lib/server/db";
import { api, cleanImages, cleanLinks, clientObjectId, isDuplicateKey, optionalName, readJson, text } from "@/lib/server/http";

export const GET = api(async () => {
  const ideas = await (await ideasCollection()).find().sort({ createdAt: -1 }).toArray();
  return NextResponse.json(ideas.map(serializeIdea));
});

export const POST = api(async (req) => {
  const body = await readJson(req);
  const now = new Date();
  const doc: IdeaDoc = {
    title: text(body.title, 200, "Idea title", true),
    description: text(body.description, 20000, "Description"),
    links: cleanLinks(body.links).map(storeLink),
    images: cleanImages(body.images).map(storeImage),
    addedBy: optionalName(body.addedBy),
    createdAt: now,
    updatedAt: now,
  };
  const col = await ideasCollection();
  // The device may send its own id; a retry of the same create then returns the saved idea.
  const _id = clientObjectId(body.id);
  if (_id) {
    const existing = await col.findOne({ _id });
    if (existing) return NextResponse.json(serializeIdea(existing));
    try {
      await col.insertOne({ ...doc, _id });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const saved = await col.findOne({ _id });
      if (saved) return NextResponse.json(serializeIdea(saved));
      throw err;
    }
    return NextResponse.json(serializeIdea({ ...doc, _id }), { status: 201 });
  }
  const { insertedId } = await col.insertOne(doc);
  return NextResponse.json(serializeIdea({ ...doc, _id: insertedId }), { status: 201 });
});
