import { connection } from "next/server";
import { HomeFlow } from "@/components/HomeFlow";
import { isDemoMode } from "@/lib/jev";

export default async function Home() {
  // The key can be added after build, so check it per request.
  await connection();
  return <HomeFlow demo={isDemoMode()} />;
}
