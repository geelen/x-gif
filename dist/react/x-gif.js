(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

// wtf browserify
var x = require('./react/x-gif.sjs');

},{"./react/x-gif.sjs":2}],2:[function(require,module,exports){
'use strict';
;
var R$630 = React.DOM;
var XGif$631 = React.createClass({
        displayName: 'XGif',
        count: 0,
        render: function () {
            if (Math.random() > 0.9)
                this.count++;
            return R$630.div({ className: 'frames-wrapper' }, R$630.div({
                id: 'frames',
                'data-frame-id': this.count
            }, R$630.img({ src: this.props.src })));
        }
    });
var ExampleApplication$632 = React.createClass({
        displayName: 'ExampleApplication',
        render: function () {
            return R$630.div({ id: 'content' }, R$630.h1(null, 'Dropping JSX is a bit better?'), XGif$631({ src: 'demos/gifs/pulse.gif' }));
        }
    });
var animate$634 = function () {
        requestAnimationFrame(animate$634);
        React.renderComponent(ExampleApplication$632(null), document.querySelector('main'));
    }.bind(this);
animate$634();

},{}]},{},[1])