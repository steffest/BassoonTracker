# Bassoon Tracker

Browser based old-school Amiga Music Tracker in plain old javascript.

![Bassoon Tracker](./skin/screenshot.png?raw=true)

Plays and edits 4-track Amiga Mod files.  
Live demo at [http://www.stef.be/bassoontracker/](http://www.stef.be/bassoontracker/)

If you have ever heard of [Protracker](https://en.wikipedia.org/wiki/Protracker) or [Fasttracker](https://en.wikipedia.org/wiki/FastTracker_2), then you know the drill,   
if not, then you are probably too young :-)

It needs a modern browser that support WebAudio.
It's tested to work on Chrome, Firefox, Safari, Edge, Chrome on Android, mobile Safari and the Samsung Android Browser.
it works best in Chrome.

![Bassoon Tracker](./skin/screenshot2.png?raw=true)

Features
- load, play, edit and save Protracker compatible module files  
- most audio effects are supported (99% accurate, in case of historical differences in playback engines, I tend to follow the protracker 2.X one)
  - Portamento / Frequency slides (Effect 1, 2, 3, 5, E1 and E2)
  - Vibrato (Effect 4 and 6)
  - Tremolo (Effect 7)
  - Arpeggio (Effect 0)
  - Sample offsets (Effect 9)
  - Volume slides and settings (effect A, C, E10 and E11)
  - Position jumps (effect B)
  - Pattern breaks and loops (effect D and E6)
  - Speed settings (Effect F)
  - Glissando (Effect E3)
  - Sample Delay, Cut and Retrigger (Effect E13, E12 and E9)
  - Pattern delay (Effect E14)
- next to the Protracker effects, there are per-channel effects for low, mid, high frequency, panning and reverb control
- mute/solo tracks  
- edit pattern data and sample properties  
- import 8bit WAV, 8SVX and RAW samples (as well as any other format AudioContext can read, like .mp3 and .ogg) 
- includes the historic ST-01 and ST-02 sample disks, released in 1987 (as well as a bunch if others)
- the [modarchive API](https://modarchive.org/) is integrated to access many thousands of music files
- export to .wav and .mod

Missing features and bugs (no, it doesn't play 'Black Queen' 100% accurately :-) )
 - export to wav is currently limited to the current pattern (due to memory issues)
 - Some "Extended" effects are not implemented yet: E4,E5,E7
 - The sample editor needs fleshing out.
 - no undo/redo functionality yet
 - no range select/copy/paste functionality yet
 
Note: if you use an AZERTY keyboard, you can set that option in the settings to have the correct layout when playing notes on your computer keyboard.
