module.exports = function xmlSchemaToMD (xmlSchema) {
  const { _analyzeSchema } = require('..')
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
    result.push('## Not Implemented')
    notImplemented.forEach(elementSchema => {
      result.push('- ' + elementSchema.name)
    })
  }

  return result.join('\n')
}
