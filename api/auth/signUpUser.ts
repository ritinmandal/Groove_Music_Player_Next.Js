import getSupabaseClient from "../SupabaseClient";

const signUpUser = async (name: string, email: string, password: string) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (error) {
      console.log("Signup error:", error.message);
      return { error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    console.log("Unexpected Error:", err);
    return { error: "Something went wrong" };
  }
};

export default signUpUser;