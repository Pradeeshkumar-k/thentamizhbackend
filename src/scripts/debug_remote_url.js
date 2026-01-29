const https = require('https');
const fs = require('fs');
const url = "https://thentamizhbackend.vercel.app/api/health";

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    fs.writeFileSync('debug_output.json', data);
    console.log('Response saved to debug_output.json');
  });
}).on("error", (err) => {

  console.log("Error: " + err.message);
});
