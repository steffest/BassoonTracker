Bassoontracker intergrated into the FriendOs environment:  
https://friendos.com/  

Features:
 - Open and save files are mapped to the Friend Filesystem
 - Main menu mapped to the Friend Menu system
 - Internal Dropbox has been disabled (because Friend has it's own Dropbox driver)
 - Build as installable Friend Project
 
How to build
 - execute `grunt friend` in the root of the project, this will build everything in the hosts/FriendOs/build directory.
 - If you want to create a Friend Package, you can load this build project in FriendCreate and build the package from there.
 
Development
 - Copy `BassoonTracker_dev.jsx` to the root of the project and execute in Friend.
 - I would recommend setting up a local environment of Friend.   
   An easy way is to use the [docker image](https://friend-nexus.com/index.php?/topic/34-friendup-docker-joining-the-shipyard/). 
 - Then map your local dev folder to the docker container by editing the docker-compose.yml file
 
Notes
 - The way Friend maps all urls to local filesystem calls is a bit annoying, to be frank: that way they don't behave as real urls anymore. e.g. you can't use ? and & parameters, you can't do relative urls ...
 - for this reason, I couldn't get the webworkers to work (the ImportScripts doesn't work that way). So webworkers have been disabled, causing ZIP compressed modules to be inflated in the main thread.
 - Loading the `BassoonTracker_dev.jsx` file is very slow because each .js include is mapped to a filesystem call and executed in sequence. Slow ...   
 It might be better to just do a build each time, optionally leaving out the minify step.
 - When using the Friend Menu system, it steals away input focus from the app. I had quite a hard time setting the keyboard focus back because the canvas element natively is not reacting to keyboard input.  I kind of fixed it by sprinkling `window.focus()` commands around but still: this is a different behaviour then when running directly in a browser. weird ... To Be Investigated.
