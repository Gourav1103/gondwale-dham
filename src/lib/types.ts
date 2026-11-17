// Shared data shapes used by both the API (server) and the UI (client).

/** Set only on the client while a change is still waiting to reach the server. */
export type SyncFlags = {
  pending?: boolean; // saved on this device, not yet on the server
  failed?: boolean; // the server rejected the change (see the sync sheet)
};

export type ImageItem = SyncFlags & {
  id: string;
  url: string; // public URL (GitHub raw URL in production)
  path: string; // path inside the storage repo — used for deleting
  sha?: string; // GitHub blob sha — used for deleting
  name?: string;
  addedBy?: string;
  createdAt: string;
};

export type LinkItem = SyncFlags & {
  id: string;
  url: string;
  title?: string;
  addedBy?: string;
  createdAt: string;
};

export type NoteItem = SyncFlags & {
  id: string;
  text: string;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type Idea = SyncFlags & {
  id: string;
  title: string;
  description: string;
  links: LinkItem[];
  images: ImageItem[];
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type Peeth = SyncFlags & {
  id: string;
  number: number;
  name: string;
  place: string;
  description: string;
  images: ImageItem[];
  links: LinkItem[];
  notes: NoteItem[];
  createdAt: string;
  updatedAt: string;
};

/** Body accepted when creating / editing an idea. */
export type IdeaInput = {
  title: string;
  description: string;
  links: LinkItem[];
  images: ImageItem[];
  addedBy?: string;
};
