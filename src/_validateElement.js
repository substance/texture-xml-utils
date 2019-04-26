import _isTextNodeEmpty from './_isTextNodeEmpty'
import DFA from './DFA'

export default function _validateElement (elementSchema, el) {
  let errors = []
  let valid = true
  if (!elementSchema) {
    return {
      errors: [ {
        msg: `Unknown tag <${el.tagName}>.`,
        el
      } ],
      ok: false
    }
  }

  { // Attributes
    const res = _checkAttributes(elementSchema, el)
    if (!res.ok) {
      errors = errors.concat(res.errors)
      valid = false
    }
  }
  // Elements
  if (elementSchema.type === 'external' || elementSchema.type === 'not-implemented') {
    // skip
  } else {
    let res = _checkChildren(elementSchema, el)
    if (!res.ok) {
      errors = errors.concat(res.errors)
      valid = false
    }
  }
  return {
    errors,
    ok: valid
  }
}

function _checkAttributes(elementSchema, el) { // eslint-disable-line
  return { ok: true }
}

function _checkChildren (elementSchema, el) {
  // Don't validate external nodes
  if (elementSchema.type === 'external' || elementSchema.type === 'not-implemented') {
    return true
  }
  const isText = elementSchema.type === 'text'
  const expr = elementSchema.expr
  const state = expr.getInitialState()
  const iterator = el.getChildNodeIterator()
  let valid = true
  let tokenCount = 0
  while (valid && iterator.hasNext()) {
    const childEl = iterator.next()
    let token
    if (childEl.isTextNode()) {
      // Note: skipping empty text being child node of elements
      if (_isTextNodeEmpty(childEl)) {
        continue
      } else {
        token = DFA.TEXT
      }
    } else if (childEl.isElementNode()) {
      token = childEl.tagName
    } else if (childEl.getNodeType() === 'cdata') {
      // CDATA elements are treated as a TEXT fragment
      token = DFA.TEXT
    } else {
      continue
    }
    tokenCount++
    if (!expr.consume(state, token)) {
      valid = false
    }
  }
  // add the element to the errors
  if (state.errors.length > 0) {
    state.errors.forEach((err) => {
      err.el = el
    })
  }
  const isFinished = expr.isFinished(state)
  if (valid && !isFinished) {
    if (isText && tokenCount === 0) {
      // HACK: adding an exception here for text elements, as they are allowed to be empty
      // TODO: from an architectural point of view, this should be solved in the DFA in the first place
    } else {
      state.errors.push({
        msg: `<${el.tagName}> is incomplete.\nSchema: ${expr.toString()}`,
        el
      })
      valid = false
    }
  }
  if (valid) {
    state.ok = true
  }
  return state
}
