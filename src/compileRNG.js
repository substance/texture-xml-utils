import { isString, DefaultDOMElement, nameWithoutNS } from 'substance'
import XMLSchema from './XMLSchema'
import DFA from './DFA'
import { createExpression, Token, Choice, Sequence, Optional, Plus, Kleene, Interleave } from './RegularLanguage'
import _loadRNG from './_loadRNG'
import _analyzeSchema from './_analyzeSchema'
// import prettyPrintXML from './prettyPrintXML'

const TEXT = DFA.TEXT

/*
  We use regular RNG, with slight restrictions plus custom extensions,
  and compile it into our internal format.
*/
export default function compileRNG (fs, searchDirs, entry) {
  let rng
  // used for testing
  if (arguments.length === 1 && isString(arguments[0])) {
    rng = DefaultDOMElement.parseXML(arguments[0])
  } else {
    rng = _loadRNG(fs, searchDirs, entry)
  }

  let grammar = rng.find('grammar')
  if (!grammar) throw new Error('<grammar> not found.')

  // collect all definitions, allowing for custom overrides
  _registerDefinitions(grammar)

  // turn the RNG schema into our internal data structure
  let transformedGrammar = _transformRNG(grammar)

  // console.log(prettyPrintXML(transformedGrammar))

  let xmlSchema = _compile(transformedGrammar)

  return xmlSchema
}

/* Registration of <define> elements */

function _registerDefinitions (grammar) {
  let defs = {}
  // NOTE: definitions are only considered on the top level
  grammar.children.forEach(child => {
    const tagName = nameWithoutNS(child.tagName)
    if (tagName === 'define') {
      _processDefine(child, defs)
    }
  })
  grammar.defs = defs
}

function _processDefine (el, defs) {
  const name = el.attr('name')
  const combine = el.attr('combine')
  if (combine === 'interleave') {
    if (defs[name]) {
      defs[name].append(el.children)
    } else {
      defs[name] = el
    }
  } else {
    if (defs[name]) {
      // console.info(`Overwriting definition ${name}`)
    }
    defs[name] = el
  }
}

/* Transformation of RNG into internal representation */
function _transformRNG (grammar) {
  const $$ = grammar.createElement.bind(grammar)
  // remove everything elements from the grammar that have been tagged as 's:removed'
  grammar.findAll('removed').forEach(el => {
    let name = el.attr('name')
    grammar.findAll(`element[name="${name}"]`).forEach(el => {
      // console.log('removing <element>', name)
      el.remove()
    })
    grammar.findAll(`ref[name="${name}"]`).forEach(el => {
      // console.log('removing <ref>', name)
      el.remove()
    })
  })

  const elements = {}
  const defs = grammar.defs
  const elementDefinitions = grammar.findAll('define > element')
  const doc = DefaultDOMElement.createDocument('xml')
  const newGrammar = doc.createElement('grammar')

  // record all not implemented ones
  // we will allow to use them, but skip their content definition
  const notImplemented = grammar.findAll('not-implemented').reduce((s, el) => {
    let name = el.attr('name')
    if (name) s.add(name)
    return s
  }, new Set())

  // expand definitions
  elementDefinitions.forEach(el => {
    const name = el.attr('name')
    if (!name) throw new Error("'name' is mandatory.")
    let transformed
    if (notImplemented.has(name)) {
      transformed = $$('element').attr('name', name).attr('type', 'not-implemented')
    } else {
      transformed = _transformElementDefinition(doc, name, el, defs)
    }
    elements[name] = transformed
    newGrammar.appendChild(transformed)
  })

  // infer element types
  // TODO: do we need this anymore?
  const elementTypes = grammar.findAll('elementType')
  elementTypes.forEach(typeEl => {
    const name = typeEl.attr('name')
    let type = typeEl.attr('s:type') || typeEl.attr('type')
    if (!name || !type) throw new Error('Attributes name and type are mandatory.')
    const element = elements[name]
    if (!element) throw new Error(`Unknown element ${name}.`)
    element.attr('type', type)
  })

  // start element
  const startElement = _extractStart(grammar)
  if (!startElement) throw new Error('<start> is mandatory.')
  newGrammar.appendChild(doc.createElement('start').attr('name', startElement))

  return newGrammar
}

