const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.proxy.final',
    version: '3.1.0',
    name: 'ToonsHub Catalog',
    description: 'Latest releases for [ToonsHub]',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['thub:'],
    catalogs: [{
        type: 'anime',
        id: 'thub_latest',
        name: 'ToonsHub Latest'
    }]
};

const builder = new addonBuilder(manifest);

// Χρησιμοποιούμε mirror που συνήθως είναι "ανοιχτός" στο Render
const BASE_URL = "https://nyaa.si";

async function getPage(query) {
    try {
        const res = await axios.get(BASE_URL + encodeURIComponent(query), {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0 Safari/537.36' },
            timeout: 12000
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

builder.defineCatalogHandler(async (args) => {
    const html = await getPage("[ToonsHub]");
    if (!html) return { metas: [] };

    const $ = cheerio.load(html);
    const metas = [];

    // Selector για τον πίνακα του Nyaa
    $('tr').each((i, el) => {
        const title = $(el).find('td[colspan="2"] a').last().text().trim();
        if (title.includes('[ToonsHub]') && metas.length < 20) {
            metas.push({
                id: `thub:${Buffer.from(title).toString('base64')}`,
                name: title,
                type: 'anime',
                poster: 'https://placehold.jp[ToonsHub]'
            });
        }
    });

    return { metas };
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('thub:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: 'https://placehold.jp[ToonsHub]',
            description: `ToonsHub Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('thub:', ''), 'base64').toString();
    const html = await getPage(title);
    if (!html) return { streams: [] };

    const $ = cheerio.load(html);
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
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
