/**
 * Pexels image search: maps a text query to a single photo URL.
 * CORS: requests from the browser to api.pexels.com are allowed with the API key in headers.
 * (Unsplash is another option with similar key-in-client tradeoffs; see Pexels docs for attribution.)
 */
const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

/**
 * @returns {Promise<string>}
 */
export const loadPexelsKey = async () => {
    try {
        const mod = await import( "./pexels-key.js" );
        const key = mod.default;
        return typeof key === "string" ? key.trim() : "";
    }
    catch {
        return "";
    }
};

/**
 * @param { string } apiKey
 * @param { string } query
 * @returns {Promise<{ ok: true, imageUrl: string, photographer: string, photographerUrl: string, pageUrl: string } | { ok: false, error: string }>}
 */
export const searchPhotoByQuery = async ( apiKey, query ) => {
    const q = query.trim();
    if ( !apiKey ) {
        return { ok: false, error: "Missing Pexels key. Copy multigame/js/pexels-key.example.js to multigame/js/pexels-key.js and add your key." };
    }
    if ( !q ) {
        return { ok: false, error: "Empty search." };
    }

    const url = new URL( PEXELS_SEARCH );
    url.searchParams.set( "query", q );
    url.searchParams.set( "per_page", "1" );
    url.searchParams.set( "page", "1" );

    let res;
    try {
        res = await fetch( url, {
            headers: {
                Authorization: apiKey,
            },
        });
    }
    catch ( e ) {
        const message = e instanceof Error ? e.message : "Network error.";
        return { ok: false, error: message };
    }

    if ( !res.ok ) {
        if ( res.status === 401 ) {
            return { ok: false, error: "Invalid Pexels API key." };
        }
        if ( res.status === 429 ) {
            return { ok: false, error: "Pexels rate limit reached. Try again later." };
        }
        return { ok: false, error: `Pexels error: ${res.status}` };
    }

    let data;
    try {
        data = await res.json();
    }
    catch {
        return { ok: false, error: "Could not read Pexels response." };
    }

    const photos = data && /** @type { any } */ ( data ).photos;
    if ( !Array.isArray( photos ) || photos.length === 0 || !photos[0] || typeof photos[0] !== "object" ) {
        return { ok: false, error: `No photos for “${q}”. Try a different word later.` };
    }

    const first = /** @type { any } */ ( photos[0] );
    const src = first.src && typeof first.src === "object" ? first.src : {};
    const imageUrl = typeof src.large === "string" && src.large
        ? src.large
        : typeof src.medium === "string" ? src.medium : typeof src.portrait === "string" ? src.portrait : "";

    if ( !imageUrl ) {
        return { ok: false, error: "Pexels returned a photo with no image URL." };
    }

    const photographer = typeof first.photographer === "string" ? first.photographer : "";
    const photographerUrl = typeof first.photographer_url === "string" ? first.photographer_url : "";
    const pageUrl = typeof first.url === "string" ? first.url : "";

    return { ok: true, imageUrl, photographer, photographerUrl, pageUrl };
};
