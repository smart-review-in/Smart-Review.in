export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const bizSlug = url.searchParams.get("biz");

  if (!bizSlug) {
    return new Response(JSON.stringify({ error: "Missing business identifier" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY; // Never exposed to the browser

  const dbHeaders = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    // 1. Authenticate: Check if business exists and is active
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

    // 2. Fetch review phrases strictly for this business's category
    const phrasesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/review_phrases?business_type=eq.${encodeURIComponent(business.business_type)}&select=rating,tag,phrase`,
      { headers: dbHeaders }
    );
    const phrasesData = await phrasesRes.json();

    // 3. Extract unique tags for this category
    const tags = [...new Set(phrasesData.map(item => item.tag))];

    // 4. Structure phrases into rating-tag lookup map
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
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60" // Optional edge caching
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}