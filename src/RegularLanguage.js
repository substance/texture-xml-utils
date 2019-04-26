import { forEach, isString } from 'substance'
import DFABuilder from './DFABuilder'
import DFA from './DFA'

const { START, END, TEXT, EPSILON } = DFA

// retains the structured representation
// and compiles a DFA for efficient processing
export class Expression {
  // TODO: why does the expression need a name?
  constructor (name, root) {
    this.name = name
    this.root = root

    this._initialize()
  }

  _initialize () {
    this._compile()
  }

  toString () {
    return this.root.toString()
  }

  toJSON () {
    return {
      name: this.name,
      content: this.root.toJSON()
    }
  }

  isAllowed (tagName) {
    return Boolean(this._allowedChildren[tagName])
  }

  /*
    Some structures get compiled into a DFA, for instance.
  */
  _compile () {
    this.root._compile()
  }

  _describeError (state, token) {
    let msg = []
    if (token !== TEXT) {
      if (!this.isAllowed(token)) {
        msg.push(`<${token}> is not valid in <${this.name}>\nSchema: ${this.toString()}`)
      } else {
        // otherwise just the position is wrong
        msg.push(`<${token}> is not allowed at the current position in <${this.name}>.\n${this.toString()}`)
      }
    } else {
      msg.push(`TEXT is not allowed at the current position: ${state.trace.join(',')}\n${this.toString()}`)
    }
    return msg.join('')
  }
}

Expression.fromJSON = function (data) {
  const name = data.name
  const root = _fromJSON(data.content)
  return createExpression(name, root)
}

export function createExpression (name, root) {
  if (root instanceof Interleave) {
    return new InterleaveExpr(name, root)
  } else {
    return new DFAExpr(name, root)
  }
}

export class DFAExpr extends Expression {
  getInitialState () {
    return {
      dfaState: START,
      errors: [],
      trace: []
    }
  }

  consume (state, token) {
    const dfa = this.dfa
    let oldState = state.dfaState
    let newState = dfa.consume(oldState, token)
    state.dfaState = newState
    if (newState === -1) {
      state.errors.push({
        msg: this._describeError(state, token),
        // HACK: we want to have the element with the errors
        // but actually, here we do not know about that context
        el: state.el
      })
      return false
    } else {
      state.trace.push(token)
      return true
    }
  }

  isFinished (state) {
    return this.dfa.isFinished(state.dfaState)
  }

  _initialize () {
    super._initialize()

    this._computeAllowedChildren()
  }

  _compile () {
    super._compile()
    this.dfa = new DFA(this.root.dfa.transitions)
  }

  _computeAllowedChildren () {
    this._allowedChildren = _collectAllTokensFromDFA(this.dfa)
  }

  _isValid (_tokens) {
    let state = this.getInitialState()
    for (let i = 0; i < _tokens.length; i++) {
      const token = _tokens[i]
      // Note: there might be some elements which
      // are not relevant, such as empty text nodes
      // or comments etc.
      if (!token) continue
      if (!this.consume(state, token)) {
        return false
      }
    }
    return this.isFinished(state)
  }
}

function _collectAllTokensFromDFA (dfa) {
  // Note: collecting all children
  const children = {}
  if (dfa.transitions) {
    forEach(dfa.transitions, (T) => {
      Object.keys(T).forEach((tagName) => {
        if (tagName === EPSILON) return
        children[tagName] = true
      })
    })
  }
  return children
}

export class InterleaveExpr extends Expression {
  getInitialState () {
    const dfas = this.dfas
    const dfaStates = new Array(dfas.length)
    dfaStates.fill(START)
    return {
      dfaStates,
      errors: [],
      trace: [],
      // maintain the index of the dfa which has been consumed the last token
      lastDFA: 0
    }
  }

  consume (state, token) {
    const idx = this._findNextDFA(state, token)
    if (idx < 0) {
      state.errors.push({
        msg: this._describeError(state, token)
      })
      return false
    } else {
      const dfa = this.dfas[idx]
      const oldState = state.dfaStates[idx]
      const newState = dfa.consume(oldState, token)
      state.dfaStates[idx] = newState
      state.trace.push(token)
      return true
    }
  }

  isFinished (state) {
    const dfas = this.dfas
    for (let i = 0; i < dfas.length; i++) {
      const dfa = dfas[i]
      const dfaState = state.dfaStates[i]
      if (!dfa.isFinished(dfaState)) {
        return false
      }
    }
    return true
  }

  _initialize () {
    super._initialize()

    this._computeAllowedChildren()
  }

  _compile () {
    super._compile()

    this.blocks = this.root.blocks
    this.dfas = this.blocks.map(b => new DFA(b.dfa.transitions))
  }

  _computeAllowedChildren () {
    this._allowedChildren = Object.assign(...this.blocks.map((block) => {
      return _collectAllTokensFromDFA(block.dfa)
    }))
  }

  _findNextDFA (state, token) {
    console.assert(state.dfaStates.length === this.dfas.length)
    const dfas = this.dfas
    for (let i = 0; i < state.dfaStates.length; i++) {
      const dfa = dfas[i]
      const dfaState = state.dfaStates[i]
      if (dfa.canConsume(dfaState, token)) {
        return i
      }
    }
    return -1
  }
}

export class Token {
  constructor (name) {
    this.name = name
  }

  toString () {
    return this.name
  }

  toJSON () {
    return this.name
  }

  // copy () {
  //   return new Token(this.name)
  // }

  _normalize () {}

  _compile () {
    this.dfa = DFABuilder.singleToken(this.name)
  }
}

