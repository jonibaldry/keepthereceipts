import { typeid } from "typeid-js"

export function generateUserId(): string {
  return typeid("user").toString()
}

export function generateDocumentId(): string {
  return typeid("doc").toString()
}

export function generateAttachmentId(): string {
  return typeid("att").toString()
}

export function generateTakedownRequestId(): string {
  return typeid("takedown").toString()
}

export function generateTakedownAttachmentId(): string {
  return typeid("takedownatt").toString()
}
