const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.anirena.catalog',
    version: '1.6.0',
    name: 'GioSubs Anirena Catalog',
    description: 'Κατάλογος [GioSubs] από Anirena',
    resources: ['catalog', 'stream', 'meta'],
    types: ['anime'],
    idPrefixes: ['giosubs:'],
    catalogs: [
        {
            type: 'anime',
            id: 'giosubs_anirena',
            name: 'GioSubs Anirena',
            extra: [{ name: 'search', isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Ανάκτηση Poster από το Kitsu
async function fetchPoster(title) {
    try {
        const cleanTitle = title.replace(/\[.*?\]/g, "").trim().split(' - ')[0];
        const res = await axios.get(`https://kitsu.io[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`);
        if (res.data && res.data.data && res.data.data.length > 0) {
            return res.data.data[0].attributes.posterImage.small;
        }
    } catch (e) {
        console.error("Poster error");
    }
    return 'https://placehold.jp';
}

// 1. Κατάλογος από το Anirena
builder.defineCatalogHandler(async (args) => {
    try {
        const url = "https://anirena.com";
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        $('.torrent-box, tr').each((i, el) => {
            const title = $(el).find('a').first().text().trim();
            if (title.includes('[GioSubs]') && metas.length < 20) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp'
                });
            }
        });
        return { metas };
    } catch (e) {
        return { metas: [] };
    }
});

// 2. Meta Handler
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

// 3. Stream Handler
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const searchUrl = `https://anirena.com{encodeURIComponent(title)}`;
        const { data } = await axios.get(searchUrl);
        const $ = cheerio.load(data);
        
        // Ψάχνουμε το magnet link στη σελίδα των αποτελεσμάτων
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
serveHTTP(builder.getInterface(), { port });
}

// 1. Κατάλογος από το Anirena
builder.defineCatalogHandler(async (args) => {
    try {
        const url = `https://anirena.com`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        // Σκανάρισμα των torrent boxes του Anirena
        $('.torrent-box, tr').each((i, el) => {
            const link = $(el).find('a').first();
            const title = link.text().trim();
            
            if (title.includes('[GioSubs]') && metas.length < 20) {
                metas.push({
                    id: `giosubs:${Buffer.from(title).toString('base64')}`,
                    name: title,
                    type: 'anime',
                    poster: 'https://placehold.jp...' // Θα ανανεωθεί στο Meta
                });
            }
        });
        return { metas };
    } catch (e) { return { metas: [] }; }
});

// 2. Meta Handler (Εδώ φορτώνουμε το Poster)
builder.defineMetaHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    const poster = await fetchPoster(title);
    return {
        meta: {
            id: args.id,
            name: title,
            type: 'anime',
            poster: poster,
            description: `GioSubs Release found on Anirena: ${title}`
        }
    };
});

// 3. Stream Handler (Αναζήτηση magnet στο Anirena ή 1337x)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        // Πρώτη προσπάθεια στο Anirena
        const searchUrl = `https://anirena.com{encodeURIComponent(title)}`;
        const { data } = await axios.get(searchUrl);
        const $ = cheerio.load(data);
        const magnet = $('a[href^="magnet:"]').first().attr('href');

        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            if (hashMatch && hashMatch[1]) {
                return {
                    streams: [{
                        name: "GioSubs Anirena",
                        title: title,
                        infoHash: hashMatch[1]
                    }]
                };
            }
        }
        return { streams: [] };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
}

// 1. Κατάλογος από το Nyaa.si (Ο καλύτερος Indexer για Anime)
builder.defineCatalogHandler(async (args) => {
    try {
        const url = `https://nyaa.si`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metas = [];

        const rows = $('tr.success, tr.default').toArray();
        for (let el of rows.slice(0, 15)) {
            const title = $(el).find('td[colspan="2"] a').last().text().trim();
            if (title.includes('[GioSubs]')) {
                const poster = await fetchPoster(title);
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

// 3. Stream Handler (Αναζήτηση Magnet στο Nyaa)
builder.defineStreamHandler(async (args) => {
    const title = Buffer.from(args.id.replace('giosubs:', ''), 'base64').toString();
    try {
        const url = `https://nyaa.si{encodeURIComponent(title)}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        const magnet = $('td.text-center a[href^="magnet:"]').first().attr('href');
        
        if (magnet) {
            const hashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
            const infoHash = hashMatch ? hashMatch[1] : null;

            if (infoHash) {
                return {
                    streams: [{
                        name: "GioSubs Indexer",
                        title: title,
                        infoHash: infoHash
                    }]
                };
            }
        }
        return { streams: [] };
    } catch (e) { return { streams: [] }; }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
