#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const skinPath = __dirname;
const sourcePath = path.join(skinPath,"src");
const spriteSheetPath = path.join(skinPath,"spritesheet_v5.png");
const spriteMapPath = path.join(skinPath,"spritemap_v5.json");
const dryRun = process.argv.indexOf("--dry-run")>=0;

const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE = buildCrcTable();

function getPngFiles(dir){
    let result = [];
    fs.readdirSync(dir,{withFileTypes:true}).forEach(function(entry){
        let entryPath = path.join(dir,entry.name);
        if (entry.isDirectory()){
            result = result.concat(getPngFiles(entryPath));
        }else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")){
            result.push(entryPath);
        }
    });
    return result;
}

function getSpriteName(file){
    return path.basename(file,path.extname(file));
}

function validateSpriteNames(files){
    let names = {};
    files.forEach(function(file){
        let name = getSpriteName(file);
        if (names[name]){
            throw new Error("Duplicate sprite name '" + name + "' for " + names[name] + " and " + file);
        }
        names[name] = file;
    });
}

function readPng(file){
    let buffer = fs.readFileSync(file);
    if (!buffer.subarray(0,8).equals(PNG_SIGNATURE)){
        throw new Error(file + " is not a PNG file");
    }

    let offset = 8;
    let header;
    let palette;
    let transparency;
    let idat = [];

    while (offset < buffer.length){
        let length = buffer.readUInt32BE(offset);
        let type = buffer.toString("ascii",offset+4,offset+8);
        let data = buffer.subarray(offset+8,offset+8+length);
        offset += length + 12;

        if (type === "IHDR"){
            header = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                bitDepth: data[8],
                colorType: data[9],
                compression: data[10],
                filter: data[11],
                interlace: data[12]
            };
        }else if (type === "PLTE"){
            palette = data;
        }else if (type === "tRNS"){
            transparency = data;
        }else if (type === "IDAT"){
            idat.push(data);
        }else if (type === "IEND"){
            break;
        }
    }

    if (!header) throw new Error(file + " has no PNG header");
    if (header.bitDepth !== 8) throw new Error(file + " uses unsupported bit depth " + header.bitDepth);
    if (header.compression || header.filter) throw new Error(file + " uses unsupported PNG compression/filter method");
    if (header.interlace) throw new Error(file + " uses unsupported interlacing");

    let channels = getChannelCount(header.colorType);
    let bytesPerPixel = channels;
    let scanlineLength = header.width * channels;
    let raw = zlib.inflateSync(Buffer.concat(idat));
    let unfiltered = Buffer.alloc(scanlineLength * header.height);

    for (let y=0;y<header.height;y++){
        let source = y * (scanlineLength + 1);
        let target = y * scanlineLength;
        let filter = raw[source];
        unfilterScanline(raw,unfiltered,source+1,target,scanlineLength,bytesPerPixel,filter);
    }

    return {
        file: file,
        name: getSpriteName(file),
        width: header.width,
        height: header.height,
        data: convertToRgba(unfiltered,header,palette,transparency)
    };
}

function getChannelCount(colorType){
    switch(colorType){
        case 0: return 1;
        case 2: return 3;
        case 3: return 1;
        case 4: return 2;
        case 6: return 4;
        default: throw new Error("Unsupported PNG color type " + colorType);
    }
}

function unfilterScanline(source,target,sourceOffset,targetOffset,length,bpp,filter){
    for (let i=0;i<length;i++){
        let x = source[sourceOffset+i];
        let left = i>=bpp ? target[targetOffset+i-bpp] : 0;
        let up = targetOffset>=length ? target[targetOffset+i-length] : 0;
        let upLeft = targetOffset>=length && i>=bpp ? target[targetOffset+i-length-bpp] : 0;
        let value;

        switch(filter){
            case 0: value = x; break;
            case 1: value = x + left; break;
            case 2: value = x + up; break;
            case 3: value = x + Math.floor((left + up) / 2); break;
            case 4: value = x + paeth(left,up,upLeft); break;
            default: throw new Error("Unsupported PNG filter " + filter);
        }

        target[targetOffset+i] = value & 255;
    }
}

