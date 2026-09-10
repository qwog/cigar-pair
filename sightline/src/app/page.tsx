import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Index() {
  redirect((await getSessionUser()) ? "/dashboard" : "/login");
}
