import OBSWebSocket from 'obs-websocket-js'
import { JSONRPCClient, JSONRPCServer, JSONRPCServerAndClient } from 'json-rpc-2.0'
import { v4 as uuid } from 'uuid'
import kebabCase from 'lodash/kebabCase'

import { MODULE_CODE, MODULE_NAME, OBS_EVENTS, OBS_REQUESTS, START_ARGS } from './constant.js'

const toEventName = (name) => {
  return `${MODULE_CODE}-${kebabCase(name)}`
}

const connectObs = async (serverAndClient, obsHost, obsPort, obsPassword) => {
  const obsInstance = new OBSWebSocket()

  obsInstance.on('ConnectionOpened', () => {
    console.info('Connected to OBS')
    serverAndClient.notify('event.new', {
      name: toEventName('ConnectionOpened'),
    })
  })

  obsInstance.on('ConnectionClosed', () => {
    console.info('Disconnected from OBS')
    serverAndClient.notify('event.new', {
      name: toEventName('ConnectionClosed')
    })
    setTimeout(() => connectObs(serverAndClient, obsHost, obsPort, obsPassword), 5000)
  })

  obsInstance.on('ConnectionError', (err) => {
    console.error(`Error OBS\n${err}`,)
    serverAndClient.notify('event.new', {
      name: toEventName('ConnectionError'),
      payload: err
    })

    setTimeout(() => connectObs(serverAndClient, obsHost, obsPort, obsPassword), 5000)
  })

  OBS_REQUESTS.forEach((item) => {
    serverAndClient.addMethod(item, async (data) => {
      return await obsInstance.call(item, data)
    })
  })

  OBS_EVENTS.forEach((item) => {
    obsInstance.on(item, (data) => {
      serverAndClient.notify('event.new', {
        name: toEventName(item),
        payload: data
      })
    })
  })

  obsInstance.connect(`ws://${obsHost}:${obsPort}`, obsPassword)
}

function onstart() {
  let ws

  const serverAndClient = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient((request) => {
      try {
        ws.send(JSON.stringify(request))
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error)
      }
    }, () => uuid())
  )

  const wsUri = START_ARGS['host'] ?? 'ws://localhost:8080/module'
  ws = new WebSocket(wsUri)

  ws.onopen = async () => {
    const result = await serverAndClient.request('session.register', {
      code: MODULE_CODE,
      name: MODULE_NAME
    })

    let obsHost = result?.find((c) => c.key === 'host')?.value ?? '127.0.0.1'
    let obsPort = result?.find((c) => c.key === 'port')?.value ?? '4455'
    let obsPassword = result?.find((c) => c.key === 'password')?.value ?? undefined

    connectObs(serverAndClient, obsHost, obsPort, obsPassword)
  }

  ws.onmessage = (event) => {
    serverAndClient.receiveAndSend(JSON.parse(event.data.toString()))
  }

  ws.onclose = (event) => {
    serverAndClient.rejectAllPendingRequests(`Connection is closed (${event.reason}).`)
  }

  ws.onerror = (event) => {
    console.error('error a', event)
  }
}

onstart()
