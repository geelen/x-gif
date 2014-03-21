"use strict";

import
macros
from
'../macros.sjs';

var R = React.DOM,
  Playback = require('../playback.sjs'),
  frameNr = 0;

var XGif = React.createClass({displayName: 'XGif',
  count: 0,
  fire: function () {
    console.log("TODO: translate to REACT event")
  },
  initNewGif: function (gif) {
    this.gif = gif;
  },
  render: function () {
    if (!this.playback) {
      this.playback = new Playback(this, this, this.props.src, {
        onReady: () => {
          console.log("OK NOW WHAT");
        },
        pingPong: false,
        fill: false,
        stopped: false
      });
    }
    if (!this.gif) {
      return R.h1(null, "Loading...");
    } else {
      return R.div({className: "frames-wrapper"},
        R.div(
          {id: "frames", 'data-frame-id': frameNr},
          this.gif.frames.map((frame, i) => {
            var frameClass = 'frame' + (frame.disposal == 2) ? ' disposal-restore' : '';
            return R.img({key: i, className: frameClass, src: frame.url});
          })
        )
      )
    }
  }
});

var ExampleApplication = React.createClass({displayName: 'ExampleApplication',
  render: function () {
    return R.div({id: "content"},
      R.h1(null, "Dropping JSX is a bit better?"),
      XGif({src: "demos/gifs/pulse.gif"})
    );
  }
});

var animate = () => {
  requestAnimationFrame(animate);
  React.renderComponent(ExampleApplication(null), document.querySelector('main'));
}
animate();
