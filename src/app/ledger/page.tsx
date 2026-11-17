import { redirect } from "next/navigation";

export default function LedgerRedirectPage() {
  redirect("/customers?tab=aging");
}

