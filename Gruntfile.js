module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
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
        }
    });

    grunt.loadNpmTasks('grunt-spritesmith');


    // Default task(s).
    grunt.registerTask('sprites', ['sprite']);

};