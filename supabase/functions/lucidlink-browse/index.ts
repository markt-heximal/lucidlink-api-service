const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawUrl = Deno.env.get("LUCIDLINK_API_URL");
    if (!rawUrl) throw new Error("LUCIDLINK_API_URL is not configured");
    const LUCIDLINK_API_URL = rawUrl.trim();

    const LUCIDLINK_API_KEY = Deno.env.get("LUCIDLINK_API_KEY");
    if (!LUCIDLINK_API_KEY) throw new Error("LUCIDLINK_API_KEY is not configured");

    const body = await req.json();
    const { action, filespace, path, source_id, cursor, limit } = body;

    // Auth check (skip for "test")
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (action !== "test") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error: authError } = await supabase.auth.getClaims(token);
      if (authError || !data?.claims) {
        console.error("Auth error:", authError?.message);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Clean base URL
    const baseUrl = LUCIDLINK_API_URL.replace(/\/+$/, "").replace(/\/api\/v1(\/.*)?$/, "");
    const apiHeaders = {
      "Authorization": `Bearer ${LUCIDLINK_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Helper: resolve a path to an entry ID
    async function resolvePathToId(fsId: string, fsPath: string): Promise<string | null> {
      const url = `${baseUrl}/api/v1/filespaces/${fsId}/entries/resolve?path=${encodeURIComponent(fsPath)}`;
      console.log("Resolving path:", url);
      const res = await fetch(url, { headers: apiHeaders });
      if (!res.ok) {
        console.error("Resolve failed:", res.status, await res.text());
        return null;
      }
      const data = await res.json();
      // Response should contain an entry with an id
      return data?.id || data?.entryId || data?.data?.id || null;
    }

    // Helper: list children of an entry
    function extractEntries(data: any): any[] {
      if (Array.isArray(data)) return data;
      if (data?.data?.entries && Array.isArray(data.data.entries)) return data.data.entries;
      for (const key of ["data", "entries", "children", "items", "content", "results", "files"]) {
        if (data?.[key] && Array.isArray(data[key])) return data[key];
      }
      return [];
    }

    function extractCursor(data: any): string | null {
      return data?.data?.cursor || data?.cursor || data?.nextCursor || data?.next || null;
    }

    async function listChildren(fsId: string, entryId: string, limit = 100, cursor?: string): Promise<{ entries: any[]; cursor: string | null }> {
      const encodedId = encodeURIComponent(entryId);
      let url = `${baseUrl}/api/v1/filespaces/${fsId}/entries/${encodedId}/children?limit=${limit}`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      console.log("Listing children:", url);
      const res = await fetch(url, { headers: apiHeaders });
      if (!res.ok) {
        console.error("List children failed:", res.status, await res.text());
        return { entries: [], cursor: null };
      }
      const data = await res.json();
      return { entries: extractEntries(data), cursor: extractCursor(data) };
    }

    // ─── LIST FILESPACES ───
    if (action === "list-filespaces") {
      const res = await fetch(`${baseUrl}/api/v1/filespaces`, { headers: apiHeaders });
      if (!res.ok) throw new Error(`LucidLink API error [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      console.log("Filespaces response sample:", JSON.stringify(data).slice(0, 1000));
      const filespaceList = Array.isArray(data) ? data : (data.data || data.filespaces || []);
      return new Response(JSON.stringify({ success: true, filespaces: filespaceList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── BROWSE ───
    if (action === "browse") {
      if (!filespace) throw new Error("filespace is required");
      const browsePath = path || "/";

      // Step 1: Resolve path to entry ID
      const entryId = await resolvePathToId(filespace, browsePath);
      if (!entryId) {
        return new Response(JSON.stringify({
          success: true, items: [],
          note: `Could not resolve path "${browsePath}". The directory may not exist.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 2: List children with pagination
      const pageSize = limit || 100;
      const result = await listChildren(filespace, entryId, pageSize, cursor);

      // Normalize items for the frontend
      const items = result.entries.map((entry: any) => ({
        name: entry.name || entry.filename || "",
        type: entry.type === "dir" || entry.type === "directory" || entry.isDirectory ? "directory" : "file",
        size: entry.size || entry.fileSize || 0,
        id: entry.id || entry.entryId || "",
        lastModified: entry.lastModified || entry.modifiedAt || "",
      }));

      return new Response(JSON.stringify({ success: true, items, cursor: result.cursor, hasMore: !!result.cursor }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SCAN ───
    if (action === "scan") {
      if (!filespace) throw new Error("filespace is required");
      const scanPath = path || "/";

      // Resolve + list
      const entryId = await resolvePathToId(filespace, scanPath);
      if (!entryId) {
        return new Response(JSON.stringify({
          success: true, scanned: 0, ingested: 0, errors: 0, results: [],
          note: `Could not resolve path "${scanPath}".`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch all pages for scan
      let allChildren: any[] = [];
      let scanCursor: string | null = undefined as any;
      do {
        const result = await listChildren(filespace, entryId, 100, scanCursor || undefined);
        allChildren = allChildren.concat(result.entries);
        scanCursor = result.cursor;
      } while (scanCursor);
      const children = allChildren;

      // Filter for supported file types
      const supportedExts = [".pdf", ".docx", ".doc", ".txt", ".md", ".eml", ".msg"];
      const files = children.filter((entry: any) => {
        if (entry.type === "dir" || entry.type === "directory" || entry.isDirectory) return false;
        const name = (entry.name || entry.filename || "").toLowerCase();
        return supportedExts.some(ext => name.endsWith(ext));
      });

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const results = [];
      for (const file of files.slice(0, 20)) {
        try {
          const fileName = file.name || file.filename;
          const filePath = `${scanPath === "/" ? "" : scanPath}/${fileName}`;

          // For now, create content entry with reference (download via LucidLink client)
          const ext = fileName.split(".").pop()?.toLowerCase();
          const sourceType = ["eml", "msg"].includes(ext || "") ? "email" : "upload";

          const { error: insertError } = await adminClient.from("content").insert({
            title: fileName,
            source_type: sourceType,
            status: "pending",
            url: `lucidlink://${filespace}${filePath}`,
          });

          if (insertError) {
            results.push({ file: fileName, status: "error", error: insertError.message });
            continue;
          }
          results.push({ file: fileName, status: "ingested" });
        } catch (e) {
          results.push({
            file: file.name || file.filename,
            status: "error",
            error: e instanceof Error ? e.message : "Unknown",
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        scanned: files.length,
        ingested: results.filter(r => r.status === "ingested").length,
        errors: results.filter(r => r.status === "error").length,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── TEST ───
    if (action === "test") {
      try {
        const res = await fetch(`${baseUrl}/api/v1/filespaces`, { headers: apiHeaders });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const fsList = Array.isArray(data) ? data : (data.data || []);

        // Also check if Directory Management API is available
        let dirApiAvailable = false;
        if (fsList.length > 0) {
          const fsId = fsList[0].id;
          try {
            const resolveRes = await fetch(
              `${baseUrl}/api/v1/filespaces/${fsId}/entries/resolve?path=${encodeURIComponent("/")}`,
              { headers: apiHeaders }
            );
            dirApiAvailable = resolveRes.ok;
          } catch (_) { /* not available */ }
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Connected to LucidLink successfully",
          filespaces: fsList.length,
          directoryApiAvailable: dirApiAvailable,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: `Connection failed: ${e instanceof Error ? e.message : "Unknown"}`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("LucidLink browse error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
