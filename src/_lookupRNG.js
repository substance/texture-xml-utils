/**
 * Look up a RNG file from the current directory or a list of search directories.
 *
 * @param {*} fs
 * @param {*} rngFileName
 * @param {*} currentDir
 * @param {*} searchDirs
 */
export default function _lookupRNG (fs, rngFileName, currentDir, searchDirs) {
  let rngPath
  // 1. Try if the file can be found directly
  rngPath = rngFileName
  if (fs.existsSync(rngPath)) {
    return rngPath
  }
  // 2. Try the current directory
  rngPath = currentDir + '/' + rngFileName
  if (fs.existsSync(rngPath)) {
    return rngPath
  }
  // 3. Try the search directories
  for (let i = 0; i < searchDirs.length; i++) {
    rngPath = searchDirs[i] + '/' + rngFileName
    if (fs.existsSync(rngPath)) {
      return rngPath
    }
  }
}
