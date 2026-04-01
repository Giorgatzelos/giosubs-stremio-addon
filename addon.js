const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.toonshub.simple.catalog',
    version: '4.1.0',
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

// Σταθερό Poster για να αποφύγουμε καθυστερήσεις
const DEFAULT_POSTER = 'https://placehold.jp[ToonsHub]';

builder.defineCatalogHandler(async (args) => {
    try {
        // Αναζήτηση απευθείας στο Anirena
        const url = "https://anirena.com";
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const metas = [];

        // Πιο απλός selector: βρίσκουμε όλα τα links που έχουν [ToonsHub] στο κείμενο
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
    } catch (e) {
        return { metas: [] };
    }
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
    try {
        const url = `https://anirena.com{encodeURIComponent(title)}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        
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
    } catch (e) {
        return { streams: [] };
    }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