function _transformElementDefinition (doc, name, orig, defs) {
  let el = doc.createElement('element').attr('name', name)
  // TODO: try to separate attributes from children
  // now go through all children and wrap them into attributes and children
  let attributes = doc.createElement('attributes')
  let children = doc.createElement('children')
  orig.children.forEach((child) => {
    let block = _transformBlock(doc, child, defs, {})
    block.forEach((el) => {
      if (el.find('attribute') || el.is('attribute')) {
        attributes.appendChild(el)
      } else {
        children.appendChild(el)
      }
    })
  })
  el.appendChild(attributes)
  el.appendChild(children)

  /*
    Pruning (this is probably very slow!)
    - choice > choice
    - choice with one element
  */
  while (true) {
    // Unwrap nested choices
    let nestedChoice = children.find('choice > choice')
    if (nestedChoice) {
      // unwrap onto parent level
      let parentChoice = nestedChoice.parentNode
      // TODO: we could use DOM helpers as we do in Texture converters
      let children = nestedChoice.children
      children.forEach((child) => {
        parentChoice.insertBefore(child, nestedChoice)
      })
      parentChoice.removeChild(nestedChoice)
      continue
    }
    break
  }

  // Simplify singular choices
  let choices = children.findAll('choice')
  for (let i = 0; i < choices.length; i++) {
    let choice = choices[i]
    let children = choice.children
    if (children.length === 1) {
      choice.parentNode.replaceChild(choice, children[0])
    }
  }

  let optionalTextEls = children.findAll('optional > text, zeroOrMore > text')
  for (let i = 0; i < optionalTextEls.length; i++) {
    let textEl = optionalTextEls[i]
    let optionalEl = textEl.parentNode
    if (optionalEl.getChildCount() === 1) {
      optionalEl.parentNode.replaceChild(optionalEl, textEl)
    }
  }

  // remove empty groups
  let groupEls = children.findAll('optional, zeroOrMore, oneOrMore')
  for (let i = 0; i < groupEls.length; i++) {
    let groupEl = groupEls[i]
    if (groupEl.getChildCount() === 0) {
      groupEl.remove()
    }
  }

  return el
}

function _transformBlock (doc, block, defs, visiting = {}) {
  // if a block is a <ref> return the expanded children
  // otherwise clone the block and descend recursively
  const tagName = block.tagName
  switch (tagName) {
    case 'element': {
      return [doc.createElement('element').attr('name', block.attr('name'))]
    }
    case 'ref': {
      return _expandRef(doc, block, defs, visiting)
    }
    case 'empty':
    case 'notAllowed': {
      return []
    }
    default: {
      // TODO: while this is a valid approach, it could be more efficient
      // to 'reuse' already processed elements (i.e. reuse their DFA)
      // For that reason, I have commented out all occurrences where I used to resuse the DFA
      // being dead code at the moment
      let clone = block.clone(false)
      block.children.forEach((child) => {
        clone.append(_transformBlock(doc, child, defs, visiting))
      })
      return [clone]
    }
  }
}

function _expandRef (doc, ref, defs, visiting = {}) {
  const name = ref.attr('name')
  // Acquire semaphore against cyclic refs
  if (visiting[name]) {
    throw new Error('Cyclic references are not supported.')
  }
  visiting[name] = true

  const def = defs[name]
  if (!def) throw new Error(`Unknown definition ${name}`)

  let expanded = []
  let children = def.children
  children.forEach((child) => {
    let transformed = _transformBlock(doc, child, defs, visiting)
    expanded = expanded.concat(transformed)
  })

  // Releasing semaphore against cyclic refs
  delete visiting[name]
  return expanded
}

function _extractStart (grammar) {
  // for now this is hard wired to work with the start
  // element as defined in JATS 1.1
  const start = grammar.find('start')
  if (!start) {
    throw new Error('<grammar> must have a <start> element')
  }
  // HACK: we assume that there is exactly one ref to
  // an element definition
  const startRef = start.find('ref')
  if (!startRef) {
    throw new Error('Expecting one <ref> inside of <start>.')
  }
  const name = startRef.attr('name')
  return name
}

