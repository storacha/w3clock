import retry from 'p-retry'
import LRU from 'hashlru'

export { MultiBlockFetcher } from '@alanshaw/pail/block'

/**
 * @typedef {{ put: (block: import('@alanshaw/pail/block').AnyBlock) => Promise<void> }} BlockPutter
 */

export class MemoryBlockstore {
  /** @param {import('@alanshaw/pail/block').AnyBlock[]} [blocks] */
  constructor (blocks = []) {
    /** @type {{ get: (k: string) => Uint8Array | undefined, set: (k: string, v: Uint8Array) => void }} */
    this._data = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
  }

  /**
   * @param {import('@alanshaw/pail/link').AnyLink} cid
   * @returns {Promise<import('@alanshaw/pail/block').AnyBlock | undefined>}
   */
  async get (cid) {
    const bytes = this._data.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  /** @param {import('@alanshaw/pail/block').AnyBlock} block */
  async put (block) {
    this._data.set(block.cid.toString(), block.bytes)
  }
}

export class LRUBlockstore extends MemoryBlockstore {
  /** @param {number} [max] */
  constructor (max = 50) {
    super()
    this._data = LRU(max)
  }
}

/**
 * @param {import('@alanshaw/pail/block').BlockFetcher} fetcher
 * @param {import('@alanshaw/pail/block').BlockFetcher & BlockPutter} cache
 */
export function withCache (fetcher, cache) {
  return {
    /**
     * @param {import('@alanshaw/pail/link').AnyLink} cid
     * @returns {Promise<import('@alanshaw/pail/block').AnyBlock | undefined>}
     */
    async get (cid) {
      try {
        const block = await cache.get(cid)
        if (block) return block
      } catch {}
      const block = await fetcher.get(cid)
      if (block) {
        await cache.put(block)
      }
      return block
    }
  }
}

export class GatewayBlockFetcher {
  #url

  /** @param {string|URL} [url] */
  constructor (url) {
    this.#url = new URL(url ?? 'https://ipfs.io')
  }

  /**
   * @param {import('@alanshaw/pail/link').AnyLink} cid
   * @returns {Promise<import('@alanshaw/pail/block').AnyBlock | undefined>}
   */
  async get (cid) {
    return await retry(async () => {
      const controller = new AbortController()
      const timeoutID = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch(new URL(`/ipfs/${cid}?format=raw`, this.#url), { signal: controller.signal })
        if (!res.ok) return
        const bytes = new Uint8Array(await res.arrayBuffer())
        return { cid, bytes }
      } catch (err) {
        throw new Error(`failed to fetch block: ${cid}`, { cause: err })
      } finally {
        clearTimeout(timeoutID)
      }
    })
  }
}
