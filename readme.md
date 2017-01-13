# Bassoon Tracker

Browser based old-School Amiga Music tracker in plain old javascript.

![Bassoon Tracker](./skin/screenshot.png?raw=true)

Plays and edits 4-track Amiga Mod files.  
Live demo at [http://www.stef.be/bassoontracker/](http://www.stef.be/bassoontracker/)

If you have ever heard of [Protracker](https://en.wikipedia.org/wiki/Protracker) or [Fasttracker](https://en.wikipedia.org/wiki/FastTracker_2), then you know the drill,   
if not, then you are probably too young :-)

It needs a modern browser that support WebAudio, works best in Chrome.

Features  
- loads, plays and edits Protracker compatible mod files  
- most audio effects are supported (but probably not 100% accurate)  

Missing features  
 - not much disk operations yet, you can load new files by drag-dropping them on the interface  
 - "save module" is not working yet.
 - the various "E" effects are not implemented yet  
 - no stereo or panning yet
 - the sample editor needs fleshing out.
 - the keyboard is mapped to an AZERTY keyboard currently (mappings are defined in enum.js)
