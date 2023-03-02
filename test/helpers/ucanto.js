import { connect } from '@ucanto/client'
import * as CAR from '@ucanto/transport/car'
import * as CBOR from '@ucanto/transport/cbor'
import * as HTTP from '@ucanto/transport/http'

/**
 * Create a ucanto connection to a miniflare worker.
 * @template {Record<string, any>} T
 * @param {import('miniflare').Miniflare} miniflare
 * @param {import('@ucanto/interface').Principal} servicePrincipal
 * @returns {import('@ucanto/interface').ConnectionView<T>}
 */
export function miniflareConnection (miniflare, servicePrincipal) {
  return connect({
    id: servicePrincipal,
    encoder: CAR,
    decoder: CBOR,
    channel: HTTP.open({
      url: new URL('http://localhost:8787'),
      method: 'POST',
      fetch: miniflare.dispatchFetch.bind(miniflare)
    })
  })
}
