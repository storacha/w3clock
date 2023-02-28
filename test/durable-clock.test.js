import { describe, it } from 'mocha'
import assert from 'assert'
import { Signer } from '@ucanto/principal/ed25519'
import { DurableClock, follow, following, unfollow } from '../src/durable-clock.js'
import { MockState, MockStorage, MockNamespace } from './helpers/durable-objects.js'

describe('DurableClock', () => {
  it('follows', async () => {
    const clock = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const id = namespace.idFromName(clock.did())
    const storage = new MockStorage()
    const state = new MockState(id, storage)
    const obj = new DurableClock(state, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(id, obj)

    await follow(namespace, clock.did(), clock.did(), alice.did())

    const followings = await following(namespace, clock.did())
    assert.equal(followings.size, 1)
    const emitters = followings.get(clock.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))
  })

  it('follows a different clock', async () => {
    const clock = await Signer.generate()
    const target = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const clockID = namespace.idFromName(clock.did())
    const clockStorage = new MockStorage()
    const clockState = new MockState(clockID, clockStorage)
    const clockObj = new DurableClock(clockState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(clockID, clockObj)

    // need a target DO for subscribing
    const targetID = namespace.idFromName(target.did())
    const targetStorage = new MockStorage()
    const targetState = new MockState(targetID, targetStorage)
    const targetObj = new DurableClock(targetState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(targetID, targetObj)

    await follow(namespace, clock.did(), target.did(), alice.did())

    const followings = await following(namespace, clock.did())
    assert.equal(followings.size, 1)
    const emitters = followings.get(target.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))
  })

  it('unfollows', async () => {
    const clock = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const id = namespace.idFromName(clock.did())
    const storage = new MockStorage()
    const state = new MockState(id, storage)
    const obj = new DurableClock(state, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(id, obj)

    await follow(namespace, clock.did(), clock.did(), alice.did())

    let followings = await following(namespace, clock.did())
    assert.equal(followings.size, 1)
    let emitters = followings.get(clock.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))

    await unfollow(namespace, clock.did(), clock.did(), alice.did())

    followings = await following(namespace, clock.did())
    assert.equal(followings.size, 0)
    emitters = followings.get(clock.did())
    assert(!emitters)
  })

  it('unfollows a different clock', async () => {
    const clock = await Signer.generate()
    const target = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const clockID = namespace.idFromName(clock.did())
    const clockStorage = new MockStorage()
    const clockState = new MockState(clockID, clockStorage)
    const clockObj = new DurableClock(clockState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(clockID, clockObj)

    // need a target DO for subscribing
    const targetID = namespace.idFromName(target.did())
    const targetStorage = new MockStorage()
    const targetState = new MockState(targetID, targetStorage)
    const targetObj = new DurableClock(targetState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(targetID, targetObj)

    await follow(namespace, clock.did(), target.did(), alice.did())

    let followings = await following(namespace, clock.did())
    assert.equal(followings.size, 1)
    let emitters = followings.get(target.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))

    await unfollow(namespace, clock.did(), target.did(), alice.did())

    followings = await following(namespace, clock.did())
    assert.equal(followings.size, 0)
    emitters = followings.get(clock.did())
    assert(!emitters)
  })
})