function _compile (grammar) {
  const schemas = {}
  const elements = grammar.children.filter(el => el.tagName === 'element')
  elements.forEach(element => {
    const name = element.attr('name')
    const attributes = _collectAttributes(element.find('attributes'))
    const children = element.find('children')
    const type = element.attr('type')
    let block = _processChildren(children, grammar)
    let expr = createExpression(name, block)
    let schema = { name, type, attributes, expr }
    schemas[name] = schema
  })

  // this adds some reflection info and derives the type
  _analyzeSchema(schemas)

  const start = grammar.find('start')
  if (!start) {
    throw new Error('<start> is mandatory')
  }
  const startElement = start.attr('name')
  if (!startElement) {
    throw new Error('<start> must have "name" set')
  }
  return new XMLSchema(schemas, startElement)
}

function _processChildren (el, grammar) {
  if (!el) return new Sequence([])
  let blocks = _processBlocks(el.children, grammar)
  if (blocks.length === 1) {
    return blocks[0]
  } else {
    return new Sequence(blocks)
  }
}

function _processBlocks (children, grammar) {
  const blocks = []
  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    // const name = child.attr('name')
    switch (child.tagName) {
      // skip these
      case 'attribute':
      case 'empty':
      case 'notAllowed': {
        break
      }
      case 'element': {
        const elName = child.attr('name')
        blocks.push(new Token(elName))
        break
      }
      case 'text': {
        blocks.push(new Token(TEXT))
        break
      }
      case 'ref': {
        const block = _processReference(child, grammar)
        blocks.push(block)
        break
      }
      case 'group': {
        blocks.push(_processSequence(child, grammar))
        break
      }
      case 'choice': {
        const block = _processChoice(child, grammar)
        blocks.push(block)
        break
      }
      case 'optional': {
        const block = new Optional(_processChildren(child, grammar))
        blocks.push(block)
        break
      }
      case 'oneOrMore': {
        const block = new Plus(_processChildren(child, grammar))
        blocks.push(block)
        break
      }
      case 'zeroOrMore': {
        const block = new Kleene(_processChildren(child, grammar))
        blocks.push(block)
        break
      }
      case 'interleave': {
        const block = new Interleave(_processBlocks(child.children, grammar))
        blocks.push(block)
        break
      }
      default:
        throw new Error('Not supported yet: ' + child.tagName)
    }
  }
  return blocks
}

function _processSequence (el, grammar) {
  // TODO: seems that this optimization is not needed any more as references get inlined.
  // looking at _expandRef() it looks as though the corresponding DOMElement gets cloned on recursion
  // see above
  // if (el.expr) return el.expr.copy()
  const blocks = _processBlocks(el.children, grammar)
  el.expr = new Sequence(blocks)
  return el.expr
}

function _processChoice (el, grammar) {
  // if (el.expr) return el.expr.copy()
  let blocks = _processBlocks(el.children, grammar)
  el.expr = new Choice(blocks)
  return el.expr
}

function _processReference (ref, grammar) {
  const name = ref.attr('name')
  const def = grammar.defs[name]
  if (!def) throw new Error(`Illegal ref: ${name} is not defined.`)
  // if (def.expr) return def.expr.copy()
  // Guard for cyclic references
  // TODO: what to do with cyclic refs?
  if (grammar._visiting[name]) {
    throw new Error('Cyclic references are not supported yet')
  }
  grammar._visiting[name] = true
  const block = _processChildren(def, grammar)
  def.expr = block
  delete grammar._visiting[name]
  return def.expr
}

function _collectAttributes (el, grammar, attributes = {}) {
  if (!el) return {}
  // ATTENTION: RNG supports more than we do here
  // We just collect all attributes, infering no rules
  let children = el.children
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.tagName) {
      case 'attribute': {
        const attr = _transformAttribute(child)
        attributes[attr.name] = attr
        break
      }
      case 'group':
      case 'choice':
      case 'optional':
      case 'oneOrMore':
      case 'zeroOrMore': {
        _collectAttributes(child, grammar, attributes)
        break
      }
      default:
        //
    }
  }
  return attributes
}

function _transformAttribute (el) {
  const name = el.attr('name')
  // TODO: extract all the attribute specs
  return {
    name
  }
}
