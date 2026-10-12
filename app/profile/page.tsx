import { redirect } from "next/navigation";
import ProfileView from "../components/profile-view";
import ProfileMissing from "../components/profile-missing";
import { toActivity } from "../lib/activity-store";
import { createClient, getCurrentUser } from "../lib/supabase/server";

export default async function ProfilePage() {
  const current = await getCurrentUser();

  if (!current) redirect("/register?next=/profile");
  if (!current.profile) return <ProfileMissing />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("test_results")
    .select("id, exercise_slug, exercise_name, created_at, accuracy, passed")
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  return <ProfileView profile={current.profile} email={current.email} activities={(data ?? []).map(toActivity)} />;
}
