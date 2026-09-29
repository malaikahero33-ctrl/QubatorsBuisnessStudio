import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { Copilot } from "@/components/ai/copilot";

export const metadata = { title: "Copilot" };

export default async function CopilotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowance = await getAiAllowanceAction();
  const business = await getCurrentBusiness();

  return <Copilot allowance={allowance} businessName={business?.name ?? "your business"} />;
}
