import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      console.error("Missing Supabase configuration");
      return respond({ error: "Server configuration error" }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required" }, 401);
    }

    const token = authorization.slice(7).trim();

    // Validate the signed-in user.
    const authClient = createClient(url, anonKey);

    const {
      data: { user: caller },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !caller) {
      return respond({ error: "Invalid or expired session" }, 401);
    }

    // Privileged operations stay on the server.
    const adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the administrator role from the database.
    const { data: adminProfile, error: roleError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (roleError || adminProfile?.role !== "admin") {
      return respond(
        { error: "Only administrators can create teachers" },
        403,
      );
    }

    const body = await req.json();

    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) {
      return respond(
        { error: "Valid full name and email are required" },
        400,
      );
    }

    if (password.length < 8) {
      return respond(
        { error: "Password must contain at least 8 characters" },
        400,
      );
    }

    // Create the teacher in Supabase Authentication.
    const { data: created, error: createError } = await adminClient.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError || !created.user) {
      return respond(
        {
          error: createError?.message ?? "Failed to create user",
        },
        400,
      );
    }

    const teacherId = created.user.id;

    // Create or update the linked teacher profile.
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: teacherId,
          full_name: fullName,
          role: "teacher",
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("Teacher profile error:", profileError.message);

      // Avoid leaving an incomplete account behind.
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(
        teacherId,
      );

      if (rollbackError) {
        console.error(
          "Rollback failed for user",
          teacherId,
          rollbackError.message,
        );
      }

      return respond(
        { error: "Teacher profile could not be saved" },
        500,
      );
    }

    return respond(
      {
        success: true,
        user: {
          id: teacherId,
          email,
          full_name: fullName,
          role: "teacher",
        },
      },
      201,
    );
  } catch (error) {
    console.error("Create teacher exception:", error);

    return respond(
      { error: "Unexpected server error" },
      500,
    );
  }
});
