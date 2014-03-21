/**
 * @jsx React.DOM
 */
var XGif = React.createClass({
  render: function () {
    return <img src={this.props.src} />;
  }
});

var ExampleApplication = React.createClass({
  render: function () {
    return  <div id="content">
              <h1>React, man. Boy, I dunno. {console.log('wut')}</h1>
              <XGif src="demos/gifs/pulse.gif" />
            </div>;
  }
});

React.renderComponent(<ExampleApplication />, document.querySelector('main'));