Token.fromJSON = function (data) {
  return new Token(data)
}

class GroupExpression {
  constructor (blocks) {
    this.blocks = blocks
  }

  toJSON () {
    return {
      type: this.token,
      blocks: this.blocks.map(b => b.toJSON())
    }
  }

  toString () {
    return '(' + this.blocks.map(b => b.toString()).join(this.token) + ')'
  }
}

/*
  (a|b|c)
*/
export class Choice extends GroupExpression {
  // copy () {
  //   return new Choice(this.blocks.map(b => b.copy()))
  // }

  // _normalize () {
  //   const blocks = this.blocks
  //   for (let i = blocks.length - 1; i >= 0; i--) {
  //     let block = blocks[i]
  //     block._normalize()
  //     // unwrap doubled Choices
  //     if (block instanceof Choice) {
  //       blocks.splice(i, 1, ...(block.blocks))
  //     }
  //   }
  // }

  _compile () {
    let dfa = new DFABuilder()
    this.blocks.forEach((block) => {
      if (block instanceof Token) {
        dfa.addTransition(START, END, block.name)
      } else if (block instanceof Interleave) {
        throw new Error('Nested interleave blocks are not supported.')
      } else {
        if (!block.dfa) {
          block._compile()
        }
        dfa.merge(block.dfa)
      }
    })
    this.dfa = dfa
    return dfa
  }

  get token () { return Choice.token }

  static get token () { return '|' }
}

Choice.fromJSON = function (data) {
  return new Choice(data.blocks.map((block) => {
    return _fromJSON(block)
  }))
}

/*
  (a,b,c) (= ordered)
*/
export class Sequence extends GroupExpression {
  // copy () {
  //   return new Sequence(this.blocks.map(b => b.copy()))
  // }

  _compile () {
    let dfa = new DFABuilder()
    this.blocks.forEach((block) => {
      if (block instanceof Token) {
        dfa.append(DFABuilder.singleToken(block.name))
      } else if (block instanceof Interleave) {
        throw new Error('Nested interleave blocks are not supported.')
      } else {
        if (!block.dfa) {
          block._compile()
        }
        dfa.append(block.dfa)
      }
    })
    this.dfa = dfa
    return dfa
  }

  get token () { return Sequence.token }

  static get token () { return ',' }
}

Sequence.fromJSON = function (data) {
  return new Sequence(data.blocks.map((block) => {
    return _fromJSON(block)
  }))
}

/*
  ~(a,b,c) (= unordered)
*/
export class Interleave extends GroupExpression {
  // copy () {
  //   return new Interleave(this.blocks.map(b => b.copy()))
  // }

  toString () {
    return '(' + this.blocks.map(b => b.toString()).join(', ') + ')[unordered]'
  }

  _normalize () {}

  _compile () {
    this.blocks.forEach(block => block._compile())
  }

  get token () { return Interleave.token }

  static get token () { return '~' }
}

Interleave.fromJSON = function (data) {
  return new Interleave(data.blocks.map((block) => {
    return _fromJSON(block)
  }))
}

class BlockExpression {
  constructor (block) {
    this.block = block
  }

  toJSON () {
    return {
      type: this.token,
      block: this.block.toJSON()
    }
  }

  toString () {
    return this.block.toString() + this.token
  }
}

/*
  ()?
*/
export class Optional extends BlockExpression {
  // copy () {
  //   return new Optional(this.block.copy())
  // }

  _compile () {
    const block = this.block
    if (block instanceof Interleave) {
      throw new Error('Nested interleave blocks are not supported.')
    }
    if (!block.dfa) {
      block._compile()
    }
    this.dfa = block.dfa.optional()
    return this.dfa
  }

  get token () { return Optional.token }

  static get token () { return '?' }
}

Optional.fromJSON = function (data) {
  return new Optional(_fromJSON(data.block))
}

/*
  ()*
*/
export class Kleene extends BlockExpression {
  // copy () {
  //   return new Kleene(this.block.copy())
  // }

  _compile () {
    const block = this.block
    if (block instanceof Interleave) {
      throw new Error('Nested interleave blocks are not supported.')
    }
    if (!block.dfa) {
      block._compile()
    }
    this.dfa = block.dfa.kleene()
    return this.dfa
  }

  get token () { return Kleene.token }

  static get token () { return '*' }
}

Kleene.fromJSON = function (data) {
  return new Kleene(_fromJSON(data.block))
}

/*
  ()+
*/
export class Plus extends BlockExpression {
  // copy () {
  //   return new Plus(this.block.copy())
  // }

  _compile () {
    const block = this.block
    if (block instanceof Interleave) {
      throw new Error('Nested interleave blocks are not supported.')
    }
    if (!block.dfa) {
      block._compile()
    }
    this.dfa = block.dfa.plus()
    return this.dfa
  }

  get token () { return Plus.token }

  static get token () { return '+' }
}

Plus.fromJSON = function (data) {
  return new Plus(_fromJSON(data.block))
}

function _fromJSON (data) {
  switch (data.type) {
    case ',':
      return Sequence.fromJSON(data)
    case '~':
      return Interleave.fromJSON(data)
    case '|':
      return Choice.fromJSON(data)
    case Optional.token:
      return Optional.fromJSON(data)
    case Plus.token:
      return Plus.fromJSON(data)
    case Kleene.token:
      return Kleene.fromJSON(data)
    default:
      if (isString(data)) {
        return new Token(data)
      }
      throw new Error('Unsupported data.')
  }
}
