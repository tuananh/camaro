const fs = require('fs')
const t = require('tape')
const { prettyPrint } = require('../')

const xml = fs.readFileSync('examples/simple.xml', 'utf-8')

t.test('pretty print default indentSize', async (t) => {
    
    const prettyStr = await prettyPrint(xml)
    t.equal(prettyStr, `<root text="im root">
  <items>
    <item>1</item>
    <item>2</item>
  </items>
  <stringfield>hello world</stringfield>
</root>\n`)

    t.end()
})

t.test('pretty print indentSize=4', async (t) => {
    
    const prettyStr = await prettyPrint(xml, { indentSize: 4})
    t.equal(prettyStr, `<root text="im root">
    <items>
        <item>1</item>
        <item>2</item>
    </items>
    <stringfield>hello world</stringfield>
</root>\n`)

    t.end()
})