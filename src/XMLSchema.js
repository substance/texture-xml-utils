import { forEach } from 'substance'
import ElementSchema from './ElementSchema'
import _validateElement from './_validateElement'

export default class XMLSchema {
  constructor (elementSchemas, startElement, publicId, dtd) {
    if (!elementSchemas[startElement]) {
      throw new Error('startElement must be a valid element.')
    }
    this._elementSchemas = {}
    this.startElement = startElement
    this.publicId = publicId
    this.dtd = dtd
    // wrap schemas into ElementSchemas
    forEach(elementSchemas, (spec, name) => {
      this._elementSchemas[name] = new ElementSchema(spec.name, spec.type, spec.attributes, spec.expr)
    })
  }

  getIdAttribute () {
    return 'id'
  }

  getTagNames () {
    return Object.keys(this._elementSchemas)
  }

  getDocTypeParams () {
    return [this.startElement, this.publicId, this.dtd]
  }

  getElementSchema (name) {
    return this._elementSchemas[name]
  }

  getStartElement () {
    return this.startElement
  }

  validateElement (el) {
    let tagName = el.tagName
    let elementSchema = this.getElementSchema(tagName)
    return _validateElement(elementSchema, el)
  }
}
