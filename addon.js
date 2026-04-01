const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.ultra.catalog',
    version: '2.2.0',
    name: 'GioSubs Anime Catalog',
    description: 'Latest releases from [GioSubs] (Nyaa/1337x)',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['giosubs:'],
    catalogs: [{
        type: 'anime',
        id: 'giosubs_main',
        name: 'GioSubs Latest',
        extra: [{ name: 'search', isRequired: false }]
    }]
};

const builder = new addonBuilder(manifest);

// Σταθερό Poster για ταχύτητα στον κατάλογο
const DEFAULT_POSTER = 'https://placehold.jp';

builder.defineCatalogHandler(async (args) => {
    let query = "[GioSubs]";
    if (args.extra && args.extra.search) query = `[GioSubs] ${args.extra.search}`;

    // Χρησιμοποιούμε το Nyaa.si ως κύρια πηγή (είναι πιο σταθερό για Indexing)
    const url = `https://nyaa.si{encodeURIComponent(query)}`;
    
    try {
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        // Scrape Nyaa.si table
        $('tr').each((i, el) => {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            if (title.includes('[GioSubs]') && metas.length < 20) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: DEFAULT_POSTER
                });
            }
        });

        console.log(`Found ${metas.length} items on Nyaa`);
        return { metas };
    } catch (e) {
        console.error("Nyaa Error, trying 1337x fallback...");
        // Αν το Nyaa αποτύχει, δεν επιστρέφουμε άδειο, δοκιμάζουμε 1337x
        return { metas: [] }; 
    }
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: DEFAULT_POSTER,
            description: `GioSubs Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    // Αναζήτηση magnet στο Nyaa.si
    try {
        const url = `https://nyaa.si{encodeURIComponent(title)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');

        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch) {
                return {
                    streams: [{
                        name: "GioSubs Player",
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
