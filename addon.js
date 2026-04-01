const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'community.giosubs.1337x',
    version: '1.0.0',
    name: 'GioSubs 1337x',
    description: 'Φέρνει αποτελέσματα [GioSubs] απευθείας από mirrors του 1337x',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'kitsu']
};

const builder = new addonBuilder(manifest);

const proxies = [
    'https://1337x.to',
    'https://1337xto.to',
    'https://1337x.st',
    'https://x1337x.ws'
];

async function getMediaName(id) {
    try {
        if (id.startsWith('kitsu:')) {
            const resp = await axios.get(`https://anime-kitsu.strem.io/meta/anime/${id}.json`);
            return resp.data.meta.name;
        } else if (id.startsWith('tt')) {
            const resp = await axios.get(`https://v3-cinemeta.strem.io/meta/series/${id}.json`);
            return resp.data.meta.name;
        }
    } catch (e) { return null; }
}

async function fetchFrom1337x(searchPath) {
    for (let baseUrl of proxies) {
        try {
            const fullUrl = `${baseUrl}${searchPath}`;
            const response = await axios.get(fullUrl, { 
                timeout: 6000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
            });
            if (response.status === 200) return { data: response.data, baseUrl };
        } catch (e) { continue; }
    }
    return null;
}

builder.defineStreamHandler(async (args) => {
    const title = await getMediaName(args.id);
    if (!title) return { streams: [] };

    const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, "");
    const searchPath = `/sort-search/[GioSubs]%20${encodeURIComponent(cleanTitle)}/seeders/desc/1/`;

    const result = await fetchFrom1337x(searchPath);
    if (!result) return { streams: [] };

    const $ = cheerio.load(result.data);
    const streams = [];
    const rows = $('table.table-list tbody tr').toArray();

    for (const el of rows.slice(0, 3)) {
        const torrentName = $(el).find('td.coll-1.name a').last().text();
        const torrentHref = $(el).find('td.coll-1.name a').last().attr('href');
        const pageUrl = result.baseUrl + torrentHref;

        try {
            const pageData = await axios.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $$ = cheerio.load(pageData.data);
            const magnetLink = $$('a[href^="magnet:"]').attr('href');

            if (magnetLink) {
                const infoHashMatch = magnetLink.match(/btih:([a-zA-Z0-9]+)/);
                if (infoHashMatch) {
                    streams.push({
                        name: "GioSubs",
                        title: `📦 ${torrentName}\n👤 ${$(el).find('td.coll-2').text()} Seeders`,
                        infoHash: infoHashMatch[1]
                    });
                }
            }
        } catch (e) { continue; }
    }
    return { streams };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
