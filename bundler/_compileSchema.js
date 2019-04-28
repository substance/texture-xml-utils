const fs = require('fs')
const path = require('path')
const { _compileRNG } = require('..')

module.exports = function _compileSchema (rngFile, searchDirs, options = {}) {
  return _compileRNG(fs, path, rngFile, searchDirs)
}
