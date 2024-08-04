module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';\n'
            },
            tracker:{
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
                    'script/plugins/loader.js',
                    'script/wrapper/end.txt'
                ],
                dest: 'script/bassoontracker.js'
            },
            friend:{
                src: [
                    'script/src/host.js',
                    'hosts/FriendOs/bridge.js',
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
                    'script/plugins/loader.js',
                ],
                dest: 'hosts/FriendOs/build/bassoontracker.js'
            },
            player:{
                src: [
                    'script/wrapper/start.txt',
                    'script/src/host.js',
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
            },
            bundle: {
                options: {
                    separator: ''
                },
                src: [
                    'script/src/lib/UZIP.depacker_pack_20200308.js',
                    'script/wrapper/bundle0.js',
                    'script/b.b64',
                    'script/wrapper/bundle1.js',
                ],
                dest: 'player/b-zip.js'
              },
        },
        run: {
            options: {
                cwd: "player"
            },
            your_target: {
                cmd: 'node',
                args: [
                    'squeeze.js'
                ]
            }
        },
        uglify: {
            options: {
                banner: '/*<%= pkg.name %> v<%= pkg.version %> by <%= pkg.author %> - ' + 'build <%= grunt.template.today("yyyy-mm-dd") %> - Full source on <%= pkg.repository %> */',
                mangle: {},
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
                    global_defs   : {},
                    pure_getters  : true
                },
                beautify: false,
                report: 'gzip',
                sourceMap: false
            },
            tracker:{
                files: {
                    'script/bassoontracker-min.js': ['script/bassoontracker.js']
                }
            },
            friend:{
                files: {
                    'hosts/FriendOs/build/bassoontracker-min.js': ['hosts/FriendOs/build/bassoontracker.js']
                }
            },
            player:{
                files: {
                    'player/bassoonplayer-min.js': ['player/bassoonplayer.js']
                }
            },
            playerSqueezed:{
                files: {
                    'player/b-min.js': ['player/bassoonplayer_squeezed.js']
                }
            }
        },
        copy: {
            friend: {
                files: [
                    {src: ['hosts/FriendOs/BassoonTracker.jsx'], dest: 'hosts/FriendOs/build/', flatten: true, expand: true},
                    {src: [
                            'skin/spritemap_v4.json',
                            'skin/spritesheet_v4.png'
                        ], dest: 'hosts/FriendOs/build/skin/', flatten: true, expand: true},
                    {src: [
                            'data/modarchive.json',
                            'data/modules.json',
                            'data/modulespl.json',
                            'data/samples.json',
                        ], dest: 'hosts/FriendOs/build/data/', flatten: true, expand: true},
                    {src: [
                            'demomods/Tinytune.mod',
                        ], dest: 'hosts/FriendOs/build/demomods/', flatten: true, expand: true},
                    {src: ['skin/icon_256.png'], dest: 'hosts/FriendOs/build/icon.png'},
                    {src: ['skin/screenshot3.png'], dest: 'hosts/FriendOs/build/preview.png'}
                ],
            },
            regpack: {
                files: [
                    {src: ['script/b'], dest: 'player/b-pack.js'}
                ]
            }
        },
        clean: {
            tracker: ['script/bassoontracker.js','player/bassoonplayer.js'],
            friend: ['hosts/FriendOs/build'],
            friendjs: ['hosts/FriendOs/build/bassoontracker.js']
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
            },
            friend: {
                src: ['hosts/FriendOs/index.html'],
                dest: 'hosts/FriendOs/build/index.html',
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
            },
            friendpackage: {
                src: ['hosts/FriendOs/Config.json'],
                dest: 'hosts/FriendOs/build/Config.conf',
                replacements: [
                    {
                        from: '{version}',
                        to: function (matchedWord) {
                            return grunt.template.process('<%= pkg.version %>');
                        }
                    }]
            },
            versioncheck: {
                src: ['version_src.txt'],
                dest: 'version.txt',
                replacements: [{
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
                    'skin/src/icons_small/*.png',
                    'skin/src/icons_big/*.png'
                ],
                dest: 'skin/spritesheet_v5.png',
                destCss: 'skin/spritemap_v5.json',
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
        },
        regpack: {
            pack: {
                options: {
                    globalVariables: '',
                    separator: ''
                },
                files: [
                    { src: ['player/b-min.js'], dest: 'script/b'}
                ]
            }
        },
        compress: {
            main: {
                options: {
                    mode: 'zip',
                    level: 9,
                    archive: 'script/b.zip'
                },
                files: [
                    {expand: true, src: ['b'], cwd: 'script/', dest: '/'}
                ]
            },
            friend: {
                options: {
                    mode: 'zip',
                    level: 9,
                    archive: 'hosts/FriendOs/build/BassoonTracker<%= pkg.version %>.fpkg'
                },
                files: [
                    {expand: true, src: ['**'], cwd: 'hosts/FriendOs/build/', dest: '/'}
                ]
            }
        },
        base64: {
            target: {
                files: {
                    'script/b.b64': ['script/b.zip']
                },
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-text-replace');
    grunt.loadNpmTasks('grunt-spritesmith');
    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-regpack');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-base64');


    // Default task(s).
    // note:  use concat before uglify to keep the order of the JS files
    grunt.registerTask('wrap', ['replace:buildnumber','replace:versioncheck','concat:tracker']);
    grunt.registerTask('tracker', ['replace:buildnumber','replace:versioncheck','concat:tracker','uglify:tracker','clean:tracker']);
    grunt.registerTask('player', ['concat:player','uglify:player']);
    grunt.registerTask('miniplayer', ['concat:player','run','uglify:playerSqueezed']);
    grunt.registerTask('default', ['tracker']);
    grunt.registerTask('sprites', ['sprite']);
    grunt.registerTask('friend', ['clean:friend','concat:friend','uglify:friend','copy:friend','replace:friend','replace:friendpackage','clean:friendjs','compress:friend']);
    grunt.registerTask('frienddev', ['concat:friend']);
    //grunt.registerTask('friend', ['clean:friend','concat:friend','uglify:friend','copy:friend','replace:friend','replace:friendpackage']);
    grunt.registerTask('all', ['tracker','player','friend']);
    grunt.registerTask('bundle', ['miniplayer', 'regpack:pack','copy:regpack','compress','base64','concat:bundle']);
    
};