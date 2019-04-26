import { Expression } from './RegularLanguage'
import DFA from './DFA'

export default class ElementSchema {
  constructor (name, type, attributes, expr) {
    this.name = name
    this.type = type
    this.attributes = attributes
    this.expr = expr

    if (!name) {
      throw new Error("'name' is mandatory")
    }
    if (!type) {
      throw new Error("'type' is mandatory")
    }
    if (!attributes) {
      throw new Error("'attributes' is mandatory")
    }
    if (!expr) {
      throw new Error("'expr' is mandatory")
    }
  }

  toJSON () {
    return {
      name: this.name,
      type: this.type,
      attributes: this.attributes,
      elements: this.expr.toJSON()
    }
  }

  isAllowed (tagName) {
    return this.expr.isAllowed(tagName)
  }

  isTextAllowed () {
    return this.expr.isAllowed(DFA.TEXT)
  }

  printStructure () {
    return `${this.name} ::= ${this.expr.toString()}`
  }

  findFirstValidPos (el, newTag) {
    return this.expr._findInsertPos(el, newTag, 'first')
  }

  findLastValidPos (el, newTag) {
    return this.expr._findInsertPos(el, newTag, 'last')
  }
}

ElementSchema.fromJSON = function (data) {
  return new ElementSchema(
    data.name,
    data.type,
    data.attributes,
    Expression.fromJSON(data.elements)
  )
}
