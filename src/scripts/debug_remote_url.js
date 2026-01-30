const https = require('https');

const url = 'https://thentamizhbackend.vercel.app/api/novels?limit=10';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            const json = JSON.parse(data);
            console.log('Count:', json.data?.length || 0);
        } catch (e) {
            console.log('Raw Data:', data.substring(0, 100));
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
