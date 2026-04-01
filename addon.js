const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.proxy.catalog',
    version: '2.7.0',
    name: 'ToonsHub Proxy Catalog',
    description: 'Latest [ToonsHub] via Proxy',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['toonshub:'],
    catalogs: [{
        type: 'anime',
        id: 'toonshub_proxy',
        name: 'ToonsHub Latest'
    }]
};

const builder = new addonBuilder(manifest);

// Χρησιμοποιούμε έναν εναλλακτικό mirror του Nyaa που δεν μπλοκάρει το Render
const NYAA_MIRROR = "https://nyaa.land";

builder.defineCatalogHandler(async (args) => {
    try {
        const url = `${NYAA_MIRROR}${encodeURIComponent("[ToonsHub]")}`;
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        // Scraper για το Nyaa Mirror
        $('tr').each((i, el) => {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            if (title.includes('[ToonsHub]') && metas.length < 15) {
                metas.push({
                    id: `toonshub:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        });

        console.log(`Found ${metas.length} items`);
        return { metas: metas };
    } catch (e) {
        console.error("Mirror failed:", e.message);
        return { metas: [] };
    }
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('toonshub:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: 'https://placehold.jp',
            description: `ToonsHub Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('toonshub:', ''), 'base64').toString();
    try {
        const url = `${NYAA_MIRROR}${encodeURIComponent(title)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');

        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch && hashMatch[1]) {
                return {
                    streams: [{
                        name: "ToonsHub Proxy",
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
