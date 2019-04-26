import { isNumber, isArray } from 'substance'
import XMLSchema from './XMLSchema'
import ElementSchema from './ElementSchema'
import { Token, Choice, Sequence, Interleave, Optional, Kleene, Plus, DFAExpr, InterleaveExpr, createExpression } from './RegularLanguage'

/**
 * This implementation is creating a minified representation of a Schema.
 *
 * ```
 * [ [<string-literals...>], <rootElId>, [<elements...>] ]
 *
 * element: [ <nameId>, [<attributes...>], <content> ]
 * attribute: <nameId> (temporarily)
 * content: [<type>:'*?+si', []|<nameId> ]
 * ```
 */

class LiteralRegistry {
  constructor () {
    this._map = new Map()
  }

  register (literal) {
    if (!this._map.has(literal)) {
      this._map.set(literal, { literal, count: 0 })
    }
    this._map.get(literal).count++
  }

  computeRanks () {
    let entries = Array.from(this._map.values())
    entries.sort((a, b) => {
      return b.count - a.count
    })
    let L = entries.length
    for (let idx = 0; idx < L; idx++) {
      entries[idx].rank = idx
    }
    this._sortedLiterals = entries.map(e => e.literal)
  }

  getRank (literal) {
    return this._map.get(literal).rank
  }

  getSortedLiterals () {
    return this._sortedLiterals
  }
}

export function serializeXMLSchema (xmlSchema) {
  let literalRegistry = new LiteralRegistry()

  function _registerLiterals (o) {
    switch (o.constructor) {
      case XMLSchema: {
        literalRegistry.register(o.startElement)
        o.getTagNames().forEach(name => {
          _registerLiterals(o.getElementSchema(name))
        })
        break
      }
      case ElementSchema: {
        literalRegistry.register(o.name)
        Object.keys(o.attributes).forEach(attrName => {
          // TODO: later we should also register attribute values
          literalRegistry.register(attrName)
        })
        _registerLiterals(o.expr)
        break
      }
      case DFAExpr:
      case InterleaveExpr: {
        _registerLiterals(o.root)
        break
      }
      case Token: {
        literalRegistry.register(o.name)
        break
      }
      case Choice:
      case Sequence:
      case Interleave: {
        o.blocks.forEach(_registerLiterals)
        break
      }
      case Optional:
      case Kleene:
      case Plus: {
        _registerLiterals(o.block)
        break
      }
      default:
        throw new Error('FIXME')
    }
  }
  _registerLiterals(xmlSchema)

  literalRegistry.computeRanks()

  function _encode (o) {
    switch (o.constructor) {
      case XMLSchema: {
        return [
          literalRegistry.getRank(o.startElement),
          o.getTagNames().map(name => {
            return _encode(o.getElementSchema(name))
          })
        ]
      }
      case ElementSchema: {
        return [
          literalRegistry.getRank(o.name),
          o.type === 'text' ? 't' : 'e',
          Object.keys(o.attributes).map(attrName => {
            // TODO: later we should also register attribute values
            return literalRegistry.getRank(attrName)
          }),
          _encode(o.expr)
        ]
      }
      case DFAExpr:
      case InterleaveExpr: {
        return _encode(o.root)
      }
      case Token: {
        return literalRegistry.getRank(o.name)
      }
      case Choice:
      case Sequence:
      case Interleave: {
        return [
          o.token,
          o.blocks.map(_encode)
        ]
      }
      case Optional:
      case Kleene:
      case Plus: {
        return [
          o.token,
          _encode(o.block)
        ]
      }
    }
  }
  let data = { literals: literalRegistry.getSortedLiterals(), schema: _encode(xmlSchema) }

  return JSON.stringify(data)
}

export function deserializeXMLSchema (str) {
  let data = JSON.parse(str)
  let literals = data.literals
  let schemaData = data.schema

  function _decodeLiteral (d) {
    return literals[d]
  }

  let startElement = _decodeLiteral(schemaData[0])
  let elementSchemas = {}

  function _decodeExpression (d) {
    if (isNumber(d)) {
      return new Token(_decodeLiteral(d))
    } else if (isArray(d)) {
      let type = d[0]
      let content = d[1]
      switch (type) {
        case Sequence.token:
          return new Sequence(content.map(_decodeExpression))
        case Interleave.token:
          return new Interleave(content.map(_decodeExpression))
        case Choice.token:
          return new Choice(content.map(_decodeExpression))
        case Optional.token:
          return new Optional(_decodeExpression(content))
        case Plus.token:
          return new Plus(_decodeExpression(content))
        case Kleene.token:
          return new Kleene(_decodeExpression(content))
      }
    } else {
      throw new Error('invalid data')
    }
  }

  function _decodeElementSchemaData (d) {
    let name = _decodeLiteral(d[0])
    let type = d[1] === 't' ? 'text' : 'element'
    // TODO: at some point we gonna have more complex attribute specs
    let attributes = {}
    d[2].forEach(rank => {
      let literal = _decodeLiteral(rank)
      attributes[literal] = literal
    })
    let expr = createExpression(name, _decodeExpression(d[3]))
    return new ElementSchema(name, type, attributes, expr)
  }

  schemaData[1].forEach(elementSchemaData => {
    let elementSchema = _decodeElementSchemaData(elementSchemaData)
    elementSchemas[elementSchema.name] = elementSchema
  })

  let schema = new XMLSchema(elementSchemas, startElement)
  return schema
}
