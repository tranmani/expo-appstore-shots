/** The secure-enclave key, stubbed: a screenshot never signs a write. */
export const loadDeviceKey = async () => ({ publicJwk: { kty: 'EC', crv: 'P-256', x: 'demo', y: 'demo' } })
export const signProof = async () => 'demo-proof'
export const clearDeviceKey = async () => undefined
