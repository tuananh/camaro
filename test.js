const transform = require('./dist/camaro')

console.log(transform);

;(async function () {
    const xml = '<root>world</root>'
    const result = await transform(xml, { hello: '/root'})
    console.log(result);
})()