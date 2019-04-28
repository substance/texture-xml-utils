import { DefaultDOMElement } from 'substance'
import _lookupRNG from './_lookupRNG'

export default function _expandIncludes (fs, path, currentDir, searchDirs, grammarEl) {
  let includes = grammarEl.findAll('include')
  if (includes.length === 0) return false
  includes.forEach(include => {
    const parent = include.parentNode
    const href = include.attr('href')
    const rngPath = _lookupRNG(fs, href, currentDir, searchDirs)
    if (!rngPath) throw new Error(`Could not find ${href}`)
    const rngStr = fs.readFileSync(rngPath, 'utf8')
    const rng = DefaultDOMElement.parseXML(rngStr, 'full-doc')
    const _grammarEl = rng.find('grammar')
    if (!_grammarEl) throw new Error('No grammar element found')
    let rngDir = path.dirname(rngPath)
    // expand the grammar recursively
    _expandIncludes(fs, path, rngDir, searchDirs, _grammarEl)
    // now replace the include element with the content of the expanded grammar
    _grammarEl.children.forEach((child) => {
      parent.insertBefore(child, include)
    })
    include.remove()
  })
  return true
}
