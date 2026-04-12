const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');

const manifest = {
    id: 'org.giosubs.anirena.vercel',
    version: '1.0.0',
    name: 'Anirena GioSubs (Vercel)',
    description: 'Αναζήτηση GioSubs στο Anirena API',
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tt', 'kitsu']
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        // Κλήση στο API του Anirena
        const response = await axios.post('https://anirena.com', {
            query: "GioSubs"
        });

        const torrents = response.data.results || [];

        const streams = torrents.map(t => ({
            name: "Anirena\nGioSubs",
            title: `${t.name}\n👤 Seeds: ${t.seeders}`,
            infoHash: t.infoHash
        }));

        return { streams };
    } catch (e) {
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();

// Export για τη Vercel
module.exports = async (req, res) => {
    const { url } = req;
    
    // Διαχείριση των routes (manifest.json, stream/...)
    if (url.endsWith('/manifest.json')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(addonInterface.manifest);
    } else if (url.includes('/stream/')) {
        const parts = url.split('/');
        const type = parts[parts.length - 2];
        const id = parts[parts.length - 1].replace('.json', '');
        
        const streamRes = await addonInterface.get('stream', type, id);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(streamRes);
    } else {
        res.status(404).send('Not Found');
    }
};
