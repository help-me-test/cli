import { spawn } from "child_process"
import { toUpper, test, trim } from "ramda"
import { log, error, debug } from "./utils/log.js"

export const shell = (
  command,
  cwd = ".",
  onStdout = () => {},
  onStderr = () => {},
) => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, { cwd, shell: true })
    let stdout = ""
    let stderr = ""

    childProcess.stdout.on("data", (data) => {
      const d = data.toString()
      onStdout(d)
      stdout += d
    })

    childProcess.stderr.on("data", (data) => {
      const d = data.toString()
      onStderr(d)
      stderr += d
    })
    childProcess.on("error", (error) => {
      reject(error)
    })

    childProcess.on("close", (code) => {
      if (code !== 0) {
        error({ stderr, stdout })
        reject(new Error(`Command failed with code ${code}`))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}
const logRequest = (method, host, uri, data) => {
  debug(`${toUpper(method)} ${host}${uri}`, data)
}

export const STREAM = async (host, uri, data = {}, onToken = console.log, headers = {}) => {
  logRequest("POST", host, uri, data)
  const abortController = new AbortController()
  let reader = null
  try {
    const response = await fetch(`${host}${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(data),
      signal: abortController.signal
    })

    reader = response.body.getReader()

    let notDone = true
    let result = ""
    while (notDone) {
      try {
        const { done, value } = await reader.read()
        if (done) return result
        const string = new TextDecoder("utf-8").decode(value)
        result += string
        onToken(string)
      } catch (error) {
        // Abort fetch and cancel reader to close connection
        abortController.abort()
        if (reader) {
          try { await reader.cancel() } catch {}
        }
        throw error
      }
    }
  } catch (error) {
    // Always abort fetch and cancel reader to close connection
    abortController.abort()
    if (reader) {
      try { await reader.cancel() } catch {}
    }
    throw error
  }
}

export const stream = (req, res, next = () => {}) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.stream = (e) => {
    if (typeof e === 'string' && !trim(e)) return

    if (typeof e === "object") {
      res.write(JSON.stringify(e) + "\n\n")
    } else {
      res.write(e.replace("\n", "\n\n"))
    }
  }

  req.on("close", () => res.end())
  next()
}

export const RESTREAM = (req, res, host, uri, data = {}) => {
  stream(req, res)
  return STREAM(host, uri, data, res.stream).finally(() => {
    // Add a small delay before ending to ensure all data is flushed
    setTimeout(() => res.end(), 100)
  })
}

export const GET = (uri, params = {}, responseFormat = "json", auth = null) => {
  let headers = {}
  if (auth) {
    headers["Authorization"] = `Bearer ${auth}`
  }
  const urlParams = new URLSearchParams(params).toString()
  return fetch(`${uri}?${urlParams}`, { headers }).then((response) =>
    response[responseFormat](),
  )
}

export const POST = (uri, body) => {
  debug(uri, body)
  return fetch(`${uri}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((x) => {
    const contentType = x.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return x.json()
    } else if (contentType && contentType.includes("text/plain")) {
      return x.text()
    } else if (contentType && contentType.includes("image/")) {
      return x.arrayBuffer()
    } else if (!contentType) {
      return x.text()
    } else {
      throw new Error("Unsupported content type: " + contentType)
    }
  })
  // .catch((error) => handleRequestError(error, "POST", uri, body));
}

export const PUT = (uri, body) => {
  debug(uri, body)
  return fetch(`${uri}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((x) => {
    const contentType = x.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return x.json()
    } else if (contentType && contentType.includes("text/plain")) {
      return x.text()
    } else if (!contentType) {
      return x.text()
    } else {
      throw new Error("Unsupported content type: " + contentType)
    }
  })
}

export const DELETE = (uri, params = {}) => {
  const urlParams = new URLSearchParams(params).toString()
  return fetch(`${uri}?${urlParams}`, {
    method: "DELETE",
  }).then((response) => response.json())
}

export const randomHash = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15)

export const fixUrl = (url) =>
  test(/^https?:\/\//, url) ? url : `http://${url}`

/**
 * Creates a memoized version of `fn` that caches results for a specified duration.
 *
 * The cached result remains valid for the given `interval`, after which it is discarded.
 *
 * @param {string|number} interval - The duration (in milliseconds or a string format like '2s', '1m') for which a computed result stays cached.
 * @param {Function} fn - The function to memoize.
 * @returns {Function} A memoized version of `fn` with a time-based cache expiry mechanism.
 */
import ms from "ms"
export function memoizeFor(interval, fn) {
  const time = ms(interval)
  const cache = new Map()

  return function (...args) {
    const key = JSON.stringify(args)
    const cached = cache.get(key)

    if (cached && Date.now() < cached.expiry) {
      return cached.value
    }

    const result = fn.apply(this, args)
    cache.set(key, { value: result, expiry: Date.now() + time })
    return result
  }
}

export function checkAccess(req, res, next) {
  // console.log(req.user, req.company)

  if (!req.user.isPartOfCompany) {
    return next({ error: "Unauthorized" })
  }

  next()
}
