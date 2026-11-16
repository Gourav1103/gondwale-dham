import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Misc";
import { IdeaForm } from "@/components/views/IdeaForm";

export const metadata: Metadata = { title: "Add idea" };

export default function NewIdeaPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/ideas", label: "All ideas" }}
        eyebrow="Idea Contributor"
        title="Share a new idea"
        subtitle="Only the title is required. You can always come back and add more photos or links later."
      />
      <IdeaForm />
    </div>
  );
}
