const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.indexer.catalog',
    version: '1.3.0',
    name: 'GioSubs Indexer Catalog',
    description: 'Αναζήτηση [GioSubs] σε Anirena & 1337x',
    resources: ['catalog', 'stream', 'meta'],
    types: ['anime'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_index',
            name: 'GioSubs Latest',
            extra: [{ name: 'search', isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Μόνο για να φέρνουμε την εικόνα (Poster)
async function fetchPoster(title) {
    try {
        const cleanTitle = title.replace(/\[.*?\]/g, "").trim().split(' - ')[0];
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`);
        return res.data.data[0].attributes.posterImage.small;
    } catch (e) {
        return 'https://placehold.jp';
    }
}

// 1. Σκανάρισμα του Anirena για τον κατάλογο [GioSubs]
builder.defineCatalogHandler(async (args) => {
    try {
        const { data } = await axios.get(`https://anirena.com`);
        const $ = cheerio.load(data);
        const metas = [];

        for (let el of $('.torrent-box, tr').toArray().slice(0, 15)) {
            const title = $(el).find('a').first().text().trim();
            if (title.includes('[GioSubs]')) {
                const poster = await fetchPoster(title);
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: poster
                });
            }
        }
        return { metas };
    } catch (e) { return { metas: [] }; }
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
            description: `GioSubs Indexer Release: ${title}`
        }
    };
});

// 3. Εύρεση Magnet Link στο 1337x (Indexer)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    // Δοκιμάζουμε αναζήτηση στο 1337x για το συγκεκριμένο release
    const searchUrl = `https://1337x.to{encodeURIComponent(title)}/seeders/desc/1/`;

    try {
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const torrentPage = $('td.coll-1.name a').last().attr('href');

        if (torrentPage) {
            const pData = await axios.get(`https://1337x.to${torrentPage}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $$ = cheerio.load(pData.data);
            const magnet = $$('a[href^="magnet:"]').attr('href');
            const infoHash = magnet.match(/btih:([a-zA-Z0-9]+)/)[1];

            if (infoHash) {
                return {
                    streams: [{
                        name: "GioSubs Indexer",
                        title: `1337x: ${title}`,
                        infoHash: infoHash
                    }]
                };
            }
        }
        return { streams: [] };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
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
