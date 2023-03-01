import { Signer } from '@ucanto/principal/ed25519'
import { withCORSHeaders, withErrorHandler, withCORSPreflight, withHTTPPost, composeMiddleware } from './middleware.js'
import { createServer, createService } from './service.js'

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
  const service = createService({ clockNamespace: env.CLOCK })
  const server = createServer(signer, service)

  const { headers, body } = await server.request({
    body: new Uint8Array(await request.arrayBuffer()),
    headers: Object.fromEntries(request.headers)
  })

  return new Response(body, { headers })
}

export { DurableClock as DurableClock0 } from './durable-clock.js'
