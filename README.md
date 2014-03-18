# <x-gif>

_The GIF format the internet deserves_

## Usage

```
<x-gif src="probably_cats.gif"></x-gif>
```

This does the following:

* AJAX fetches the GIF as a binary stream
* Slices the GIF into frames like a total boss
* Stacks the frames one on top of the other
* Starts a requestAnimationFrame loop to play back the gif at its natural frame rate

## Options

```
<x-gif src="definitely_cats.gif" speed="2.1"></x-gif>
```

**SPEED** spins through the frames at its natural rate multiplied by `speed`

```
<x-gif src="something_dumb_from_buzzfeed.gif" bpm="120"></x-gif>
```

**BPM** breaks the GIF across 1 or more 'beats' (depending on how long the GIF is), where each beat is 1/`bpm` minutes long.

## Satus

* **Polymer element - DONE!**
* Angular directive - TODO
* React component - TODO
* Ember component - TODO
