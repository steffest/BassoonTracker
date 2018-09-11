module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';\n'
            },
            dist:{
                src: [
                    'script/wrapper/start.txt',
                    'script/src/enum.js',
                    'script/src/eventBus.js',
                    'script/src/audio.js',
                    'script/src/lib/*.js',
                    'script/src/*.js',
                    'script/src/ui/yascal/yascal.js',
                    'script/src/ui/yascal*.js',
                    'script/src/ui/main.js',
                    'script/src/ui/**/*.js',
                    'script/src/**/*.js',
                    'script/wrapper/end.txt'
                ],
                dest: 'script/bassoontracker.js'
            },
            player:{
                src: [
                    'script/wrapper/start.txt',
                    'script/src/enum.js',
                    'script/src/eventBus.js',
                    'script/src/filesystem.js',
                    'script/src/audio.js',
                    'script/src/lib/util.js',
                    'script/src/lib/waaclock.js',
                    'script/src/audio/filterChain.js',
                    'script/src/tracker.js',
                    'script/src/preloader.js',
                    'script/src/fetchService.js',
                    'script/src/fileformats/detect.js',
                    'script/src/fileformats/protracker.js',
                    'script/src/fileformats/soundtracker.js',
                    'script/src/fileformats/fasttracker.js',
                    'script/src/models/instrument.js',
                    'script/src/models/sample.js',
                    'script/src/models/note.js',
                    'script/wrapper/end.txt'

                ],
                dest: 'player/bassoonplayer.js'
            }
        },
        uglify: {
            options: {
                mangle: {
                    toplevel:false
                },
                mangleProperties: false,
                exceptionsFiles: [ 'GruntMangleExceptions.json'],
                nameCache: 'grunt-uglify-cache.json',
                banner: '/*<%= pkg.name %> v<%= pkg.version %> by <%= pkg.author %> - ' + 'build <%= grunt.template.today("yyyy-mm-dd") %> - Full source on <%= pkg.repository %> */',
                compress: {
                    sequences     : true,  // join consecutive statemets with the “comma operator”
                    properties    : true,  // optimize property access: a["foo"] → a.foo
                    dead_code     : true,  // discard unreachable code
                    drop_console  : true,
                    drop_debugger : true,  // discard “debugger” statements
                    unsafe        : false, // some unsafe optimizations (see below)
                    conditionals  : true,  // optimize if-s and conditional expressions
                    comparisons   : true,  // optimize comparisons
                    evaluate      : true,  // evaluate constant expressions
                    booleans      : true,  // optimize boolean expressions
                    loops         : true,  // optimize loops
                    unused        : true,  // drop unused variables/functions
                    hoist_funs    : true,  // hoist function declarations
                    hoist_vars    : false, // hoist variable declarations
                    if_return     : true,  // optimize if-s followed by return/continue
                    join_vars     : true,  // join var declarations
                    side_effects  : true,  // drop side-effect-free statements
                    warnings      : true,  // warn about potentially dangerous optimizations/code
                    global_defs   : {},
                    pure_getters  : true
                },
                beautify: false
            },
            dist:{
                files: {
                    'script/bassoontracker-min.js': ['script/bassoontracker.js']
                }
            },
            player:{
                files: {
                    'player/bassoonplayer-min.js': ['player/bassoonplayer.js']
                }
            }
        },
        clean: {
            js: ['script/bassoontracker.js','player/bassoonplayer.js']
        },
        replace: {
            buildnumber: {
                src: ['index_src.html'],
                dest: 'index.html',
                replacements: [{
                    from: '{build}',
                    to: function (matchedWord) {
                        return grunt.template.process('<%= pkg.version %>-build<%= grunt.template.today("yyyymmdd.hhMM") %>');
                    }
                },
                    {
                        from: '{version}',
                        to: function (matchedWord) {
                            return grunt.template.process('<%= pkg.version %>');
                        }
                    }]
            }
        },
        sprite:{
            all: {
                src: [
                    'skin/src/*.png',
                    'skin/src/icons_small/*.png'
                ],
                dest: 'skin/spritesheet_v2.png',
                destCss: 'skin/spritemap_v2.json',
                cssTemplate: function (data) {

                    var result = [];
                    data.sprites.forEach(function (sprite) {
                        result.push({
                            name: sprite.name,
                            x: sprite.x,
                            y: sprite.y,
                            width: sprite.width,
                            height: sprite.height
                        });
                    });

                    return JSON.stringify(result,undefined,2);
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-text-replace');
    grunt.loadNpmTasks('grunt-spritesmith');

    // Default task(s).
    // note:  use concat before uglify to keep the order of the JS files
    grunt.registerTask('bassoontracker', ['replace','concat','uglify','clean']);
    grunt.registerTask('player', ['concat:player','uglify:player','clean']);
    grunt.registerTask('default', ['bassoontracker']);
    grunt.registerTask('sprites', ['sprite']);

};