import { test as _test } from 'substance-test'
import { DefaultDOMElement } from 'substance'
import { compileRNG, validateXML, serializeXMLSchema, deserializeXMLSchema } from '../index.es.js'

function XMLSchemaTests (withSerialization) {
  const test = function (title, fn) {
    if (withSerialization) {
      title += ' [serialization]'
    }
    _test(title, fn)
  }

  test('XMLSchema: Sequence', (t) => {
    const RNG = `
      <grammar>
        <define name="a">
          <element name="a">
          </element>
        </define>
        <define name="b">
          <element name="b">
          </element>
        </define>
        <define name="c">
          <element name="c">
          </element>
        </define>
        <define name="foo">
          <element name="foo">
            <ref name="a"/>
            <ref name="b"/>
            <ref name="c"/>
          </element>
        </define>
        <start>
          <ref name="foo"/>
        </start>
      </grammar>
    `
    let xmlSchema = _compileRNG(RNG, withSerialization)
    let doc, result

    doc = DefaultDOMElement.parseXML(`
      <foo>
        <a/>
        <b/>
        <c/>
      </foo>
    `)
    result = validateXML(xmlSchema, doc)
    t.ok(result.ok, '(a,b,c) should be valid')

    doc = DefaultDOMElement.parseXML(`
      <foo>
        <a/>
        <c/>
      </foo>
    `)
    result = validateXML(xmlSchema, doc)
    t.notOk(result.ok, '(a,c) should not be valid')

    t.end()
  })

  test('XMLSchema: Interleaving', (t) => {
    const RNG = `
      <grammar>
        <define name="a">
          <element name="a">
          </element>
        </define>
        <define name="b">
          <element name="b">
          </element>
        </define>
        <define name="c">
          <element name="c">
          </element>
        </define>
        <define name="foo">
          <element name="foo">
            <interleave>
              <ref name="a"/>
              <ref name="b"/>
              <ref name="c"/>
            </interleave>
          </element>
        </define>
        <start>
          <ref name="foo"/>
        </start>
      </grammar>
    `
    let xmlSchema = _compileRNG(RNG, withSerialization)
    let doc, result
    doc = DefaultDOMElement.parseXML(`
      <foo>
        <a/>
        <b/>
        <c/>
      </foo>
    `)
    result = validateXML(xmlSchema, doc)
    t.ok(result.ok, '(a,b,c) should be valid')

    doc = DefaultDOMElement.parseXML(`
      <foo>
        <a/>
        <c/>
        <b/>
      </foo>
    `)
    result = validateXML(xmlSchema, doc)
    t.ok(result.ok, '(a,c,b) should be valid, too')

    doc = DefaultDOMElement.parseXML(`
      <foo>
        <a/>
        <b/>
      </foo>
    `)
    result = validateXML(xmlSchema, doc)
    t.notOk(result.ok, 'but (a,b) should not be valid')

    t.end()
  })

  const FOO = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <text/>
      </element>
    </define>
    <start>
      <ref name="foo"/>
    </start>
  </grammar>
  `
  test('XMLSchema: Text elements should be allowed to be empty', t => {
    let xmlSchema = _compileRNG(FOO)
    let doc = DefaultDOMElement.parseXML(`<foo></foo>`)
    let result = validateXML(xmlSchema, doc)
    t.ok(result.ok, 'empty text element is valid')
    t.end()
  })

  test('XMLSchema: Text elements should allow for CDATA', t => {
    let xmlSchema = _compileRNG(FOO, withSerialization)
    let doc = DefaultDOMElement.parseXML(`<foo><![CDATA[x^2 > y]]></foo>`)
    let result = validateXML(xmlSchema, doc)
    t.ok(result.ok, 'text element with CDATA is valid')
    t.end()
  })

  test('XMLSchema: unknown element', t => {
    let xmlSchema = _compileRNG(SEQUENCE, withSerialization)
    let doc = DefaultDOMElement.parseXML(`<foo><bar /></foo>`)
    let result = validateXML(xmlSchema, doc)
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const ZERO_OR_MORE_CHOICES = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <ref name="foo_content" />
      </element>
    </define>
    <define name="foo_content">
      <zeroOrMore>
        <choice>
          <text />
          <ref name="bar"/>
        </choice>
      </zeroOrMore>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo"/>
    </start>
  </grammar>
  `

  test('XMLSchema: zeroOrMore choices', t => {
    let xmlSchema = _compileRNG(ZERO_OR_MORE_CHOICES, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo>bla<bar>blupp</bar>bla</foo>`))
    t.ok(result.ok, 'xml is valid')
    t.end()
  })

  const SEQUENCE = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <ref name="foo_content" />
      </element>
    </define>
    <define name="foo_content">
      <ref name="bar"/>
      <ref name="baz"/>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo"/>
    </start>
  </grammar>
  `

  test('XMLSchema: sequence', t => {
    let xmlSchema = _compileRNG(SEQUENCE, withSerialization)
    let result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><baz>bla</baz><bar>blupp</bar></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const PLUS = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <ref name="foo_content" />
      </element>
    </define>
    <define name="foo_content">
      <oneOrMore>
        <ref name="bar"/>
      </oneOrMore>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo"/>
    </start>
  </grammar>
  `

  test('XMLSchema: plus', t => {
    let xmlSchema = _compileRNG(PLUS, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar></bar></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><bar /><bar /><bar /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const OPTIONAL = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <optional>
          <ref name="bar" />
        </optional>
      </element>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: optional', t => {
    let xmlSchema = _compileRNG(OPTIONAL, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><bar /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const SEQUENCE_OF_GROUPS = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <zeroOrMore>
          <ref name="bar" />
        </zeroOrMore>
        <zeroOrMore>
          <ref name="baz" />
        </zeroOrMore>
      </element>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: sequence of optional groups', t => {
    let xmlSchema = _compileRNG(SEQUENCE_OF_GROUPS, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><bar /><baz /><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><baz /><bar /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><baz /><bar /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const SEQUENCE_OF_OPTIONAL_AND_REQUIRED_ELEMENTS = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <ref name="bar" />
        <optional>
          <ref name="bla" />
          <ref name="blupp" />
        </optional>
        <ref name="baz" />
      </element>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <define name="bla">
      <element name="bla">
        <text />
      </element>
    </define>
    <define name="blupp">
      <element name="blupp">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: sequence of optional and required elements', t => {
    let xmlSchema = _compileRNG(SEQUENCE_OF_OPTIONAL_AND_REQUIRED_ELEMENTS, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><bla /><blupp /><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><blupp /><baz /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><bla /><blupp /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  const PARENT_SCHEMA = `
    <grammar>
      <define name="foo">
        <element name="foo">
          <ref name="foo_content" />
        </element>
      </define>
      <define name="foo_content">
        <text/>
      </define>
      <start>
        <ref name="foo"/>
      </start>
    </grammar>
  `

  const CHILD_SCHEMA = `
  <grammar>
    <include href="Parent.rng"/>
    <define name="foo_content">
      <zeroOrMore>
        <choice>
          <text />
          <ref name="bar" />
        </choice>
      </zeroOrMore>
    </define>
    <define name="bar">
      <element name="bar">
        <text/>
      </element>
    </define>
  </grammar>
  `

  const TWO_RNGS = {
    './lib/Parent.rng': PARENT_SCHEMA,
    './ChildSchema.rng': CHILD_SCHEMA
  }

  test('XMLSchema: including and extending another RNG', t => {
    let xmlSchema = compileRNG(new SimpleVFS(TWO_RNGS), ['.', './lib'], 'ChildSchema.rng')
    if (withSerialization) {
      xmlSchema = _withSerialization(xmlSchema)
    }
    let doc = DefaultDOMElement.parseXML(`<foo>bla<bar>blupp</bar>bla</foo>`)
    let result = validateXML(xmlSchema, doc)
    t.ok(result.ok, 'xml is valid')
    t.end()
  })

  const COMBINING_CHOICES = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <zeroOrMore>
          <choice>
            <ref name="group1" />
            <ref name="group2" />
          </choice>
        </zeroOrMore>
      </element>
    </define>
    <define name="group1">
      <choice>
        <ref name="bar" />
        <ref name="baz" />
      </choice>
    </define>
    <define name="group2">
      <choice>
        <ref name="bla" />
        <ref name="blupp" />
      </choice>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <define name="bla">
      <element name="bla">
        <text />
      </element>
    </define>
    <define name="blupp">
      <element name="blupp">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: combining choices', t => {
    let xmlSchema = _compileRNG(COMBINING_CHOICES, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><baz /><bla /><blupp /><baz /><blupp /></foo>`))
    t.ok(result.ok, 'xml is valid')
    t.end()
  })

  const REUSING_GROUPS = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <ref name="somegroup" />
        <ref name="bla" />
        <ref name="somegroup" />
      </element>
    </define>
    <define name="somegroup">
      <choice>
        <ref name="bar" />
        <ref name="baz" />
      </choice>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <define name="bla">
      <element name="bla">
        <oneOrMore>
          <ref name="somegroup" />
        </oneOrMore>
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: re-using groups', t => {
    let xmlSchema = _compileRNG(REUSING_GROUPS, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><baz /><bla><baz /><bar /></bla><bar /></foo>`))
    t.ok(result.ok, 'xml is valid')
    t.end()
  })

  const ALTERNATIVE_SUB_SEQUENCES = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <choice>
          <group>
            <ref name="bar"/>
            <ref name="baz"/>
          </group>
          <group>
            <ref name="bla"/>
            <ref name="blupp"/>
          </group>
        </choice>
      </element>
    </define>
    <define name="bar">
      <element name="bar">
        <text />
      </element>
    </define>
    <define name="baz">
      <element name="baz">
        <text />
      </element>
    </define>
    <define name="bla">
      <element name="bla">
        <text />
      </element>
    </define>
    <define name="blupp">
      <element name="blupp">
        <text />
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: alternative sequences', t => {
    let xmlSchema = _compileRNG(ALTERNATIVE_SUB_SEQUENCES, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><baz /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bla /><blupp /></foo>`))
    t.ok(result.ok, 'xml is valid')
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo><bar /><blupp /></foo>`))
    t.notOk(result.ok, 'xml is not valid')
    t.end()
  })

  // EDGE CASES

  const EMPTY_PLUS = `
  <grammar>
    <define name="foo">
      <element name="foo">
        <oneOrMore>
        </oneOrMore>
      </element>
    </define>
    <start>
      <ref name="foo" />
    </start>
  </grammar>
  `

  test('XMLSchema: empty plus (edge case)', t => {
    let xmlSchema = _compileRNG(EMPTY_PLUS, withSerialization)
    let result
    result = validateXML(xmlSchema, DefaultDOMElement.parseXML(`<foo></foo>`))
    t.ok(result.ok, 'xml is valid')
    t.end()
  })

// #################################### END ################################
}

XMLSchemaTests()
XMLSchemaTests('withSerialization')

const SLASH = '/'.charCodeAt(0)

class SimpleVFS {
  constructor (data) {
    this._data = data
  }
  readFileSync (path) {
    if (path.charCodeAt(0) === SLASH) {
      path = path.slice(1)
    }
    if (!this._data.hasOwnProperty(path)) {
      throw new Error('File does not exist: ' + path)
    }
    return this._data[path]
  }
  existsSync (path) {
    return this._data.hasOwnProperty(path)
  }
}

function _compileRNG (rngStr, withSerialization) {
  let xmlSchema = compileRNG(rngStr)
  if (withSerialization) {
    xmlSchema = _withSerialization(xmlSchema)
  }
  return xmlSchema
}

function _withSerialization (xmlSchema) {
  let str = serializeXMLSchema(xmlSchema)
  return deserializeXMLSchema(str)
}
