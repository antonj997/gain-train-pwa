import { deletionHandler } from "./handler.ts";
Deno.serve(
  deletionHandler({
    url: Deno.env.get("SUPABASE_URL")!,
    key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  }),
);
