import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { MarketingStudio } from "@/components/ai/marketing-studio";

export const metadata = { title: "Marketing studio" };

export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowance = await getAiAllowanceAction();

  return <MarketingStudio allowance={allowance} />;
}
