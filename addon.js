const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.indexer.catalog',
    version: '2.6.0',
    name: 'ToonsHub Anime Catalog',
    description: 'Latest releases for [ToonsHub] from Nyaa & Anirena',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['toonshub:'],
    catalogs: [{
        type: 'anime',
        id: 'toonshub_main',
        name: 'ToonsHub Latest'
    }]
};

const builder = new addonBuilder(manifest);

const DEFAULT_POSTER = 'https://placehold.jp[ToonsHub]';

builder.defineCatalogHandler(async (args) => {
    try {
        const query = "[ToonsHub]";
        const url = `https://nyaa.si{encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        $('tr').each((i, el) => {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            if (title.includes('[ToonsHub]') && metas.length < 15) {
                metas.push({
                    id: `toonshub:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: DEFAULT_POSTER
                });
            }
        });

        return { metas: metas };
    } catch (e) {
        // Fallback στο Anirena αν το Nyaa αποτύχει
        try {
            const { data } = await axios.get("https://anirena.com");
            const $ = cheerio.load(data);
            const metas = [];
            $('.torrent-box, tr').each((i, el) => {
                const title = $(el).find('a').first().text().trim();
                if (title.includes('[ToonsHub]') && metas.length < 15) {
                    metas.push({
                        id: `toonshub:${Buffer.from(title).toString('base64')}`,
                        name: title,
                        type: 'anime',
                        poster: DEFAULT_POSTER
                    });
                }
            });
            return { metas: metas };
        } catch (err) {
            return { metas: [] };
        }
    }
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('toonshub:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: DEFAULT_POSTER,
            description: `ToonsHub Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('toonshub:', ''), 'base64').toString();
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
                        name: "ToonsHub Player",
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
serveHTTP(builder.getInterface(), { port: port });
