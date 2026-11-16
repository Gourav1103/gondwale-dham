import { NextResponse } from "next/server";
import { peethsCollection, serializePeeth, type PeethDoc } from "@/lib/server/db";
import { api, readJson, text } from "@/lib/server/http";

export const GET = api(async () => {
  const peeths = await (await peethsCollection()).find().sort({ number: 1, createdAt: 1 }).toArray();
  return NextResponse.json(peeths.map(serializePeeth));
});

/** Add a new Shakti Peeth (in case the team wants to add one beyond the initial 51). */
export const POST = api(async (req) => {
  const body = await readJson(req);
  const col = await peethsCollection();
  let number = Number(body.number);
  if (!Number.isInteger(number) || number < 1 || number > 9999) {
    const last = await col.find().sort({ number: -1 }).limit(1).next();
    number = (last?.number ?? 0) + 1;
  }
  const now = new Date();
  const doc: PeethDoc = {
    number,
    name: text(body.name, 200, "Name", true),
    place: text(body.place, 300, "Place"),
    description: text(body.description, 5000, "Description"),
    images: [],
    links: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await col.insertOne(doc);
  return NextResponse.json(serializePeeth({ ...doc, _id: insertedId }), { status: 201 });
});
