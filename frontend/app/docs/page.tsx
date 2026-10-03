import type { Metadata } from "next";
import { DocsView } from "@/components/DocsView";

export const metadata: Metadata = {
  title: "Docs | ZKCTF",
  description: "Seat, relation ℛ, Groth16 verify. Integration guide.",
};

export default function DocsPage() {
  return <DocsView />;
}
