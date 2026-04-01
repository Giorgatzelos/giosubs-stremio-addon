const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.proxy.v5',
    version: '5.0.0',
    name: 'ToonsHub Proxy Catalog',
    description: 'Latest [ToonsHub] via AllOrigins Proxy',
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

// Σταθερό Poster
const DEFAULT_POSTER = 'https://placehold.jp[ToonsHub]';

// ΣΥΝΑΡΤΗΣΗ PROXY: Χρησιμοποιεί το AllOrigins για να "κλέψει" το HTML
async function getHTML(url) {
    try {
        const proxyUrl = `https://allorigins.win{encodeURIComponent(url)}`;
        const response = await axios.get(proxyUrl, { timeout: 15000 });
        return response.data.contents; 
    } catch (e) {
        return null;
    }
}

builder.defineCatalogHandler(async (args) => {
    // Ψάχνουμε στο Anirena μέσω του Proxy
    const html = await getHTML("https://anirena.com");
    if (!html) return { metas: [] };

    const $ = cheerio.load(html);
    const metas = [];

    // Selector που πιάνει όλα τα links που περιέχουν [ToonsHub]
    $('a').each((i, el) => {
        const title = $(el).text().trim();
        const href = $(el).attr('href');

        if (title.includes('[ToonsHub]') && href && href.includes('?id=') && metas.length < 20) {
            metas.push({
                id: `thub:${Buffer.from(title).toString('base64')}`,
                name: title,
                type: 'anime',
                poster: DEFAULT_POSTER
            });
        }
    });

    return { metas: metas };
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('thub:', ''), 'base64').toString();
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
    const title = Buffer.from(args.id.replace('thub:', ''), 'base64').toString();
    const html = await getHTML(`https://anirena.com{encodeURIComponent(title)}`);
    if (!html) return { streams: [] };

    const $ = cheerio.load(html);
    const magnet = $('a[href^="magnet:"]').first().attr('href');

    if (magnet) {
        const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
        if (hashMatch) {
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
serveHTTP(builder.getInterface(), { port: port });
