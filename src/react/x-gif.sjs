"use strict";

import macros from '../macros.sjs';

var Playback = require('../playback.sjs');

// Meets the api for the DomUpdater that Playback expects
// but React works totally differently.
var GifState = function () {
  this.initNewGif = (gif) => {
    this.gif = gif;
  }
  this.setFrame = (frameNr) => {
    this.frameNr = frameNr;
  }
};

var XGif = React.createClass({displayName: 'XGif',
  fire: function () {
    console.log("TODO: translate to REACT event")
  },
  render: function () {
    if (!this.playback) {
      // Just do this once (surely there's a better callback?)
      this.gifState = new GifState();
      this.playback = new Playback(this, this.gifState, this.props.src, {
        onReady: () => {
          if (this.props.speed) {
            this.playback.startSpeed(this.props.speed, this.props['n-times']);
          }
          // TODO: other playback strategies
        },
        pingPong: this.props.pingPong,
        fill: false,
        stopped: false
      });
    }
    if (!this.gifState.gif) {
      return H1(null, "Loading...");
    } else {
      return DIV({className: "react-x-gif frames-wrapper"},
        DIV(
          {id: "frames", 'data-frame': this.gifState.frameNr},
          this.gifState.gif.frames.map((frame, i) => {
            var frameClass = 'frame' + ((frame.disposal == 2) ? ' disposal-restore' : '');
            return IMG({key: i, className: frameClass, src: frame.url});
          })
        )
      )
    }
  }
});

var ExampleApplication = React.createClass({displayName: 'ExampleApplication',
  render: function () {
    return DIV({id: "content"},
      XGif({src: "demos/gifs/pulse.gif", speed: 0.5})
    );
  }
});

// Requires a React animation loop, which constantly checks if the frame
// has changed. There's another animation loop inside Playback, which
// ain't great.
var animate = () => {
  requestAnimationFrame(animate);
  React.renderComponent(ExampleApplication(null), document.querySelector('main'));
}
animate();
