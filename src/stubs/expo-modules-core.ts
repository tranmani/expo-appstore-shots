/**
 * expo-modules-core.
 *
 * The plumbing every expo native module is built on. Apps rarely import it
 * directly, but when they do it is almost always to ask, at module scope,
 * whether a native module is present — `requireOptionalNativeModule('Foo')` —
 * and branch on the answer.
 *
 * The honest answer here is "no native module": there is no native side. So
 * `requireOptionalNativeModule` returns null (the branch an app writes for a
 * platform that lacks the feature — usually web, which is exactly where we are),
 * and `requireNativeModule`, which is the *enforcing* form, returns a chainable
 * stand-in rather than throwing, because a throw at import time takes the whole
 * bundle down.
 */
import { anything } from './anything'

export const requireOptionalNativeModule = () => null
export const requireNativeModule = () => anything()
export const requireNativeViewManager = () => () => null
export const NativeModulesProxy = new Proxy({}, { get: () => anything() })

/** A real event emitter: `addListener` has to return a removable subscription. */
export class EventEmitter {
  addListener() {
    return { remove: () => undefined }
  }
  removeAllListeners() {}
  removeSubscription() {}
  emit() {}
  listenerCount() {
    return 0
  }
}

export class NativeModule extends EventEmitter {}
export class SharedObject extends EventEmitter {}
export class SharedRef extends EventEmitter {}

export class CodedError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
export class UnavailabilityError extends CodedError {
  constructor(moduleName: string, propertyName: string) {
    super('ERR_UNAVAILABLE', `${moduleName}.${propertyName} is not available on this platform`)
  }
}

export const Platform = { OS: 'ios', select: (spec: Record<string, unknown>) => spec.ios ?? spec.native ?? spec.default }
export const uuid = { v4: () => '00000000-0000-4000-8000-000000000000', v5: () => '00000000-0000-5000-8000-000000000000' }
export const createPermissionHook = () => () => [null, async () => ({ status: 'granted', granted: true })]
export const registerWebModule = <T,>(m: T) => m
export const reloadAppAsync = async () => undefined
