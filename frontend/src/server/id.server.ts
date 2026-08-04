import { typeid } from "typeid-js"

export function generateUserId(): string {
  return typeid("user").toString()
}
