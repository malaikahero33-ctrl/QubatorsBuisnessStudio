import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { BrandStudio } from "@/components/ai/brand-studio";

export const metadata = { title: "Brand studio" };

export default async function BrandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowance = await getAiAllowanceAction();

  return <BrandStudio allowance={allowance} />;
}
