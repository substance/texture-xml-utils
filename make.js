/* eslint-disable no-template-curly-in-string */
const b = require('substance-bundler')
const rollup = require('substance-bundler/extensions/rollup')

const DIST = 'dist/'
const TMP = 'tmp/'

// Make Targets

b.task('clean', function () {
  b.rm(DIST)
  b.rm(TMP)
}).describe('removes all generated files and folders.')

b.task('publish', ['clean', 'build'])
  .describe('builds the distribution for publishing.')

b.task('default', ['publish'])
  .describe('default: publish')

b.task('build', ['build:lib'])

b.task('build:lib', () => {
  rollup(b, {
    input: 'index.es.js',
    output: [{
      file: DIST + 'texture-xml-utils.js',
      format: 'umd',
      name: 'TextureXMLTools',
      globals: {
        'substance': 'substance'
      }
    }, {
      file: DIST + 'texture-xml-utils.cjs.js',
      format: 'cjs'
    }, {
      file: DIST + 'texture-xml-utils.es.js',
      format: 'esm'
    }],
    external: [ 'substance' ]
  })
})

b.task('build:tests:browser', () => {
  rollup(b, {
    input: 'test/index.js',
    output: {
      file: TMP + 'tests.js',
      format: 'umd',
      name: 'tests',
      globals: {
        'substance': 'substance',
        'substance-test': 'substanceTest'
      }
    },
    external: [ 'substance', 'substance-test' ]
  })
})
