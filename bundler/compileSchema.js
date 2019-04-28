const path = require('path')
const { serializeXMLSchema } = require('..')
const _compileSchema = require('./_compileSchema')

module.exports = function compileSchema (b, rngFile, options = {}) {
  let name = options.name || path.basename(rngFile, '.rng')
  let dest = options.dest || `tmp/${name}.data.js`
  let searchDirs = options.searchDirs || []
  let deps = options.deps || []
  b.custom(`Compiling schema '${name}'...`, {
    src: [rngFile].concat(deps),
    dest,
    execute () {
      return new Promise((resolve, reject) => {
        // TODO: why are we waiting here?
        setTimeout(() => {
          let xmlSchema = _compileSchema(rngFile, searchDirs, options)
          b.writeFileSync(dest, `export default ${serializeXMLSchema(xmlSchema)}`)
          resolve()
        }, 250)
      })
    }
  })
}
