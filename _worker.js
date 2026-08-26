export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API Route: Handle database queries
    if (url.pathname.startsWith("/api/get-config")) {
      const bizSlug = url.searchParams.get("biz");

      if (!bizSlug) {
        return new Response(JSON.stringify({ error: "Missing business identifier" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const SUPABASE_URL = env.SUPABASE_URL;
      const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

      const dbHeaders = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      };

      try {
        // Authenticate business
        const bizRes = await fetch(
          `${SUPABASE_URL}/rest/v1/businesses?id=eq.${encodeURIComponent(bizSlug)}&is_active=eq.true&select=*`,
          { headers: dbHeaders }
        );
        const bizData = await bizRes.json();

        if (!bizData || bizData.length === 0) {
          return new Response(JSON.stringify({ error: "Unauthorized or Inactive Business" }), {
            status: 403,
            headers: { "Content-Type": "application/json" }
          });
        }

        const business = bizData[0];

        // Fetch phrases
        const phrasesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/review_phrases?business_type=eq.${encodeURIComponent(business.business_type)}&select=rating,tag,phrase`,
          { headers: dbHeaders }
        );
        const phrasesData = await phrasesRes.json();

        const tags = [...new Set(phrasesData.map(item => item.tag))];
        const phrases = {};
        for (let r = 1; r <= 5; r++) phrases[r] = {};
        phrasesData.forEach(row => {
          if (!phrases[row.rating][row.tag]) phrases[row.rating][row.tag] = [];
          phrases[row.rating][row.tag].push(row.phrase);
        });

        return new Response(JSON.stringify({
          business: {
            name: business.name,
            placeId: business.place_id,
            type: business.business_type
          },
          tags: tags,
          phrases: phrases
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. Static Assets: Serve public HTML/CSS files safely
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Asset not found", { status: 404 });
  }
};
