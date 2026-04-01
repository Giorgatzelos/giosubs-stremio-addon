const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.full.catalog',
    version: '2.0.0',
    name: 'GioSubs Anime Catalog',
    description: 'Πλήρης κατάλογος [GioSubs] από Anirena & 1337x',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime', 'series'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_anirena',
            name: 'GioSubs Latest',
            extra: [{ name: 'search', isRequired: false }] // Επιτρέπει την αναζήτηση
        }
    ]
};

const builder = new addonBuilder(manifest);

// Συνάρτηση για Poster από Kitsu
async function fetchPoster(title) {
    try {
        const clean = title.replace(/\[.*?\]/g, "").trim();
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(clean)}&page[limit]=1`);
        return res.data.data[0].attributes.posterImage.small;
    } catch (e) {
        return 'https://placehold.jp';
    }
}

// 1. Δημιουργία του Καταλόγου (Row στην Αρχική)
builder.defineCatalogHandler(async (args) => {
    let searchQuery = "[GioSubs]";
    if (args.extra.search) {
        searchQuery = `[GioSubs] ${args.extra.search}`;
    }

    const url = `https://anirena.com{encodeURIComponent(searchQuery)}`;
    
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        // Scrape results from Anirena
        const rows = $('.torrent-box, tr').toArray();
        for (let el of rows.slice(0, 20)) {
            const title = $(el).find('a').first().text().trim();
            if (title.includes('[GioSubs]')) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        }
        return { metas };
    } catch (e) { return { metas: [] }; }
});

// 2. Meta Handler (Λεπτομέρειες & Εικόνα)
builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const poster = await fetchPoster(title);
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: poster,
            description: `GioSubs Release: ${title}`
        }
    };
});

// 3. Stream Handler (Magnet Links)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const searchUrl = `https://1337x.to{encodeURIComponent(title)}/seeders/desc/1/`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const firstHref = $('td.coll-1.name a').last().attr('href');

        if (firstHref) {
            const page = await axios.get(`https://1337x.to${firstHref}`);
            const $$ = cheerio.load(page.data);
            const magnet = $$('a[href^="magnet:"]').attr('href');
            const infoHash = magnet.match(/btih:([a-zA-Z0-9]+)/)[1];

            return {
                streams: [{
                    name: "GioSubs",
                    title: title,
                    infoHash: infoHash.toLowerCase()
                }]
            };
        }
        return { streams: [] };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
