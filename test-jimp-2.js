
const lib = require('jimp');
const JimpClass = lib.Jimp;

console.log('Class keys:', Object.keys(JimpClass));
console.log('Jimp.AUTO:', JimpClass.AUTO);
console.log('Jimp.MIME_JPEG:', JimpClass.MIME_JPEG);
console.log('JimpMime export:', lib.JimpMime);
