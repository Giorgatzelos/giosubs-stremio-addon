const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.fixed.catalog',
    version: '2.1.0',
    name: 'GioSubs Anime Catalog',
    description: 'Latest releases from [GioSubs] (Anirena/1337x)',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime', 'series'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_anirena',
            name: 'GioSubs Latest',
            extra: [{ name: 'search', isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Συνάρτηση για Poster από Kitsu
async function fetchPoster(title) {
    try {
        const clean = title.replace(/\[.*?\]/g, "").trim().split(' - ')[0];
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(clean)}&page[limit]=1`, { timeout: 3000 });
        if (res.data && res.data.data && res.data.data.length > 0) {
            return res.data.data[0].attributes.posterImage.small;
        }
    } catch (e) {
        return 'https://placehold.jp';
    }
    return 'https://placehold.jp';
}

// 1. Κατάλογος (Anirena Scraper)
builder.defineCatalogHandler(async (args) => {
    let searchQuery = "[GioSubs]";
    if (args.extra && args.extra.search) {
        searchQuery = `[GioSubs] ${args.extra.search}`;
    }

    const url = `https://anirena.com{encodeURIComponent(searchQuery)}`;
    
    try {
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 8000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        // Πιο ακριβής selector για τα links του Anirena
        $('a').each((i, el) => {
            const title = $(el).text().trim();
            const href = $(el).attr('href');

            // Φιλτράρουμε μόνο τα έγκυρα torrent links με [GioSubs]
            if (title.includes('[GioSubs]') && href.includes('?id=') && metas.length < 15) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        });

        console.log(`Found ${metas.length} GioSubs items`);
        return { metas };
    } catch (e) {
        console.error("Anirena Error:", e.message);
        return { metas: [] };
    }
});

// 2. Meta Handler
builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const poster = await fetchPoster(title);
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: poster,
            description: `Release: ${title}`
        }
    };
});

// 3. Stream Handler
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const searchUrl = `https://anirena.com{encodeURIComponent(title)}`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        
        const magnet = $('a[href^="magnet:"]').first().attr('href');
        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch) {
                return {
                    streams: [{
                        name: "GioSubs",
                        title: title,
                        infoHash: hashMatch[1].toLowerCase()
                    }]
                };
            }
        }
        return { streams: [] };
    } catch (e) {
        return { streams: [] };
    }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
