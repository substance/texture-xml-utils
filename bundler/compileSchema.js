const path = require('path')
const fs = require('fs')
const xmlSchemaToMarkdown = require('./xmlSchemaToMarkdown')

// ATTENTION: this is still very experimental and should be improved if
// we are going to use it more widely
module.exports = function compileSchema (b, name, rngFile, searchDirs = [], deps = [], options = {}) {
  const DEST = `tmp/${name}.data.js`
  const ISSUES = `tmp/${name}.issues.txt`
  const SCHEMA = `tmp/${name}.schema.md`
  const rngDir = path.dirname(rngFile)
  const entry = path.basename(rngFile)
  searchDirs.unshift(rngDir)
  b.custom(`Compiling schema '${name}'...`, {
    rngFile: [rngFile].concat(deps),
    dest: DEST,
    execute () {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          // TODO: make sure that the rngFile exists
          const { compileRNG, checkSchema, serializeXMLSchema } = require('..')
          const xmlSchema = compileRNG(fs, searchDirs, entry)
          b.writeFileSync(DEST, `export default ${serializeXMLSchema(xmlSchema)}`)
          b.writeFileSync(SCHEMA, xmlSchemaToMarkdown(xmlSchema))
          if (options.debug) {
            const issues = checkSchema(xmlSchema)
            const issuesData = [`${issues.length} issues:`, ''].concat(issues).join('\n')
            b.writeFileSync(ISSUES, issuesData)
          }
          resolve()
        }, 250)
      })
    }
  })
}
