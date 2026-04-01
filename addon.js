const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.locke.final.catalog',
    version: '2.5.0',
    name: 'Locke Anime Catalog',
    description: 'Latest releases for Locke (Nyaa/Anirena Proxy)',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime'],
    idPrefixes: ['lock'],
    catalogs: [{
        type: 'anime',
        id: 'locke_main',
        name: 'Locke Latest'
    }]
};

const builder = new addonBuilder(manifest);

// Χρησιμοποιούμε έναν Proxy για το Nyaa για να μην μπλοκάρεται το Render
const NYAA_PROXY = "https://nyaa.si";

builder.defineCatalogHandler(async (args) => {
    try {
        const url = `${NYAA_PROXY}${encodeURIComponent("Locke")}`;
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000 
        });
        const $ = cheerio.load(data);
        const metas = [];

        // Scraper για το Nyaa
        $('tr').each((i, el) => {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            if (title.toLowerCase().includes('locke') && metas.length < 15) {
                metas.push({
                    id: `locke:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        });

        if (metas.length === 0) throw new Error("No items found");
        return { metas: metas };
    } catch (e) {
        console.log("Nyaa failed, checking Anirena...");
        // Fallback στο Anirena αν το Nyaa αποτύχει
        try {
            const { data } = await axios.get("https://anirena.com");
            const $ = cheerio.load(data);
            const metas = [];
            $('.torrent-box, tr').each((i, el) => {
                const title = $(el).find('a').first().text().trim();
                if (title.toLowerCase().includes('locke') && metas.length < 15) {
                    metas.push({
                        id: `locke:${Buffer.from(title).toString('base64')}`,
                        name: title,
                        type: 'anime',
                        poster: 'https://placehold.jp'
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
    const title = Buffer.from(args.id.replace('locke:', ''), 'base64').toString();
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: 'https://placehold.jp',
            description: `Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('locke:', ''), 'base64').toString();
    try {
        const url = `${NYAA_PROXY}${encodeURIComponent(title)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');

        if (magnet) {
            const hash = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hash && hash[1]) {
                return {
                    streams: [{
                        name: "Locke Player",
                        title: title,
                        infoHash: hash[1].toLowerCase()
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
