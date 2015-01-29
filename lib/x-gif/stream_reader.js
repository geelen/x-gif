"use strict";

export default class StreamReader {
  constructor(arrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
    this.index = 0;
    this.log("TOTAL LENGTH: " + this.data.length);
  }

  finished() {
    return this.index >= this.data.length;
  }

  readByte() {
    return this.data[this.index++];
  }

  peekByte() {
    return this.data[this.index];
  }

  skipBytes(n) {
    this.index += n;
  }

  peekBit(i) {
    return !!(this.peekByte() & (1 << 8 - i));
  }

  readAscii(n) {
    var s = '';
    for (var i = 0; i < n; i++) {
      s += String.fromCharCode(this.readByte());
    }
    return s;
  }

  isNext(array) {
    for (var i = 0; i < array.length; i++) {
      if (array[i] !== this.data[this.index + i]) return false;
    }
    return true;
  }

  log(str) {
//  console.log(this.index + ": " + str);
  }

  error(str) {
    console.error(this.index + ": " + str);
  }
}
