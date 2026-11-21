# Third-party notices

`dsh-slipnote` 0.2.1 is original code. No source text, CSS, or assets from another
project are copied into this package.

The following projects were consulted for public interfaces, behavior, and
integration patterns:

## dsh-web-notes 0.7.8

- License: Apache-2.0
- Used for: understanding the DSH client-plugin shape, the host-side atomic
  persistence pattern, the loopback route fence, and the idea of inserting text
  into the composer.
- No source files, CSS, or assets were copied. The implementation in this
  package was written independently against the current DSH 0.2.2 client APIs.
- If a future change copies code from `dsh-web-notes`, that file must carry a
  `Modified from dsh-web-notes src/...` header and the Apache-2.0 license and
  NOTICE obligations must be added to this file.

## DeepSeek Harness plugin templates

- Part of DeepSeek Harness.
- Used for: the `window.__ModuleLoader__.load({ id, factory })` browser bundle
  shape, the `dsh.bundle.patch` / `dsh.client` manifest fields, and the
  `main` + `sidebar.panellist` slot registration pattern.

## Runtime dependencies

None. `react` is a peer dependency supplied by DeepSeek Harness. The host half
uses Node.js built-in modules only.
