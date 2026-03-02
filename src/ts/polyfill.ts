import { ReadableStream, WritableStream, TransformStream } from "web-streams-polyfill/ponyfill/es2018";
import { Buffer as BufferPolyfill } from 'buffer'
import { polyfill as dragPolyfill} from "mobile-drag-drop"
import {scrollBehaviourDragImageTranslateOverride} from 'mobile-drag-drop/scroll-behaviour'
import rfdc from 'rfdc'
import { isIOS } from "./platform";
/**
 * Polyfill for structuredClone.
 * Falls back to rfdc (Really Fast Deep Clone) if structuredClone throws an error.
 */

const rfdcClone = rfdc({
  circles:false,
})
function safeStructuredClone<T>(data:T):T{
  try {
      return structuredClone(data)
  } catch {
      return rfdcClone(data)
  }
}

try {
    const testDom = document.createElement('div');
    const supports  = ('draggable' in testDom) || ('ondragstart' in testDom && 'ondrop' in testDom);
    testDom.remove()
    
    if((!supports) || isIOS()){
      (globalThis as { polyfilledDragDrop?: boolean }).polyfilledDragDrop = true
      dragPolyfill({
        // use this to make use of the scroll behaviour
        dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
        // holdToDrag: 400,
        forceApply: true
      });
    }
} catch {
    
}

globalThis.safeStructuredClone = safeStructuredClone

globalThis.Buffer = BufferPolyfill
if (!globalThis.WritableStream) {
  globalThis.WritableStream = WritableStream as unknown as typeof globalThis.WritableStream
}
if (!globalThis.ReadableStream) {
  globalThis.ReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream
}
if (!globalThis.TransformStream) {
  globalThis.TransformStream = TransformStream as unknown as typeof globalThis.TransformStream
}
