import type { Metadata } from "next";
import { connection } from "next/server";
import { SampleFlow } from "@/components/SampleFlow";
import { isDemoMode } from "@/lib/jev";

export const metadata: Metadata = {
  title: "Sample run — Sift",
  description: "Eight fictional applicants screened by Jev, next to a keyword baseline.",
};

export default async function SamplePage() {
  await connection();
  return <SampleFlow demo={isDemoMode()} />;
}
