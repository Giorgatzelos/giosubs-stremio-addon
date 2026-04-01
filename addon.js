const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.proxy.final',
    version: '4.0.0',
    name: 'ToonsHub Catalog',
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

// Χρήση Proxy για παράκαμψη του μπλοκαρίσματος του Render
async function fetchWithProxy(url) {
    try {
        const proxyUrl = `https://allorigins.win{encodeURIComponent(url)}`;
        const response = await axios.get(proxyUrl, { timeout: 15000 });
        return response.data.contents; // Το AllOrigins επιστρέφει το HTML μέσα στο πεδίο contents
    } catch (e) {
        console.error("Proxy Fetch Failed:", e.message);
        return null;
    }
}

builder.defineCatalogHandler(async (args) => {
    const html = await fetchWithProxy("https://nyaa.si");
    if (!html) return { metas: [] };

    const $ = cheerio.load(html);
    const metas = [];

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
    const html = await fetchWithProxy(`https://nyaa.si{encodeURIComponent(title)}`);
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
