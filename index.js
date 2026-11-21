import { mountOnce } from './src/mount-once.js'
import { createMemoRoute } from './src/routes.js'
import { MemoStore } from './src/store.js'

export const name = 'dsh-slipnote'
export const inject = ['webServer', 'connection']

/**
 * Host half. The browser half talks to this through /api/memo; no third-party
 * runtime dependency is needed because Node built-ins cover persistence and
 * the route handler.
 */
export function apply(ctx) {
  return mountOnce(() => {
    return ctx.effect(() => {
      const store = new MemoStore()
      store.load()
      const disposeRoute = ctx.webServer.register(
        createMemoRoute(store, {
          requestRejection: (request) => ctx.connection.requestRejection(request),
        }),
      )
      return () => {
        disposeRoute?.()
      }
    })
  })
}
