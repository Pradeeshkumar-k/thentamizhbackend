const https = require('https');

const url = 'https://thentamizhbackend.vercel.app/api/novels?limit=50';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.stack) {
                console.log('--- STACK TRACE ---');
                json.stack.split('\n').forEach(line => console.log(line));
            } else {
                console.log(JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.log(data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
