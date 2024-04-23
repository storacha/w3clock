import retry from 'p-retry'
import LRU from 'hashlru'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'

export { MultiBlockFetcher } from '@web3-storage/pail/block'

/**
 * @typedef {{ put: (block: import('multiformats').Block) => Promise<void> }} BlockPutter
 */

export class MemoryBlockstore {
  /** @param {Array<import('multiformats').Block>} [blocks] */
  constructor (blocks = []) {
    /** @type {{ get: (k: string) => Uint8Array | undefined, set: (k: string, v: Uint8Array) => void }} */
    this._data = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
  }

  /** @type { import('@web3-storage/pail/api').BlockFetcher['get']} */
  async get (cid) {
    const bytes = this._data.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  /** @param {import('multiformats').Block} block */
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
 * @param {import('@web3-storage/pail/api').BlockFetcher} fetcher
 * @param {import('@web3-storage/pail/api').BlockFetcher & BlockPutter} cache
 */
export function withCache (fetcher, cache) {
  return {
    /** @type { import('@web3-storage/pail/api').BlockFetcher['get']} */
    async get (cid) {
      try {
        const block = await cache.get(cid)
        if (block) return block
      } catch {}
      const block = await fetcher.get(cid)
      if (block) {
        // @ts-expect-error
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

  /** @type { import('@web3-storage/pail/api').BlockFetcher['get']} */
  async get (cid) {
    return await retry(async () => {
      const controller = new AbortController()
      const timeoutID = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch(new URL(`/ipfs/${cid}?format=raw`, this.#url), { signal: controller.signal })
        if (!res.ok) return
        const bytes = new Uint8Array(await res.arrayBuffer())
        const digest = await sha256.digest(bytes)
        if (!equals(digest.digest, cid.multihash.digest)) {
          throw new Error(`failed sha2-256 content integrity check: ${cid}`)
        }
        return { cid, bytes }
      } catch (err) {
        throw new Error(`failed to fetch block: ${cid}`, { cause: err })
      } finally {
        clearTimeout(timeoutID)
      }
    })
  }
}
