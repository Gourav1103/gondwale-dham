import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Misc";
import { PeethDetailView } from "@/components/views/PeethDetailView";

export const metadata: Metadata = { title: "Shakti Peeth" };

export default function PeethPage() {
  return (
    <Suspense fallback=<Skeleton className="h-96" />>
      <PeethDetailView />
    </Suspense>
  );
}
