import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Misc";
import { IdeaEditView } from "@/components/views/IdeaEditView";

export const metadata: Metadata = { title: "Edit idea" };

export default function EditIdeaPage() {
  return (
    <Suspense fallback=<Skeleton className="h-96" />>
      <IdeaEditView />
    </Suspense>
  );
}
