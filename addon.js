const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.locke.indexer.catalog',
    version: '2.3.0',
    name: 'Locke Anime Catalog',
    description: 'Latest releases for Locke from Nyaa',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['locke:'],
    catalogs: [{
        type: 'anime',
        id: 'locke_main',
        name: 'Locke Latest',
        extra: [{ name: 'search', isRequired: false }]
    }]
};

const builder = new addonBuilder(manifest);

const DEFAULT_POSTER = 'https://placehold.jp';

builder.defineCatalogHandler(async (args) => {
    let query = "Locke"; // Αλλαγή σε Locke
    if (args.extra && args.extra.search) query = `Locke ${args.extra.search}`;

    const url = `https://nyaa.si{encodeURIComponent(query)}`;
    
    try {
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        // Scrape Nyaa.si
        $('tr').each((i, el) => {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            // Φιλτράρισμα για να περιέχει οπωσδήποτε τη λέξη Locke
            if (title.toLowerCase().includes('locke') && metas.length < 20) {
                metas.push({
                    id: `locke:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: DEFAULT_POSTER
                });
            }
        });

        return { metas };
    } catch (e) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('locke:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: DEFAULT_POSTER,
            description: `Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('locke:', ''), 'base64').toString();
    try {
        const url = `https://nyaa.si{encodeURIComponent(title)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');

        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch && hashMatch[1]) {
                return {
                    streams: [{
                        name: "Locke Player",
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
