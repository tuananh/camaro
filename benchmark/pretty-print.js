const benchmark = require('benchmark')
const fs = require('fs')
const { prettyPrint } = require('../')
const { pd } = require('pretty-data')

const suite = new benchmark.Suite()
const xml = fs.readFileSync('examples/ean.xml', 'utf-8')

suite.add('camaro prettyPrint()', function(deferred) {
    prettyPrint(xml).then(_ => deferred.resolve())
}, { defer: true })

suite.add('pretty-data', function () {
    pd.xml(xml)
})

suite.on('cycle', cycle)
suite.run()

function cycle(e) {
    console.log(e.target.toString())
}
