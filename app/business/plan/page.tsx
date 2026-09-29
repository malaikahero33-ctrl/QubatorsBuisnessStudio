import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { BusinessPlanStudio } from "@/components/ai/business-plan";

export const metadata = { title: "Business plan" };

export default async function BusinessPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowance = await getAiAllowanceAction();

  return <BusinessPlanStudio allowance={allowance} />;
}
