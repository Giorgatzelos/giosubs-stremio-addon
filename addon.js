const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.anirena.catalog',
    version: '1.9.0',
    name: 'GioSubs Anirena Catalog',
    description: 'Κατάλογος [GioSubs] από Anirena',
    resources: ['catalog', 'stream', 'meta'],
    types: ['anime'],
    idPrefixes: ['giosubs:'],
    catalogs: [{
        type: 'anime',
        id: 'giosubs_anirena',
        name: 'GioSubs Anirena'
    }]
};

const builder = new addonBuilder(manifest);

async function fetchPoster(title) {
    try {
        const cleanTitle = title.replace(/\[.*?\]/g, "").trim();
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`);
        if (res.data && res.data.data && res.data.data.length > 0) {
            return res.data.data[0].attributes.posterImage.small;
        }
    } catch (e) {
        console.log("Poster error");
    }
    return 'https://placehold.jp';
}

builder.defineCatalogHandler(async (args) => {
    try {
        const { data } = await axios.get("https://anirena.com");
        const $ = cheerio.load(data);
        const metas = [];

        $('.torrent-box, tr').each((i, el) => {
            const title = $(el).find('a').first().text().trim();
            if (title.includes('[GioSubs]') && metas.length < 15) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        });
        return { metas: metas };
    } catch (e) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const poster = await fetchPoster(title);
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: poster,
            description: `GioSubs Release: ${title}`
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const { data } = await axios.get(`https://anirena.com{encodeURIComponent(title)}`);
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');
        
        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch && hashMatch[1]) {
                return {
                    streams: [{
                        name: "GioSubs Anirena",
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
