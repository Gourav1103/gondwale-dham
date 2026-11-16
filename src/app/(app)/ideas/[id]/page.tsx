import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Misc";
import { IdeaDetailView } from "@/components/views/IdeaDetailView";

export const metadata: Metadata = { title: "Idea" };

export default function IdeaPage() {
  return (
    <Suspense fallback=<Skeleton className="h-96" />>
      <IdeaDetailView />
    </Suspense>
  );
}
