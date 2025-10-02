import getSupabaseClient from "../SupabaseClient";

const loginUser = async (email: string, password: string) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.log("Login error:", error.message);
      return { error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    console.log("Unexpected Error:", err);
    return { error: "Something went wrong" };
  }
};

export default loginUser;