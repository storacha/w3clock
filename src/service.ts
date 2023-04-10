import { Failure, ServiceMethod, DID } from '@ucanto/interface'
import { ClockAdvance, ClockHead } from './capabilities.js'
// import { ClockFollow, ClockUnfollow, ClockFollowing } from './capabilities.js'
import { EventLink } from '@alanshaw/pail/clock'

/** DID of a merkle clock. */
export type ClockDID = DID
/** DID of an clock event emitter (usually an agent). */
export type EmitterDID = DID

export interface Service<T> {
  clock: ClockService<T>
}

export interface ClockService<T> {
  advance: ServiceMethod<ClockAdvance, EventLink<T>[], Failure>
  head: ServiceMethod<ClockHead, EventLink<T>[], Failure>
  // follow: ServiceMethod<ClockFollow, {}, Failure>
  // unfollow: ServiceMethod<ClockUnfollow, {}, Failure>
  // following: ServiceMethod<ClockFollowing, Array<[ClockDID, EmitterDID[]]>, Failure>
}
