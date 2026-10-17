import { readFileSync } from 'node:fs'
import ts from 'typescript'

export async function loadTs(path, imports = {}) {
  return import(tsModuleUrl(path, imports))
}

export function tsModuleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
        jsxFactory: 'window.SP_REACT.createElement'
      }
    }
  )
  for (const [specifier, url] of Object.entries(imports)) {
    outputText = outputText.replaceAll(`'${specifier}'`, JSON.stringify(url))
  }
  return moduleUrl(outputText)
}

export function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

export function fakeClock(t) {
  let now = 0
  let nextId = 0
  const timers = new Map()
  const originals = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  }
  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextId
    timers.set(id, { callback, at: now + delay })
    return id
  }
  globalThis.clearTimeout = (id) => timers.delete(id)
  t.after(() => Object.assign(globalThis, originals))
  return {
    async tick(ms) {
      const until = now + ms
      while (true) {
        const pending = [...timers.entries()].sort(
          (a, b) => a[1].at - b[1].at
        )[0]
        if (!pending || pending[1].at > until) break
        now = pending[1].at
        timers.delete(pending[0])
        pending[1].callback()
        await flush()
      }
      now = until
      await flush()
    }
  }
}

export async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
