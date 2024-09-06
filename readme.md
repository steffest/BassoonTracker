# BassoonTracker

Browser-based old-school Amiga Music Tracker in plain old JavaScript.

![BassoonTracker](./skin/bassoontracker_main.png?raw=true)

Plays and edits Amiga Module files and FastTracker 2 XM files.  
Live version at [http://www.stef.be/bassoontracker/](http://www.stef.be/bassoontracker/)

If you have ever heard of [Protracker](https://en.wikipedia.org/wiki/Protracker) or [Fasttracker](https://en.wikipedia.org/wiki/FastTracker_2), then you know the drill,   
if not, then you are probably too young :-)

### Requirements
* This tracker requires a modern browser that supports [WebAudio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).
It's tested to work on all major browsers desktop and mobile browsers.
* Midi support is not available in Firefox or Safari. 
* Minimum requirements for mobile devices: IOS9 or Android 6

![BassoonTracker](./skin/bassoontracker_sampleeditor.png?raw=true)

**Features**
- Load, play, edit and save Protracker and FastTracker 2 compatible module files  
- All Protracker audio effects are supported (99% accurate, in case of historical differences in playback engines, I tend to follow the Protracker 2.X one)
  - Portamento / Frequency slides (Effect 1, 2, 3, 5, E1 and E2)
  - Vibrato (effect 4, 6, and E4)
  - Tremolo (effect 7 and E7)
  - Arpeggio (effect 0)
  - Glissando (effect E3)
  - Sample offsets (effect 9)
  - Volume slides and settings (effect A, C, E10, and E11)
  - Position jumps (effect B)
  - Pattern breaks, loops and delays (effect D, E6, and E14)
  - Speed settings (effect F)
  - Sample Delay, Cut, Retrigger and Finetune (effect E13, E12, E9, and E5)
  - Lowpass/LED filter (effect E0)
- Almost all FastTracker audio effects are supported (97% accurate)
  - Volume and Panning Envelopes
  - Auto Vibrato
  - Multiple samples per instrument
  - Extended volume commands
- Next to the tracker effects, there are per-channel effects for low, mid, high frequency, panning and reverb control
- Mute/solo tracks  
- Edit pattern data and sample properties, use ranges and cut/copy/paste for quick editing
- Midi support (only Midi-in currently)  
- Up to 32 channels 
- Import 8bit WAV, 8SVX and RAW samples (as well as any other format [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) can read, like .mp3 and .ogg)
- Integrated sample editor: Edit and slice your samples right inside BassoonTracker
- Full Undo/Redo in pattern editor and sample editor
- Includes the historic ST-01 and ST-02 sample disks, released in 1987 (as well as a bunch of others)
- The [modarchive API](https://modarchive.org/) is integrated to access several thousands of music files
- The [modules.pl API](http://modules.pl/) is integrated to access even more music files
- Export to .mod, .xm, .wav, and .mp3
- Connect your Dropbox account to directly read and write your own files
- Supports Playlists and Favorites
- Read more in [The Docs](https://www.stef.be/bassoontracker/docs/)

The playback engine has gone through extensive compatibility testing, but as the Protracker code itself is somewhat messy and muddy
throughout different versions, there's always room for improvement.
If you find a module that doesn't sound the way it should, let me know!
There are still some very specific [Protracker 1 and 2 playback quirks](http://www.stef.be/bassoontracker/docs/trackerQuircks.txt) that are not implemented (and probably never will as they are too bat-shit-crazy)

**Missing features and bugs:**
 - The following FastTracker features are not fully supported yet:
   - Tremor
   - "Set envelope position" command
   - Panning Slides
   - PingPong Loops are unrolled to normal loops (There's no difference in sound but if you save your XM file, your samples will have changed.)
   - When writing XM files, patterns are not packed so the resulting files will probably be a little bigger than when saved with the real FastTracker 2.
 - Safari doesn't support WebAudio StereoPanners so songs will be played in mono on Safari.
 - Safari and Firefox don't support the [Web Midi Api](https://caniuse.com/midi) so no midi on those browsers.

**How to Run**  
BassoonTracker is a web application that runs in your browser.   
Just serve "index.html" from a webserver and you're good to go.
If you want to run it locally and you don't want to fiddle with things as `node`and `npm`, I can recommend [Spark](https://github.com/rif/spark/releases)  
Download the binary for your platform, drop the Spark executable in the folder where you downloaded the BassoonTracker source files and run it.   
If you then point your browser to http://localhost:8080/ it should work.

**How to Build**  
  - BassoonTracker doesn't need building, the build step is **optional**, there are no runtime dependencies (*bliss!*)
  - Just open dev.html in a browser to load the plain uncompressed scripts (one way to do that is by running `vite` or `npm start` on the command line)
  - If you like you can build a "packaged" version:
    - I'm using "[vite](https://vitejs.dev/)" for that, if you don't have it installed globally - install it with `npm i`
    - Use `vite build` (or `npm run build`) to build the compressed files -> index.html will be created.
    - If you make changes to the graphics, use `grunt sprites` to build the spritesheet.
	  This will compact all files in the `skin/src` to a single .png file and will create a spritemap.

**Future plans**  
  - ~~MIDI support~~ -> Done!
  - ~~Undo/redo on pattern edits and sample edits~~ -> Done!
  - Implement [local file system access](https://web.dev/file-system-access/)  
  - Export and import of .xi instruments.
  - 3SM/Screamtracker file support, maybe OctaMED too.
  - Allow synth/FM instruments next to sample instruments.
  - Although the tracker concept is awesome - it also would be nice to integrate it in a more modern 
  "horizontal block compose" style interface where you can re-use and combine tracks/patterns in a 
  composition instead of endlessly copying tracks.
  - Allow multiple notes per track (or at least give the option to let them play when a new note is triggered).
  - More effects (echo, reverb, flange, etc.) should probably be implemented with graphical track-envelopes instead of instrument envelopes or more numerical effect parameters. All this would require (yet another) new file format, but that seems inevitable.
  - Simpler HTML/CSS-based layout - maybe the canvas approach is too heavy for really large screens? (Done, but not maintained)
  - Plugins:
  	- Jukebox plugins, filter on genre/rating/etc.: hit play and let it perform.
  	- More expanded sample editor with audio processing features - probably as an external plugin.
  	- ~~Nibbles... we definitely need Nibbles.~~ -> We do!
  

**Player**
If you want to integrate the BassoonTracker playback routines in your own website, check out the "Standalone Player" examples in the "[player](https://github.com/steffest/BassoonTracker/tree/master/player)" directory
or visit the [live Player demo](http://www.stef.be/bassoontracker/player/).

