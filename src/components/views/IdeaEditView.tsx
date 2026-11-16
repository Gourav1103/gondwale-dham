"use client";

import { useParams } from "next/navigation";
import { useIdea } from "@/lib/client/data";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui/Misc";
import { IdeaForm } from "./IdeaForm";

export function IdeaEditView() {
  const { id } = useParams<{ id: string }>();
  const { data: idea, error, isLoading, refresh } = useIdea(id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/ideas/${id}`, label: "Back to idea" }} eyebrow="Edit idea" title={idea?.title ?? "Edit idea"} />
      {isLoading && <Skeleton className="h-96" />}
      {!isLoading && !idea && <ErrorState message={error ?? "Idea not found."} onRetry={refresh} />}
      {/* key: start the form fresh for each idea; it keeps its own state while editing */}
      {idea && <IdeaForm key={idea.id} idea={idea} />}
    </div>
  );
}
