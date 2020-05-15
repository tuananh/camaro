const { transform, ready } = require('../')

module.exports = async ({xml, template}) => {    
    await ready()
    return transform(xml, template)
}