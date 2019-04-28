module.exports = function _xmlSchemaToMarkdown (xmlSchema, options = { headingLevelOffset: 0 }) {
  const { _analyzeSchema } = require('../dist/texture-xml-utils.cjs')

  const PRE_START = '<pre style="white-space:pre-wrap;">'
  const PRE_END = '</pre>'

  let result = []
  let elementSchemas = xmlSchema._elementSchemas
  let elementNames = Object.keys(elementSchemas)
  _analyzeSchema(elementSchemas)

  let headingLevelOffset = options.headingLevelOffset || 0
  function _header (level) {
    level += headingLevelOffset
    return Array(level).fill('#').join('')
  }

  result.push(_header(1) + ' Elements')
  result.push('')

  elementNames.sort()
  let notImplemented = []
  elementNames.forEach(name => {
    let elementSchema = elementSchemas[name]
    if (elementSchema.type === 'not-implemented') {
      notImplemented.push(elementSchema)
      return
    }
    result.push(_header(2) + ' `<' + elementSchema.name + '>`')
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
        console.error('Warning: element <%s> is not used.', name)
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
    result.push(_header(1) + ' Not Implemented')
    notImplemented.forEach(elementSchema => {
      result.push('- ' + elementSchema.name)
    })
  }

  return result.join('\n')
}
