import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { IdeaGenerator } from "@/components/ai/idea-generator";

export const metadata = { title: "Idea generator" };

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [allowance, business] = await Promise.all([
    getAiAllowanceAction(),
    getCurrentBusiness(),
  ]);

  return <IdeaGenerator allowance={allowance} currency={business?.currency ?? "UGX"} />;
}