function paeth(a,b,c){
    let p = a + b - c;
    let pa = Math.abs(p - a);
    let pb = Math.abs(p - b);
    let pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function convertToRgba(data,header,palette,transparency){
    let rgba = Buffer.alloc(header.width * header.height * 4);
    let source = 0;
    let target = 0;
    let transparentGrey;
    let transparentRgb;

    if (transparency && header.colorType === 0){
        transparentGrey = transparency.readUInt16BE(0) & 255;
    }
    if (transparency && header.colorType === 2){
        transparentRgb = [
            transparency.readUInt16BE(0) & 255,
            transparency.readUInt16BE(2) & 255,
            transparency.readUInt16BE(4) & 255
        ];
    }

    for (let i=0,max=header.width*header.height;i<max;i++){
        if (header.colorType === 0){
            let grey = data[source++];
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey === transparentGrey ? 0 : 255;
        }else if (header.colorType === 2){
            let r = data[source++];
            let g = data[source++];
            let b = data[source++];
            rgba[target++] = r;
            rgba[target++] = g;
            rgba[target++] = b;
            rgba[target++] = transparentRgb && r === transparentRgb[0] && g === transparentRgb[1] && b === transparentRgb[2] ? 0 : 255;
        }else if (header.colorType === 3){
            let index = data[source++];
            rgba[target++] = palette[index*3] || 0;
            rgba[target++] = palette[index*3+1] || 0;
            rgba[target++] = palette[index*3+2] || 0;
            rgba[target++] = transparency && typeof transparency[index] !== "undefined" ? transparency[index] : 255;
        }else if (header.colorType === 4){
            let grey = data[source++];
            let alpha = data[source++];
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = alpha;
        }else if (header.colorType === 6){
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
        }
    }

    return rgba;
}

function packSprites(sprites){
    let totalArea = sprites.reduce(function(total,sprite){
        return total + sprite.width * sprite.height;
    },0);
    let maxWidth = sprites.reduce(function(max,sprite){
        return Math.max(max,sprite.width);
    },0);
    let targetWidth = Math.ceil(Math.sqrt(totalArea));
    let maxCandidateWidth = Math.max(maxWidth,targetWidth * 2);
    let candidates = [];

    for (let width=maxWidth;width<=maxCandidateWidth;width+=8){
        candidates.push(width);
    }

    [maxWidth,targetWidth,512,768,1024,1280,1536,2048].forEach(function(width){
        if (width>=maxWidth && width<=maxCandidateWidth && candidates.indexOf(width)<0) candidates.push(width);
    });

    let best;
    candidates.sort(function(a,b){return a-b;}).forEach(function(width){
        let packed = packAtWidth(sprites,width);
        if (!best || isBetterPack(packed,best)) best = packed;
    });

    return best;
}

function packAtWidth(sprites,width){
    let packedSprites = sprites.map(function(sprite){
        return Object.assign({},sprite);
    });
    let sorted = packedSprites.slice().sort(function(a,b){
        return (b.height * b.width) - (a.height * a.width) || b.height - a.height || b.width - a.width;
    });
    let freeRects = [{x:0,y:0,width:width,height:getStackHeight(packedSprites)}];
    let placed = [];

    sorted.forEach(function(sprite){
        let placement = findPlacement(freeRects,sprite);
        if (!placement) throw new Error("Could not place " + sprite.name);
        sprite.x = placement.x;
        sprite.y = placement.y;
        placed.push(sprite);
        splitFreeRects(freeRects,placement);
        pruneFreeRects(freeRects);
    });

    let usedWidth = 0;
    let usedHeight = 0;
    packedSprites.forEach(function(sprite){
        usedWidth = Math.max(usedWidth,sprite.x + sprite.width);
        usedHeight = Math.max(usedHeight,sprite.y + sprite.height);
    });

    return {
        width: usedWidth,
        height: usedHeight,
        area: usedWidth * usedHeight,
        maxSide: Math.max(usedWidth,usedHeight),
        sprites: packedSprites
    };
}

function getStackHeight(sprites){
    return sprites.reduce(function(total,sprite){
        return total + sprite.height;
    },0);
}

function findPlacement(freeRects,sprite){
    let best;
    freeRects.forEach(function(rect){
        if (sprite.width > rect.width || sprite.height > rect.height) return;
        let leftoverX = rect.width - sprite.width;
        let leftoverY = rect.height - sprite.height;
        let shortSide = Math.min(leftoverX,leftoverY);
        let longSide = Math.max(leftoverX,leftoverY);
        if (!best || shortSide < best.shortSide || (shortSide === best.shortSide && longSide < best.longSide)){
            best = {
                x: rect.x,
                y: rect.y,
                width: sprite.width,
                height: sprite.height,
                shortSide: shortSide,
                longSide: longSide
            };
        }
    });
    return best;
}

function splitFreeRects(freeRects,used){
    for (let i=freeRects.length-1;i>=0;i--){
        let rect = freeRects[i];
        if (!intersects(rect,used)) continue;

        freeRects.splice(i,1);
        if (used.x > rect.x){
            freeRects.push({x:rect.x,y:rect.y,width:used.x-rect.x,height:rect.height});
        }
        if (used.x + used.width < rect.x + rect.width){
            freeRects.push({
                x:used.x + used.width,
                y:rect.y,
                width:rect.x + rect.width - (used.x + used.width),
                height:rect.height
            });
        }
        if (used.y > rect.y){
            freeRects.push({x:rect.x,y:rect.y,width:rect.width,height:used.y-rect.y});
        }
        if (used.y + used.height < rect.y + rect.height){
            freeRects.push({
                x:rect.x,
                y:used.y + used.height,
                width:rect.width,
                height:rect.y + rect.height - (used.y + used.height)
            });
        }
    }
}

function intersects(a,b){
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
}

function pruneFreeRects(freeRects){
    for (let i=0;i<freeRects.length;i++){
        for (let j=i+1;j<freeRects.length;j++){
            if (contains(freeRects[i],freeRects[j])){
                freeRects.splice(j,1);
                j--;
            }else if (contains(freeRects[j],freeRects[i])){
                freeRects.splice(i,1);
                i--;
                break;
            }
        }
    }
}

function contains(a,b){
    return b.x >= a.x &&
        b.y >= a.y &&
        b.x + b.width <= a.x + a.width &&
        b.y + b.height <= a.y + a.height;
}

function isBetterPack(pack,best){
    if (pack.area !== best.area) return pack.area < best.area;
    if (pack.maxSide !== best.maxSide) return pack.maxSide < best.maxSide;
    return pack.width < best.width;
}

function composeSheet(pack){
    let sheet = Buffer.alloc(pack.width * pack.height * 4);
    pack.sprites.forEach(function(sprite){
        for (let y=0;y<sprite.height;y++){
            let source = y * sprite.width * 4;
            let target = ((sprite.y + y) * pack.width + sprite.x) * 4;
            sprite.data.copy(sheet,target,source,source + sprite.width * 4);
        }
    });
    return sheet;
}

function writePng(width,height,rgba){
    let scanlineLength = width * 4;
    let raw = Buffer.alloc((scanlineLength + 1) * height);
    for (let y=0;y<height;y++){
        let source = y * scanlineLength;
        let target = y * (scanlineLength + 1);
        raw[target] = 0;
        rgba.copy(raw,target+1,source,source+scanlineLength);
    }

    let header = Buffer.alloc(13);
    header.writeUInt32BE(width,0);
    header.writeUInt32BE(height,4);
    header[8] = 8;
    header[9] = 6;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk("IHDR",header),
        pngChunk("IDAT",zlib.deflateSync(raw)),
        pngChunk("IEND",Buffer.alloc(0))
    ]);
}

