const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const manifest = {
    id: 'org.giosubs.anirena.render',
    version: '1.0.0',
    name: 'Anirena GioSubs (Render)',
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
        console.error(e);
        return { streams: [] };
    }
});

// Το Render δίνει αυτόματα μια θύρα μέσω της μεταβλητής PORT
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
