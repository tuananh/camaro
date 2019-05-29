const { toJson } = require('./')

;(async function () {
    const xml = `
    <root text="im root">
        <items>
            <item>1</item>
            <item>2</item>
        </items>
    </root>`
    const result = await toJson(xml)
    console.log(result);
})()