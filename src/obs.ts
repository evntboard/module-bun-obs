import OBSWebSocket, { type OBSEventTypes } from 'obs-websocket-js';
import type { JSONRPCServerAndClient } from 'json-rpc-2.0';

import { toEventName } from './utils';
import { OBS_EVENTS, OBS_REQUESTS } from './constant';

export const connectObs = async (serverAndClient: JSONRPCServerAndClient, obsHost: string, obsPort: string, obsPassword?: string) => {
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
    obsInstance.on(item, (...data: Array<OBSEventTypes[keyof OBSEventTypes]>) => {
      serverAndClient.notify('event.new', {
        name: toEventName(item),
        payload: data[0]
      })
    })
  })

  obsInstance.connect(`ws://${obsHost}:${obsPort}`, obsPassword)
}