import lru from 'hashlru'

export class GatewayBlockFetcher {
  #url
  #cache

  /**
   * @param {string|URL} [url]
   * @param {number} [cacheSize]
   */
  constructor (url, cacheSize) {
    this.#url = new URL(url ?? 'https://freeway.dag.haus')
    this.#cache = lru(cacheSize ?? 100)
  }

  /**
   * @param {import('@alanshaw/pail/link').AnyLink} cid
   * @returns {Promise<import('@alanshaw/pail/block').AnyBlock | undefined>}
   */
  async get (cid) {
    let bytes = this.#cache.get(cid.toString())
    if (bytes) return { cid, bytes }
    const controller = new AbortController()
    const timeoutID = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(new URL(`/ipfs/${cid}?format=raw`, this.#url), { signal: controller.signal })
      if (!res.ok) return
      bytes = new Uint8Array(await res.arrayBuffer())
      this.#cache.set(cid.toString(), bytes)
      return { cid, bytes }
    } finally {
      clearTimeout(timeoutID)
    }
  }
}
