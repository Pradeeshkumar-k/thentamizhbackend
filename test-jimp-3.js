
const lib = require('jimp');
const JimpClass = lib.Jimp;

console.log('lib.read exists?', !!lib.read);
console.log('JimpClass.read exists?', !!JimpClass.read);
console.log('diff between lib.Jimp and lib?', lib.Jimp === lib);
