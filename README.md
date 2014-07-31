# &lt;x-gif&gt;

_The GIF tag the internet deserves_

## Usage

**&lt;x-gif&gt;** is a web component for flexible GIF playback. Speed them up, slow them down, play them in reverse, synch multiple beats to a rhythm, synch them to audio, whatever you like.

```html
<x-gif src="probably_cats.gif"></x-gif>
```

###Playback modes:

Mutually exclusive. Can't be changed once initialised (create a new x-gif if you want a new mode)

`speed="1.0"` (default mode)
Plays back the GIF at its natural framerate multiplied by the value of the attribute. Can be updated and will have immediate effect.

`sync`
Defers playback to an external object. The DOM element will then expose a `clock` function to facilitate playback. Cannot be changed.

`bpm="120"`
Syncs GIFs to a given beats-per-minute. If multiple x-gifs are on the page, they will all be synced together. By default, will spread long GIFs over multiple beats, unless the `snap` option is also included. Uses `sync` and `clock` under the hood. Can be changed and will take immediate effect.

###Options:

`stopped`
Regardless of playback mode, this will prevent the GIF from animating. Removing this attribute resumes playback. In `speed` mode, the GIF will always resume playback from the beginning.

`fill`
Causes the GIF to expand to cover its container, like if you had used `background-size: cover; background-position: 50% 50%` with a normal GIF. Without `fill`, an x-gif behaves like an inline-block element, just like a normal <img> tag.

`n-times="3.0"` (speed mode only)
Stops playback (by adding the attribute `stopped`) after a set number of times. Can be fractional e.g. `0.9` will play the first 90% of the GIF then stop. Removing the `stopped` attribute will restart the playback.

`snap` (sync & bpm modes only)
Instead of allowing longer GIFs to sync to multiple beats, force them to fit into only one.

`ping-pong`
Boolean attribute. Plays the GIF front-to-back then back-to-front, which looks more awesome for some GIFs. Works with all playback modes. Can be removed/added at any time.

###Debugging:

`debug`
Turns on debug output from the Gif Exploder, which can help track down errors with some GIFs being parsed incorrectly.

`exploded`
For visual inspection of the frames. Stops playback, and renders each frame out side-by-side. Many frames will appear semi-transparent, because that's how GIFs work. But this might come in handy.

##What does it do?

* AJAX fetches the GIF as a binary stream
* Slices the GIF into frames like a total boss
* Stacks the frames one on top of the other
* Starts a `requestAnimationFrame` loop to play back the gif at its natural frame rate

**[Here's a demo! It just might work in your browser!](http://geelen.github.io/x-gif)**

**[Check out the rest of the demos](http://geelen.github.io/x-gif)**

## Usage

```html
<script>
  if ('registerElement' in document
    && 'createShadowRoot' in HTMLElement.prototype
    && 'import' in document.createElement('link')
    && 'content' in document.createElement('template')) {
    // We're using a browser with native WC support!
  } else {
    document.write('<script src="https:\/\/cdnjs.cloudflare.com/ajax/libs/polymer/0.3.4/platform.js"><\/script>')
  }
</script>
<link rel="import" href="x-gif.html">
```

This will detect support for Web Components, shim them if needed, then load x-gif with a HTML import.

## Roadmap

* Web Component - YES! (zero-dependencies on Chrome 36!)
* Polymer element - Nah, just use the Web Component
* Angular directive - Nah, just use the Web Component
* React component - Nah, just use the Web Component
* Ember component - Nah, just use the Web Component

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

[MIT License](http://opensource.org/licenses/MIT)
