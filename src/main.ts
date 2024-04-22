import OBSWebSocket from 'obs-websocket-js'
import { JSONRPCClient, JSONRPCServer, JSONRPCServerAndClient } from 'json-rpc-2.0'
import { v4 as uuid } from 'uuid'

import { EVNTBOARD_HOST, MODULE_CODE, MODULE_NAME, MODULE_TOKEN } from './constant'
import { connectObs } from './obs.ts';

const main = async () => {

  if (!EVNTBOARD_HOST) {
    throw new Error('EVNTBOARD_HOST not set')
  }

  if (!MODULE_NAME) {
    throw new Error('MODULE_NAME not set')
  }

  if (!MODULE_TOKEN) {
    throw new Error('MODULE_TOKEN not set')
  }

  let ws: WebSocket

  const serverAndClient = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient((request) => {
      try {
        ws.send(JSON.stringify(request))
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error)
      }
    }, () => uuid()),
  )

  ws = new WebSocket(EVNTBOARD_HOST)

  ws.onopen = async () => {
    const result = await serverAndClient.request('session.register', {
      code: MODULE_CODE,
      name: MODULE_NAME,
      token: MODULE_TOKEN,
    }) as Array<{ key: string, value: unknown}>

    let obsHost = result?.find((c) => c.key === 'host')?.value as string ?? '127.0.0.1'
    let obsPort = result?.find((c) => c.key === 'port')?.value as string ?? '4455'
    let obsPassword = result?.find((c) => c.key === 'password')?.value as string ?? undefined

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

main()
  .catch((e) => {
    console.error(e)
  })