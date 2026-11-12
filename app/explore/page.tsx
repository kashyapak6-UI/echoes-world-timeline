import type { Metadata } from "next";
import { Explorer } from "@/components/Explorer";

export const metadata: Metadata = { title: "Explore" };
export default function ExplorePage() {
  return <Explorer />;
}
