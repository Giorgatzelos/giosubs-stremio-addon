const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.kitsu.catalog',
    version: '1.2.1',
    name: 'GioSubs Anime Catalog',
    description: 'Αυτόματος κατάλογος [GioSubs] με posters από Kitsu',
    resources: ['catalog', 'stream', 'meta'],
    types: ['anime', 'series'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_collection',
            name: 'GioSubs Anime',
            extra: [{ name: 'search', isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Συνάρτηση για αναζήτηση Poster από το Kitsu
async function getKitsuPoster(name) {
    try {
        const cleanName = name.replace(/\[.*?\]/g, "").trim();
        const resp = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(cleanName)}&page[limit]=1`);
        if (resp.data.data && resp.data.data.length > 0) {
            return resp.data.data[0].attributes.posterImage.small;
        }
    } catch (e) {
        return 'https://placehold.jp';
    }
    return 'https://placehold.jp';
}

// 1. Δημιουργία του Καταλόγου
builder.defineCatalogHandler(async (args) => {
    const url = `https://anirena.com[GioSubs]`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        const rows = $('.torrent-box, tr').toArray();
        for (const el of rows.slice(0, 15)) {
            const title = $(el).find('a').first().text().trim();
            if (title.includes('[GioSubs]')) {
                const poster = await getKitsuPoster(title);
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: poster
                });
            }
        }
        return { metas };
    } catch (e) { return { metas: [] }; }
});

// 2. Meta Handler
builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const poster = await getKitsuPoster(title);
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

// 3. Stream Handler
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const searchUrl = `https://1337x.to{encodeURIComponent(title)}/seeders/desc/1/`;
    
    try {
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const firstHref = $('td.coll-1.name a').last().attr('href');
        
        if (firstHref) {
            const pageData = await axios.get(`https://1337x.to${firstHref}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $$ = cheerio.load(pageData.data);
            const magnet = $$('a[href^="magnet:"]').attr('href');
            
            if (magnet) {
                const infoHashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
                if (infoHashMatch) {
                    return {
                        streams: [{
                            name: "GioSubs Player",
                            title: title,
                            infoHash: infoHashMatch[1] // Διόρθωση εδώ για το hash
                        }]
                    };
                }
            }
        }
        return { streams: [] };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
