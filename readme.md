# Bassoon Tracker

Browser based old-school Amiga Music Tracker in plain old javascript.

![Bassoon Tracker](./skin/screenshot.png?raw=true)

Plays and edits 4-track Amiga Mod files.  
Live demo at [http://www.stef.be/bassoontracker/](http://www.stef.be/bassoontracker/)

If you have ever heard of [Protracker](https://en.wikipedia.org/wiki/Protracker) or [Fasttracker](https://en.wikipedia.org/wiki/FastTracker_2), then you know the drill,   
if not, then you are probably too young :-)

It needs a modern browser that support WebAudio, it works best in Chrome.

Features  
- load, play and edit Protracker compatible module files  
- most audio effects are supported (but probably not 100% accurate)
  - Frequency slides (Effect 1, 2, 3 and 5)
  - Sample offets (Effect 9)
  - Volume slides and settings (effect A and C)
  - Position jumps (effect B)
  - Speed settings (Effect F)
- mute/solo tracks
- edit pattern data and sample properties

Missing features and bugs
 - Not much disk operations yet, you can load new files by drag-dropping them on the interface  
 - "save module" is not working yet.
 - The various "E" effects are not implemented yet  
 - Arpeggio, Tremolo and Vibrato are not implemented yet (Effect 0, 4, 6 and 7)
 - No stereo or panning yet
 - The sample editor needs fleshing out.
 - Sample loops behave not the way they should (I unroll them before playing, a poor mans solution for the real thing)
 - The keyboard is mapped to an AZERTY keyboard currently (mappings are defined in enum.js)
