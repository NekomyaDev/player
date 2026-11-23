// The example pages say what went wrong on the page itself, not only in the console: an error the page did not catch
// (a character that loaded but cannot be drawn, say), a promise nobody waited on, or one of the page's own scripts that
// did not load (three.js for a VRM from its CDN). A plain script, before the page's module: it is there even when that
// module cannot start.
(() => {
  let said = ''
  const say = (text) => {
    const status = document.getElementById('status')
    if (!status || !text || text === said) return
    said = text
    status.textContent = text
  }
  addEventListener('error', (e) => {
    const el = e.target
    if (el && el !== window && (el.tagName === 'SCRIPT' || el.tagName === 'LINK')) say(`A part of this page did not load (${el.src || el.href}): check the connection and reload.`)
    else if (e.message) say(`Something went wrong: ${String(e.error?.message ?? e.message).replace(/^Uncaught (\w*Error: )?/, '')}`)
  }, true)
  addEventListener('unhandledrejection', (e) => {
    if (e.reason?.name === 'AbortError') return
    say(`Something went wrong: ${e.reason?.message ?? e.reason}`)
  })
})()
