const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.indexer.catalog',
    version: '1.4.0',
    name: 'GioSubs Anime Catalog',
    description: 'Αναζήτηση [GioSubs] σε Nyaa, Anirena & 1337x',
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

// Φέρνουμε Poster από το Kitsu API
async function fetchPoster(title) {
    try {
        const cleanTitle = title.replace(/\[.*?\]/g, "").trim();
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`);
        if (res.data && res.data.data && res.data.data[0]) {
            return res.data.data[0].attributes.posterImage.small;
        }
    } catch (e) {
        return 'https://placehold.jp';
    }
    return 'https://placehold.jp';
}

// 1. Κατάλογος από το Nyaa.si (Ο καλύτερος Indexer για Anime)
builder.defineCatalogHandler(async (args) => {
    try {
        const url = `https://nyaa.si`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        const rows = $('tr.success, tr.default').toArray();
        for (let el of rows.slice(0, 15)) {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
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
            description: `GioSubs Release: ${title}`
        }
    };
});

// 3. Stream Handler (Αναζήτηση Magnet στο Nyaa)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const url = `https://nyaa.si{encodeURIComponent(title)}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        const magnet = $('td.text-center a[href^="magnet:"]').first().attr('href');
        
        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            const infoHash = hashMatch ? hashMatch[1] : null;

            if (infoHash) {
                return {
                    streams: [{
                        name: "GioSubs Indexer",
                        title: title,
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
