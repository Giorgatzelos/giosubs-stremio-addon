const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.catalog',
    version: '1.1.0',
    name: 'GioSubs Catalog',
    description: 'Κατάλογος Anime από [GioSubs] (Anirena & 1337x)',
    resources: ['catalog', 'stream', 'meta'],
    types: ['anime', 'series', 'movie'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_collection',
            name: 'GioSubs Anime',
            extra: [{ name: 'search', isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// 1. Δημιουργία του Καταλόγου (Εμφάνιση στην αρχική)
builder.defineCatalogHandler(async (args) => {
    const url = `https://anirena.com[GioSubs]`; // Παράδειγμα από Anirena
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        $('.torrent-box, tr').each((i, el) => {
            const title = $(el).find('a').text().trim();
            if (title.includes('[GioSubs]')) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`, // Δημιουργούμε μοναδικό ID
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp' // Προσωρινό poster
                });
            }
        });
        return { metas: metas.slice(0, 20) };
    } catch (e) { return { metas: [] }; }
});

// 2. Μεταδεδομένα για το κάθε Item
builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: 'https://placehold.jp',
            description: `Αρχείο από GioSubs: ${title}`
        }
    };
});

// 3. Εύρεση των Streams (Magnet Links)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const searchUrl = `https://1337x.to{encodeURIComponent(title)}/seeders/desc/1/`;
    
    try {
        const { data } = await axios.get(searchUrl);
        const $ = cheerio.load(data);
        const streams = [];

        // Εδώ παίρνουμε το πρώτο διαθέσιμο torrent
        const firstLink = $('td.coll-1.name a').last().attr('href');
        if (firstLink) {
            const pageData = await axios.get(`https://1337x.to${firstLink}`);
            const $$ = cheerio.load(pageData.data);
            const magnet = $$('a[href^="magnet:"]').attr('href');
            
            if (magnet) {
                streams.push({
                    name: "GioSubs Player",
                    title: title,
                    infoHash: magnet.match(/btih:([a-zA-Z0-9]+)/)[1]
                });
            }
        }
        return { streams };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
async function fetchFrom1337x(searchPath) {
    for (let baseUrl of proxies) {
        try {
            const fullUrl = `${baseUrl}${searchPath}`;
            const response = await axios.get(fullUrl, { 
                timeout: 6000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
            });
            if (response.status === 200) return { data: response.data, baseUrl };
        } catch (e) { continue; }
    }
    return null;
}

builder.defineStreamHandler(async (args) => {
    const title = await getMediaName(args.id);
    if (!title) return { streams: [] };

    const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, "");
    const searchPath = `/sort-search/[GioSubs]%20${encodeURIComponent(cleanTitle)}/seeders/desc/1/`;

    const result = await fetchFrom1337x(searchPath);
    if (!result) return { streams: [] };

    const $ = cheerio.load(result.data);
    const streams = [];
    const rows = $('table.table-list tbody tr').toArray();

    for (const el of rows.slice(0, 3)) {
        const torrentName = $(el).find('td.coll-1.name a').last().text();
        const torrentHref = $(el).find('td.coll-1.name a').last().attr('href');
        const pageUrl = result.baseUrl + torrentHref;

        try {
            const pageData = await axios.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $$ = cheerio.load(pageData.data);
            const magnetLink = $$('a[href^="magnet:"]').attr('href');

            if (magnetLink) {
                const infoHashMatch = magnetLink.match(/btih:([a-zA-Z0-9]+)/);
                if (infoHashMatch) {
                    streams.push({
                        name: "GioSubs",
                        title: `📦 ${torrentName}\n👤 ${$(el).find('td.coll-2').text()} Seeders`,
                        infoHash: infoHashMatch[1]
                    });
                }
            }
        } catch (e) { continue; }
    }
    return { streams };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
