import { DefaultDOMElement, isArray } from 'substance'
import _expandIncludes from './_expandIncludes'

/*
  Loads a RNG with all dependencies into a DOM element
*/
export default function _loadRNG (fs, path, rngFile, searchDirs) {
  if (!isArray(searchDirs)) searchDirs = [searchDirs]
  let rngDir = path.dirname(rngFile)
  let rngStr = fs.readFileSync(rngFile, 'utf8')
  const rng = DefaultDOMElement.parseXML(rngStr, 'full-doc')
  const grammarEl = rng.find('grammar')
  _expandIncludes(fs, path, rngDir, searchDirs, grammarEl)
  return rng
}
