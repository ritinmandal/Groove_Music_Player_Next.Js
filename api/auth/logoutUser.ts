import getSupabaseClient from "../SupabaseClient";


const LogoutUser = async () => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log("Logout error:", error.message);
    return { error: error.message };
  }
  
  return { success: true };
};

export default LogoutUser;