
const Jimp = require('jimp');
console.log('Type of Jimp:', typeof Jimp);
console.log('Jimp keys:', Object.keys(Jimp));
console.log('Has read?', !!Jimp.read);
console.log('Has AUTO?', !!Jimp.AUTO);
console.log('Has MIME_JPEG?', !!Jimp.MIME_JPEG);
console.log('Structure:', Jimp);
