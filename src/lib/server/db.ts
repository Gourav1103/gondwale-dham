import "server-only";
import { MongoClient, ObjectId, type Collection, type Db, type WithId } from "mongodb";
import type { Idea, ImageItem, LinkItem, NoteItem, Peeth } from "@/lib/types";
import { SEED_PEETHS } from "@/lib/seed-data";

// ---- Stored document shapes (dates as Date, _id as ObjectId) ----

type StoredImage = Omit<ImageItem, "createdAt"> & { createdAt: Date };
type StoredLink = Omit<LinkItem, "createdAt"> & { createdAt: Date };
type StoredNote = Omit<NoteItem, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };

export type IdeaDoc = {
  title: string;
  description: string;
  links: StoredLink[];
  images: StoredImage[];
  addedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PeethDoc = {
  number: number;
  name: string;
  place: string;
  description: string;
  images: StoredImage[];
  links: StoredLink[];
  notes: StoredNote[];
  createdAt: Date;
  updatedAt: Date;
};

type MetaDoc = { _id: string; at: Date };

// ---- Connection (reused across hot reloads and requests) ----

const globalForMongo = globalThis as unknown as { _mongo?: Promise<MongoClient> };

function client() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
  if (!globalForMongo._mongo) {
    globalForMongo._mongo = new MongoClient(uri).connect().catch((err) => {
      globalForMongo._mongo = undefined; // allow retry on next request
      throw err;
    });
  }
  return globalForMongo._mongo;
}

let setupDone: Promise<void> | null = null;

async function db(): Promise<Db> {
  const database = (await client()).db(process.env.MONGODB_DB || "harihaat2026");
  if (!setupDone) {
    setupDone = setup(database).catch((err) => {
      setupDone = null;
      throw err;
    });
  }
  await setupDone;
  return database;
}

/** Creates indexes and seeds the 51 Shakti Peeths exactly once (even if later deleted). */
async function setup(database: Db) {
  await database.collection<PeethDoc>("peeths").createIndex({ number: 1 });
  await database.collection<IdeaDoc>("ideas").createIndex({ createdAt: -1 });

  const meta = database.collection<MetaDoc>("meta");
  try {
    // Unique _id makes this safe if two requests race: only one wins and seeds.
    await meta.insertOne({ _id: "peeths-seeded", at: new Date() });
  } catch {
    return; // already seeded
  }
  const peeths = database.collection<PeethDoc>("peeths");
  if ((await peeths.countDocuments()) > 0) return;
  const now = new Date();
  await peeths.insertMany(
    SEED_PEETHS.map((p) => ({ ...p, images: [], links: [], notes: [], createdAt: now, updatedAt: now })),
  );
}

export async function ideasCollection(): Promise<Collection<IdeaDoc>> {
  return (await db()).collection<IdeaDoc>("ideas");
}

export async function peethsCollection(): Promise<Collection<PeethDoc>> {
  return (await db()).collection<PeethDoc>("peeths");
}

export function toObjectId(id: string) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

// ---- Converting stored docs → JSON the UI uses ----

const iso = (d: Date | string) => new Date(d).toISOString();

function serializeImages(list: StoredImage[] = []): ImageItem[] {
  return list.map((i) => ({ ...i, createdAt: iso(i.createdAt) }));
}
function serializeLinks(list: StoredLink[] = []): LinkItem[] {
  return list.map((l) => ({ ...l, createdAt: iso(l.createdAt) }));
}
function serializeNotes(list: StoredNote[] = []): NoteItem[] {
  return list.map((n) => ({ ...n, createdAt: iso(n.createdAt), updatedAt: iso(n.updatedAt) }));
}

export function serializeIdea(doc: WithId<IdeaDoc>): Idea {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    links: serializeLinks(doc.links),
    images: serializeImages(doc.images),
    addedBy: doc.addedBy,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function serializePeeth(doc: WithId<PeethDoc>): Peeth {
  return {
    id: String(doc._id),
    number: doc.number,
    name: doc.name,
    place: doc.place,
    description: doc.description,
    images: serializeImages(doc.images),
    links: serializeLinks(doc.links),
    notes: serializeNotes(doc.notes),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

// ---- Converting validated input → stored sub-documents ----

export function storeImage(i: ImageItem): StoredImage {
  return { ...i, createdAt: i.createdAt ? new Date(i.createdAt) : new Date() };
}
export function storeLink(l: LinkItem): StoredLink {
  return { ...l, createdAt: l.createdAt ? new Date(l.createdAt) : new Date() };
}
