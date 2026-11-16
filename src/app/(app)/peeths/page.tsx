import type { Metadata } from "next";
import { Suspense } from "react";
import { CardGridSkeleton } from "@/components/ui/Misc";
import { PeethsListView } from "@/components/views/PeethsListView";

export const metadata: Metadata = { title: "51 Shakti Peeths" };

export default function PeethsPage() {
  return (
    <Suspense fallback={<CardGridSkeleton count={9} />}>
      <PeethsListView />
    </Suspense>
  );
}