function pngChunk(type,data){
    let typeBuffer = Buffer.from(type,"ascii");
    let length = Buffer.alloc(4);
    let crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length,0);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer,data])),0);
    return Buffer.concat([length,typeBuffer,data,crc]);
}

function buildCrcTable(){
    let table = [];
    for (let n=0;n<256;n++){
        let c = n;
        for (let k=0;k<8;k++){
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
}

function crc32(buffer){
    let crc = 0xffffffff;
    for (let i=0;i<buffer.length;i++){
        crc = CRC_TABLE[(crc ^ buffer[i]) & 255] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function generateSpriteMap(sprites){
    return sprites.slice().sort(function(a,b){
        return a.sourceIndex - b.sourceIndex;
    }).map(function(sprite){
        return {
            name: sprite.name,
            x: sprite.x,
            y: sprite.y,
            width: sprite.width,
            height: sprite.height
        };
    });
}

function validatePack(pack){
    pack.sprites.forEach(function(sprite){
        if (sprite.x < 0 || sprite.y < 0 || sprite.x + sprite.width > pack.width || sprite.y + sprite.height > pack.height){
            throw new Error(
                "Packed sprite '" + sprite.name + "' is outside the sheet bounds: " +
                sprite.x + "," + sprite.y + " " + sprite.width + "x" + sprite.height +
                " in " + pack.width + "x" + pack.height
            );
        }
    });
}

function generate(){
    let files = getPngFiles(sourcePath).sort(function(a,b){
        return path.relative(sourcePath,a).localeCompare(path.relative(sourcePath,b));
    });

    if (!files.length) throw new Error("No PNG files found in " + sourcePath);
    validateSpriteNames(files);

    let sprites = files.map(function(file,index){
        let sprite = readPng(file);
        sprite.sourceIndex = index;
        return sprite;
    });
    let pack = packSprites(sprites);
    validatePack(pack);
    let spriteMap = generateSpriteMap(pack.sprites);

    if (!dryRun){
        fs.writeFileSync(spriteSheetPath,writePng(pack.width,pack.height,composeSheet(pack)));
        fs.writeFileSync(spriteMapPath,JSON.stringify(spriteMap,undefined,2));
    }

    console.log(
        (dryRun ? "Would generate" : "Generated") +
        " " + spriteMap.length +
        " sprites (" + pack.width + "x" + pack.height + ")"
    );
}

try {
    generate();
} catch (error) {
    console.error(error);
    process.exit(1);
}
