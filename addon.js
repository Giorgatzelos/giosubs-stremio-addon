const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.final.catalog',
    version: '3.0.0',
    name: 'ToonsHub Catalog',
    description: 'Latest [ToonsHub] releases from Anirena',
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

// Συνάρτηση για να "ξεγελάμε" τα μπλοκαρίσματα
async function fetchPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });
        return response.data;
    } catch (e) {
        console.error("Fetch failed for:", url, e.message);
        return null;
    }
}

// 1. Κατάλογος από Anirena (πιο σταθερό selector)
builder.defineCatalogHandler(async (args) => {
    const html = await fetchPage("https://anirena.com");
    if (!html) return { metas: [] };

    const $ = cheerio.load(html);
    const metas = [];

    // Στο Anirena τα torrents είναι συνήθως σε <tr> ή σε .torrent-box
    $('.torrent-box, tr').each((i, el) => {
        const titleElement = $(el).find('a').filter((i, a) => $(a).text().includes('[ToonsHub]')).first();
        const title = titleElement.text().trim();
        
        if (title && metas.length < 20) {
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

// 2. Meta Handler
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

// 3. Stream Handler (Απευθείας magnet)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('thub:', ''), 'base64').toString();
    const html = await fetchPage(`https://anirena.com{encodeURIComponent(title)}`);
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
