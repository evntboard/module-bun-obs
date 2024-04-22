import kebabCase from 'lodash/kebabCase'
import { MODULE_CODE } from './constant'

export const toEventName = (name: string) : string => {
  return `${MODULE_CODE}-${kebabCase(name)}`
}
