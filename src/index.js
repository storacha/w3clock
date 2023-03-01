import * as Server from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as CBOR from '@ucanto/transport/cbor'
import { Signer } from '@ucanto/principal/ed25519'
import { withCORSHeaders, withErrorHandler, withCORSPreflight, withHTTPPost, composeMiddleware } from './middleware.js'
import { service } from './service.js'

export default {
  /** @type {import('./types').Handler} */
  fetch (request, env, ctx) {
    console.log(request.method, request.url)
    const middleware = composeMiddleware(
      withCORSPreflight,
      withCORSHeaders,
      withErrorHandler,
      withHTTPPost
    )
    return middleware(handler)(request, env, ctx)
  }
}

/** @type {import('./types').Handler} */
async function handler (request, env) {
  const signer = Signer.parse(env.PRIVATE_KEY)
  const server = Server.create({
    id: signer,
    encoder: CBOR,
    decoder: CAR,
    service: service({ clockNamespace: env.CLOCK }),
    catch: err => console.error(err)
  })

  const { headers, body } = await server.request({
    body: new Uint8Array(await request.arrayBuffer()),
    headers: Object.fromEntries(request.headers)
  })

  return new Response(body, { headers })
}

export { DurableClock as DurableClock0 } from './durable-clock.js'
