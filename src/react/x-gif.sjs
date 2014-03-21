"use strict";

import
macros
from
'../macros.sjs';

var R = React.DOM;

var XGif = React.createClass({displayName: 'XGif',
  count: 0,
  render: function () {
    if (Math.random() > 0.9) this.count++;
    return R.div({className: "frames-wrapper"},
      R.div({id: "frames", 'data-frame-id': this.count},
        R.img({src: this.props.src})
      )
    )
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
