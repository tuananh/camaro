const t = require('tape')
const { transform } = require('../')

t.test('bare @attr on context node (README example)', async (t) => {
    const xml = `
        <players>
            <player jerseyNumber="10">
                <name>wayne rooney</name>
                <isRetired>false</isRetired>
                <yearOfBirth>1985</yearOfBirth>
            </player>
            <player jerseyNumber="7">
                <name>cristiano ronaldo</name>
                <isRetired>false</isRetired>
                <yearOfBirth>1985</yearOfBirth>
            </player>
        </players>
    `
    const template = ['players/player', {
        name: 'title-case(name)',
        jerseyNumber: '@jerseyNumber',
        yearOfBirth: 'number(yearOfBirth)',
        jerseyAsNumber: 'number(@jerseyNumber)',
        isRetired: 'boolean(isRetired = "true")'
    }]

    const result = await transform(xml, template)
    t.equal(result.length, 2)
    t.equal(result[0].jerseyNumber, '10')
    t.equal(result[0].jerseyAsNumber, 10)
    t.equal(result[0].name, 'Wayne Rooney')
    t.equal(result[0].yearOfBirth, 1985)
    t.equal(result[0].isRetired, false)
    t.equal(result[1].jerseyNumber, '7')
    t.equal(result[1].jerseyAsNumber, 7)
    t.equal(result[1].isRetired, false)
    t.end()
})
