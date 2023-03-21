import { describe, it, beforeEach } from 'mocha'
import assert from 'assert'
import { Miniflare } from 'miniflare'
import { Signer } from '@ucanto/principal/ed25519'
import * as ClockCaps from '../../src/capabilities.js'
import { miniflareConnection } from '../helpers/ucanto.js'

describe('UCAN service', () => {
  /** @type {Signer.EdSigner} */
  let svc
  /** @type {Miniflare} */
  let mf
  /** @type {import('@ucanto/interface').ConnectionView<import('../../src/service').Service>} */
  let conn

  beforeEach(async () => {
    svc = await Signer.generate()

    mf = new Miniflare({
      wranglerConfigPath: true,
      wranglerConfigEnv: 'test',
      modules: true,
      bindings: { PRIVATE_KEY: Signer.format(svc) }
    })

    conn = miniflareConnection(mf, svc)
  })

  it('follows', async () => {
    const sundial = await Signer.generate()
    const alice = await Signer.generate()

    const proofs = [
      // delegate alice ability to add follows to the clock
      await ClockCaps.follow.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      }),
      // delegate alice ability to ask the clock who it is following
      await ClockCaps.following.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      })
    ]

    const res0 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res0.error)

    const res1 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res1.error)
    assert(Array.isArray(res1))
    assert.equal(res1.length, 1)
    assert.equal(res1[0][0], sundial.did())
    assert(Array.isArray(res1[0][1]))
    assert.equal(res1[0][1][0], alice.did())
  })

  it('follows a different clock', async () => {
    const sundial = await Signer.generate()
    const hourglass = await Signer.generate()
    const alice = await Signer.generate()

    const proofs = [
      // delegate alice ability to add follows to sundial
      await ClockCaps.follow.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      }),
      // delegate alice ability to ask sundial who it is following
      await ClockCaps.following.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      })
    ]

    const res0 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          with: hourglass.did()
        }
      })
      .execute(conn)

    assert(!res0.error)

    const res1 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res1.error)
    assert(Array.isArray(res1))
    assert.equal(res1.length, 1)
    assert.equal(res1[0][0], hourglass.did())
    assert(Array.isArray(res1[0][1]))
    assert.equal(res1[0][1][0], alice.did())
  })

  it('follows delegated clock and issuer', async () => {
    const sundial = await Signer.generate()
    const hourglass = await Signer.generate()
    const alice = await Signer.generate()
    const bob = await Signer.generate()

    const proofs = [
      // delegate alice ability to add follows to sundial for the hourglass and bob
      await ClockCaps.follow.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did(),
        nb: {
          iss: bob.did(),
          with: hourglass.did()
        }
      }),
      // delegate alice ability to ask sundial who it is following
      await ClockCaps.following.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      })
    ]

    // alice should not be able to add alice (implicit)
    const res0 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          with: hourglass.did()
        }
      })
      .execute(conn)

    assert(res0.error)
    assert.equal(res0.name, 'Unauthorized')
    assert.ok(res0.message.includes('missing nb.iss on claimed capability'))

    // alice should not be able to add follow for alice (explicit)
    const res1 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          iss: alice.did(),
          with: hourglass.did()
        }
      })
      .execute(conn)

    assert(res1.error)
    assert.equal(res1.name, 'Unauthorized')
    assert.ok(res1.message.includes('mismatched nb.iss'))

    // alice should not be able to add follow for sundial (implicit)
    const res2 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          iss: alice.did()
        }
      })
      .execute(conn)

    assert(res2.error)
    assert.equal(res2.name, 'Unauthorized')
    assert.ok(res2.message.includes('missing nb.with on claimed capability'))

    // alice should not be able to add follow for sundial (explicit)
    const res3 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          iss: alice.did(),
          with: sundial.did()
        }
      })
      .execute(conn)

    assert(res3.error)
    assert.equal(res3.name, 'Unauthorized')
    assert.ok(res3.message.includes('mismatched nb.with'))

    // alice should be able to add follow for hourglass and bob (explicit)
    const res4 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {
          iss: bob.did(),
          with: hourglass.did()
        }
      })
      .execute(conn)

    assert(!res4.error)

    const res5 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res5.error)
    assert(Array.isArray(res5))
    assert.equal(res5.length, 1)
    assert.equal(res5[0][0], hourglass.did())
    assert(Array.isArray(res5[0][1]))
    assert.equal(res5[0][1][0], bob.did())
  })

  it('unfollows', async () => {
    const sundial = await Signer.generate()
    const alice = await Signer.generate()

    const proofs = [
      // delegate alice ability to add follows to sundial
      await ClockCaps.follow.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      }),
      // delegate alice ability to remove follows from sundial
      await ClockCaps.unfollow.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      }),
      // delegate alice ability to ask sundial who it is following
      await ClockCaps.following.delegate({
        issuer: sundial,
        audience: alice,
        with: sundial.did()
      })
    ]

    const res0 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res0.error)
    assert(Array.isArray(res0))
    assert.equal(res0.length, 0)

    const res1 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res1.error)

    const res2 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res2.error)
    assert(Array.isArray(res2))
    assert.equal(res2.length, 1)
    assert.equal(res2[0][0], sundial.did())
    assert(Array.isArray(res2[0][1]))
    assert.equal(res2[0][1][0], alice.did())

    const res3 = await ClockCaps.unfollow
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res3.error)

    const res4 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: sundial.did(),
        proofs,
        nb: {}
      })
      .execute(conn)

    assert(!res4.error)
    assert(Array.isArray(res4))
    assert.equal(res4.length, 0)
  })
})
