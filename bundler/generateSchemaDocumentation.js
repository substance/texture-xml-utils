const path = require('path')
const _compileSchema = require('./_compileSchema')
const _xmlSchemaToMarkdown = require('./_xmlSchemaToMarkdown')

// ATTENTION: this is still very experimental and should be improved
module.exports = function generateSchemaDocumentation (b, rngFile, options = {}) {
  let name = options.name || path.basename(rngFile, '.rng')
  let dest = options.dest || `tmp/${name}.md`
  let searchDirs = options.searchDirs || []
  const rngDir = path.dirname(rngFile)
  searchDirs.unshift(rngDir)
  b.custom(`Generating schema documentation for '${name}'...`, {
    src: rngFile,
    dest,
    execute () {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const xmlSchema = _compileSchema(rngFile, searchDirs, options)
          let md = _xmlSchemaToMarkdown(xmlSchema, options)
          if (options.ammend) {
            md = options.ammend(md)
          }
          b.writeFileSync(dest, md)
          resolve()
        }, 250)
      })
    }
  })
}
