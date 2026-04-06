const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.1337x.rss',
    version: '8.0.0',
    name: 'GioSubs 1337x Catalog',
    description: 'Latest [GioSubs] releases via 1337x RSS Feed',
    resources: ['catalog', 'meta', 'stream'],
    types: ['anime', 'movies'],
    idPrefixes: ['giosubs:'],
    catalogs: [{
        type: 'anime',
        id: 'giosubs_1337x',
        name: 'GioSubs Latest'
    }]
};

const builder = new addonBuilder(manifest);

const DEFAULT_POSTER = 'https://placehold.jp[GioSubs]';

// 1. Κατάλογος μέσω 1337x RSS για [GioSubs]
builder.defineCatalogHandler(async (args) => {
    try {
        const rssUrl = "https://1337x.to[GioSubs]/1/";
        const { data } = await axios.get(rssUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000 
        });
        
        const $ = cheerio.load(data, { xmlMode: true });
        const metas = [];

        $('item').each((i, el) => {
            const title = $(el).find('title').text().trim();
            if (title.includes('[GioSubs]') && metas.length < 20) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: DEFAULT_POSTER
                });
            }
        });

        return { metas };
    } catch (e) {
        console.error("RSS Fetch Error:", e.message);
        return { metas: [] };
    }
});

// 2. Meta Handler
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

// 3. Stream Handler (Magnet απευθείας από το RSS)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const rssUrl = `https://1337x.to${encodeURIComponent(title)}/1/`;
        const { data } = await axios.get(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data, { xmlMode: true });
        
        const magnet = $('item').first().find('link').text().trim();
        
        if (magnet && magnet.startsWith('magnet:')) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/i);
            if (hashMatch && hashMatch[1]) {
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
