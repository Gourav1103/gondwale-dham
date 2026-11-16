import { NextResponse } from "next/server";
import { ideasCollection, serializeIdea, storeImage, storeLink, type IdeaDoc } from "@/lib/server/db";
import { api, cleanImages, cleanLinks, optionalName, readJson, text } from "@/lib/server/http";

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
  const { insertedId } = await col.insertOne(doc);
  return NextResponse.json(serializeIdea({ ...doc, _id: insertedId }), { status: 201 });
});
