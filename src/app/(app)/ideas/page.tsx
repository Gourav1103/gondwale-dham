import type { Metadata } from "next";
import { IdeasListView } from "@/components/views/IdeasListView";

export const metadata: Metadata = { title: "Ideas" };

export default function IdeasPage() {
  return <IdeasListView />;
}
