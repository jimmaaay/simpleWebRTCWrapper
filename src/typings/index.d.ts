export interface UnknownObject {
  [key: string]: any,
}

export interface Options {
  maxChunkSize: number,
  stunServers: Array<string>,
  sdpConstraints: any,
}

export interface ObjectPart {
  total: number,
  chunks: Array<Uint8Array>,
}

export interface ObjectParts {
  [key: string]: ObjectPart,
}

export interface CreateRoomObject {
  finishCreatingRoom: Function,
  offer: string,
}