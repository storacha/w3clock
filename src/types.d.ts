import { Failure, ServiceMethod, DID } from '@ucanto/interface'
import { ClockFollow, ClockUnfollow, ClockFollowing, ClockAdvance, ClockHead } from './capabilities.js'
import { EventLink } from '@alanshaw/pail/clock'

/** DID of a merkle clock. */
export type ClockDID = DID
/** DID of an clock event emitter (usually an agent). */
export type EmitterDID = DID

export interface Service {
  clock: {
    follow: ServiceMethod<ClockFollow, {}, Failure>
    unfollow: ServiceMethod<ClockUnfollow, {}, Failure>
    following: ServiceMethod<ClockFollowing, Array<[ClockDID, EmitterDID[]]>, Failure>
    advance: ServiceMethod<ClockAdvance, EventLink<any>[], Failure>
    head: ServiceMethod<ClockHead, EventLink<any>[], Failure>
  }
}
