/** True for IPv4 127/8, ::1, and IPv4-mapped loopback spellings. */
export function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address === '') return false
  const value = address.toLowerCase()
  if (value === '::1' || value === '0:0:0:0:0:0:0:1') return true
  if (/^127(?:\.\d{1,3}){3}$/.test(value)) return true
  if (/^::ffff:127(?:\.\d{1,3}){3}$/.test(value)) return true
  if (value === '::ffff:7f00:1') return true
  return false
}

export function isLoopbackRequest(req) {
  return isLoopbackAddress(req?.socket?.remoteAddress)
}
