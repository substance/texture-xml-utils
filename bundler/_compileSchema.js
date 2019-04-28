const path = require('path')
const fs = require('fs')
const { compileRNG } = require('..')

module.exports = function _compileSchema (rngFile, searchDirs, options = {}) {
  const rngDir = path.dirname(rngFile)
  // Note: instead of using the absolute path to the rngFile
  // we register the dir as first search directory and use the
  // the basename (without dir) of the rng file relying on the rng lookup mechanism
  searchDirs.unshift(rngDir)
  const rngFileBase = path.basename(rngFile)
  return compileRNG(fs, searchDirs, rngFileBase)
}
