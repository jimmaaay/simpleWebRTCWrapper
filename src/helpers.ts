// https://stackoverflow.com/questions/34057127/how-to-transfer-large-objects-using-postmessage-of-webworker
export const convertObjectToArrayBuffer = (obj) => {
  const string = JSON.stringify(obj);
  const { buffer } = new TextEncoder().encode(string);
  return buffer;
}

// https://stackoverflow.com/questions/34057127/how-to-transfer-large-objects-using-postmessage-of-webworker
export const arrayBufferToObject = (arrayBuffer) => {
  const { buffer } = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  const view = new DataView(buffer, 0, buffer.byteLength);
  const string = decoder.decode(view);
  return JSON.parse(string);
}

export const intRange = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
}