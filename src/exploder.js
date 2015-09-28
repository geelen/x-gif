"use strict";

import Gif from './gif.js';
import StreamReader from './stream_reader.js';
import { Promises } from './utils.js';

var url = (URL && URL.createObjectURL) ? URL : webkitURL;

var gifCache = new Map();
export default class Exploder {
  constructor(file) {
    this.file = file;
  }

  load() {
    var cachedGifPromise = gifCache.get(this.file)
    if (cachedGifPromise) return cachedGifPromise;

    var gifPromise = Promises.xhrGet(this.file, '*/*', 'arraybuffer')
      .then(buffer => this.explode(buffer));

    gifCache.set(this.file, gifPromise);
    return gifPromise;
  }

  explode(buffer) {
    console.debug("EXPLODING " + this.file)
    return new Promise((resolve, reject) => {
      var frames = [],
        streamReader = new StreamReader(buffer);

      // Ensure this is an animated GIF
      var type = streamReader.readAscii(6);
      if (!(type == "GIF89a" || type == 'GIF87a')) {
        reject(Error("Not a GIF!"));
        return;
      }

      streamReader.skipBytes(4); // Height & Width
      if (streamReader.peekBit(1)) {
        streamReader.log("GLOBAL COLOR TABLE")
        var colorTableSize = streamReader.readByte() & 0x07;
        streamReader.log("GLOBAL COLOR TABLE IS " + 3 * Math.pow(2, colorTableSize + 1) + " BYTES")
        streamReader.skipBytes(2);
        streamReader.skipBytes(3 * Math.pow(2, colorTableSize + 1));
      } else {
        streamReader.log("NO GLOBAL COLOR TABLE")
      }
      // WE HAVE ENOUGH FOR THE GIF HEADER!
      var gifHeader = buffer.slice(0, streamReader.index);

      var spinning = true, expectingImage = false;
      while (spinning) {

        if (streamReader.isNext([0x21, 0xFF])) {
          streamReader.log("APPLICATION EXTENSION")
          streamReader.skipBytes(2);
          var blockSize = streamReader.readByte();
          streamReader.log(streamReader.readAscii(blockSize));

          if (streamReader.isNext([0x03, 0x01])) {
            // we cool
            streamReader.skipBytes(5)
          } else {
            streamReader.log("A weird application extension. Skip until we have 2 NULL bytes");
            while (!(streamReader.readByte() === 0 && streamReader.peekByte() === 0));
            streamReader.log("OK moving on")
            streamReader.skipBytes(1);
          }
        } else if (streamReader.isNext([0x21, 0xFE])) {
          streamReader.log("COMMENT EXTENSION")
          streamReader.skipBytes(2);

          while (!streamReader.isNext([0x00])) {
            var blockSize = streamReader.readByte();
            streamReader.log(streamReader.readAscii(blockSize));
          }
          streamReader.skipBytes(1); //NULL terminator

        } else if (streamReader.isNext([0x2c])) {
          streamReader.log("IMAGE DESCRIPTOR!");
          if (!expectingImage) {
            // This is a bare image, not prefaced with a Graphics Control Extension
            // so we should treat it as a frame.
            frames.push({ index: streamReader.index, delay: 0 });
          }
          expectingImage = false;

          streamReader.skipBytes(9);
          if (streamReader.peekBit(1)) {
            streamReader.log("LOCAL COLOR TABLE");
            var colorTableSize = streamReader.readByte() & 0x07;
            streamReader.log("LOCAL COLOR TABLE IS " + 3 * Math.pow(2, colorTableSize + 1) + " BYTES")
            streamReader.skipBytes(3 * Math.pow(2, colorTableSize + 1));
          } else {
            streamReader.log("NO LOCAL TABLE PHEW");
            streamReader.skipBytes(1);
          }

          streamReader.log("MIN CODE SIZE " + streamReader.readByte());
          streamReader.log("DATA START");

          while (!streamReader.isNext([0x00])) {
            var blockSize = streamReader.readByte();
//        streamReader.log("SKIPPING " + blockSize + " BYTES");
            streamReader.skipBytes(blockSize);
          }
          streamReader.log("DATA END");
          streamReader.skipBytes(1); //NULL terminator
        } else if (streamReader.isNext([0x21, 0xF9, 0x04])) {
          streamReader.log("GRAPHICS CONTROL EXTENSION!");
          // We _definitely_ have a frame. Now we're expecting an image
          var index = streamReader.index;

          streamReader.skipBytes(3);
          var disposalMethod = streamReader.readByte() >> 2;
          streamReader.log("DISPOSAL " + disposalMethod);
          var delay = streamReader.readByte() + streamReader.readByte() * 256;
          frames.push({ index: index, delay: delay, disposal: disposalMethod });
          streamReader.log("FRAME DELAY " + delay);
          streamReader.skipBytes(2);
          expectingImage = true;
        } else {
          var maybeTheEnd = streamReader.index;
          while (!streamReader.finished() && !streamReader.isNext([0x21, 0xF9, 0x04])) {
            streamReader.readByte();
          }
          if (streamReader.finished()) {
            streamReader.index = maybeTheEnd;
            streamReader.log("WE END");
            spinning = false;
          } else {
            streamReader.log("UNKNOWN DATA FROM " + maybeTheEnd);
          }
        }
      }
      var endOfFrames = streamReader.index;

      var gifFooter = buffer.slice(-1); //last bit is all we need
      for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        var nextIndex = (i < frames.length - 1) ? frames[i + 1].index : endOfFrames;
        frame.blob = new Blob([ gifHeader, buffer.slice(frame.index, nextIndex), gifFooter ], {type: 'image/gif'});
        frame.url = url.createObjectURL(frame.blob);
      }

      resolve(new Gif(frames));
    })
  }
}
