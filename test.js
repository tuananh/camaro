const {transform} = require('./')

;(async function () {
    const xml = '<root>world</root>'
    const result = await transform(xml, { hello: '/root'})
    console.log(result);
})()