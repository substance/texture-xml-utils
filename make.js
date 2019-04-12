/* eslint-disable no-template-curly-in-string */
const b = require('substance-bundler')
const fs = require('fs')
const path = require('path')

const DIST = 'dist/'
const TMP = 'tmp/'

// Make Targets

b.task('clean', function () {
  b.rm(DIST)
  b.rm(TMP)
}).describe('removes all generated files and folders.')

b.task('publish', ['clean', 'build:schema', 'build:assets', 'build:lib'])
  .describe('builds the distribution for publishing.')

b.task('default', ['publish'])
  .describe('default: publish')

// low-level make targets

b.task('schema:jats', () => {
  _compileSchema('JATS-archiving-1.0', path.join(__dirname, 'jats', '1.0', 'JATS-archiving-1.0.rng'), [], [])
})

b.task('build:assets', function () {})

b.task('build:schema', ['schema:jats'])

b.task('build:lib', () => {})

/* HELPERS */

// TODO: generalize this so that we can use this build helper in Texture as well
function _compileSchema (name, src, searchDirs, deps, options = {}) {
  const DEST = `tmp/${name}.data.js`
  const ISSUES = `tmp/${name}.issues.txt`
  const SCHEMA = `tmp/${name}.schema.md`
  const entry = path.basename(src)
  b.custom(`Compiling schema '${name}'...`, {
    src: [src].concat(deps),
    dest: DEST,
    execute () {
      return new Promise(resolve => {
        setTimeout(() => {
          const { compileRNG, checkSchema } = require('substance')
          const xmlSchema = compileRNG(fs, searchDirs, entry)
          b.writeFileSync(DEST, `export default ${JSON.stringify(xmlSchema)}`)
          b.writeFileSync(SCHEMA, _xmlSchemaToMD(xmlSchema))
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

function _xmlSchemaToMD (xmlSchema) {
  const { _analyzeSchema } = require('substance')
  const PRE_START = '<pre style="white-space:pre-wrap;">'
  const PRE_END = '</pre>'

  let result = []
  let elementSchemas = xmlSchema._elementSchemas
  let elementNames = Object.keys(elementSchemas)
  _analyzeSchema(elementSchemas)

  elementNames.sort()
  let notImplemented = []
  result.push('# Texture Article')
  result.push('')
  result.push('This schema defines a strict sub-set of JATS-archiving 1.1 .')
  result.push('')
  result.push('## Supported Elements')
  result.push('')
  elementNames.forEach(name => {
    let elementSchema = elementSchemas[name]
    if (elementSchema.type === 'not-implemented') {
      notImplemented.push(elementSchema)
      return
    }
    result.push('### `<' + elementSchema.name + '>`')
    if (elementSchema.type === 'not-implemented') {
      result.push('Not implemented.')
    } else {
      let attributes = elementSchema.attributes
      let elementSpec = elementSchema.expr.toString()
      if (elementSpec.startsWith('(') && elementSpec.endsWith(')')) {
        elementSpec = elementSpec.slice(1, -1)
      }
      if (/^\s*$/.exec(elementSpec)) elementSpec = 'EMPTY'

      let parents = Object.keys(elementSchema.parents)
      if (parents.length === 0 && xmlSchema.getStartElement() !== name) {
        console.error('FIXME: element <%s> is not used anymore, we should remove it for now.', name)
      }

      result.push('')
      result.push('**Attributes**:')
      result.push(PRE_START)
      result.push(Object.keys(attributes).join(', '))
      result.push(PRE_END)
      result.push('**Contains**:')
      result.push(PRE_START)
      result.push(elementSpec)
      result.push(PRE_END)
      if (parents.length > 0) {
        result.push('**This element may be contained in:**')
        result.push(PRE_START)
        result.push(parents.join(', '))
        result.push(PRE_END)
      }
      result.push('')
    }
  })
  if (notImplemented.length > 0) {
    result.push('## Not Implemented')
    result.push(`
These elements have not been implemented yet and need go through the recommendation process.
If you want to contribute, go to [https://github.com/substance/texture/issues](https://github.com/substance/texture/issues)
and open a request if it does not exist yet. Please provide one ore multiple XML examples
and explanations that help understanding the use-case.
`)
    notImplemented.forEach(elementSchema => {
      result.push('- ' + elementSchema.name)
    })
  }

  return result.join('\n')
}
