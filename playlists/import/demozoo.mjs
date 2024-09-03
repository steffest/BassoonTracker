import https from "https";
import fs from "fs";

let url = "https://demozoo.org/parties/4622/";
let file = "demozoo.json";
let partyName;
let scanUrl = true;
let writePlaylist = true;
let onlyModAndXM = true;

if (process.argv.length>2){
    let id = parseInt(process.argv[2]);
    if (!isNaN(id)){
        url = "https://demozoo.org/parties/" + id + "/";
        writePlaylist = true;
        scanUrl = true;
    }
}

async function main(){
    console.log("init");

    if (scanUrl){
        let list = await getPartyData();
        let struct = {
            party: partyName,
            entries: list
        }
        if (writePlaylist){
            savePlaylist(struct);
        }else{
            // save to temp file
            let json = JSON.stringify(struct,null,2);
            fs.writeFileSync(file,json);
            console.log(list);
        }
    }else{
        if (writePlaylist){
            savePlaylist();
        }
    }

}

function savePlaylist(struct){
    if (!struct){
        let content = fs.readFileSync(file);
        struct = JSON.parse(content);
    }

    let list = struct.entries;
    console.log("Entries: " + list.length);
    partyName = struct.party;

    let modules = [
        {title: partyName}
    ];
    list.forEach(item=>{
        let passed = (item.file || item.download);
        if (onlyModAndXM){
            passed = passed && (item.format === "MOD" || item.format === "XM");
        }
        if (passed)  {
            let module = {
                title: item.title,
                url: item.file || item.download,
                author: item.author,
                group: item.groups.join("^"),
                link: "https://demozoo.org" + item.link
            }
            if (item.ranking){
                let suffix = "th";
                if (item.ranking === "1") suffix = "st";
                if (item.ranking === "2") suffix = "nd";
                if (item.ranking === "3") suffix = "rd";

                module.info = item.ranking + suffix + " @ " + partyName;
            }
            if (item.format) module.format = item.format;
            if (item.channels) module.channels = item.channels;
            modules.push(module);
        }
    })
    let playlist = {
        title : partyName,
        info: "Tracked Compo Entries",
        modules: modules
    }
    let filename = partyName.toLowerCase().replace(" ","_") + ".json";
    let json = JSON.stringify(playlist,null,2);
    fs.writeFileSync(filename,json);

    console.log("Playlist written to file: " + filename);
}

async function getPartyData(){
    let content = await getHTML(url);
    partyName = getPartyName(content);
    console.log(partyName);
    let list = extractTrackedMusic(content);
    list = await resolveDownloadUrls(list);
    return list;
}

function getPartyName(content){
    let result = rightFrom(content,'focus_title party_name');
    result = rightFrom(result,'>');
    result = leftFrom(result,'</div>');
    result = extractTagContent(result);
    result = cleanString(result);
    return result;
}

function downloadFile(url){
    return new Promise(next=>{
        let filename = url.split("/").pop();
        const file = fs.createWriteStream(filename);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                if (response.statusCode === 302){
                    downloadFile(response.headers.location).then(next);
                    return;
                }
                console.error(`Failed to download file: ${response.statusCode}`);
                return;
            }
            response.pipe(file);

            file.on('finish', () => {
                file.close(next);  // Close the file stream and call the callback
            });
        }).on('error', (err) => {
            fs.unlink(destination, () => next(err));  // Delete the file if there's an error
        });
    });

}

function resolveDownloadUrls(list){
    return new Promise(async next=>{
        for (let i=0;i<list.length;i++){
            let item = list[i];
            let details = await getDetails("https://demozoo.org" + item.link);
            item.download = details.download;
            item.format = details.format;
            item.channels = details.channels;
        }
        next(list);
    });
}

function getDetails(url){
    return new Promise(async next=>{
        let content = await getHTML(url);
        let links = extractsection(content,'"download_links"',"ul");
        let tags = extractsection(content,'"tags"',"ul") || "";

        links = getTags(links,'a');
        let result = {};
        links.forEach(link=>{
            if (link.indexOf('"primary">')>=0){
                result.download = extractTagParam(link,'href');
            }
        });

        if (!result.download){
            let links = extractsection(content,'"download_links"',"ul");
            links = getTags(links,'div');
            links.forEach(link=>{
                if (link.indexOf('"primary">')>=0){
                    result.download = extractTagParam(link,'href');
                }
            });
        }


        if (tags.indexOf('"/productions/tagged/it/"')>=0) result.format="IT";
        if (tags.indexOf('"/productions/tagged/mod/"')>=0) result.format="MOD";
        if (tags.indexOf('"/productions/tagged/xm/"')>=0) result.format="XM";
        if (tags.indexOf('"/productions/tagged/4ch/"')>=0) result.channels=4;
        if (tags.indexOf('"/productions/tagged/8ch/"')>=0) result.channels=8;
        if (tags.indexOf('"/productions/tagged/16ch/"')>=0) result.channels=16;
        if (tags.indexOf('"/productions/tagged/32ch/"')>=0) result.channels=32;
        if (tags.indexOf('"/productions/tagged/openmpt/"')>=0) result.format="OPENMPT";
        if (tags.indexOf('"/productions/tagged/renoise/"')>=0) result.format="RENOISE";

        next(result);
    });
}


function extractTrackedMusic(html){
    let result;
    let titles = [
        "Tracked Music",
        "Amiga 4 Channel Music",
        "Combined Music",
        "Amiga Music",
        "Amiga Tracked MSX",
        "Old School Music",
        "Oldschool Music"
    ];

    for (let i=0;i<titles.length;i++){
        if (html.indexOf('class="competition__heading">'+titles[i])>=0){
            result = rightFrom(html,'class="competition__heading">'+titles[i]);
            break;
        }
    }

    result = rightFrom(result,'table');
    result = leftFrom(result,'</table>');
    let rows = getTableRows(result);

    let list = [];
    rows.forEach(row=>{
        let item = {};
        let title = extractsection(row,'"result__title"',"div");
        item.link = extractTagParam(title,'href');
        item.title = cleanString(extractTagContent(title));

        let author = extractsection(row,'"result__author"',"div");
        item.groups=[];
        let links = getTags(author,'a');
        links.forEach(link=>{
            if (link.indexOf("group")>=0){
                item.groups.push(extractTagContent(link));
            }
            if (link.indexOf("sceners")>=0){
                item.author = extractTagContent(link);
            }
        })

        let ranking = extractsection(row,'"result__ranking"',"span") || "";
        if (ranking) item.ranking = ranking;
        list.push(item);
    })
    return list;
}

function extractTagContent(content){
    let result = rightFrom(content,'>');
    result = leftFrom(result,'</');
    return result;
}

function extractTagParam(content,param){
    let result = rightFrom(content,param);
    result = rightFrom(result,'"');
    result = leftFrom(result,'"');
    return result;
}


function extractsection(content,section,tag){
    let result = rightFrom(content,section);
    result = rightFrom(result,">");
    result = leftFrom(result,"</"+tag+">");
    return result;
}

function getTableRows(content){
    let result = [];
    if (!content) return result;
    let p = content.indexOf("<tr");
    while (p>=0){
        let q = content.indexOf("</tr>",p);
        if (q>=0){
            let row = content.substring(p,q+5);
            result.push(row);
            p = content.indexOf("<tr",q);
        }else{
            p = -1;
        }
    }
    return result;
}

function getTags(content,tag){
    let result = [];
    let p = content.indexOf("<"+tag);
    while (p>=0){
        let q = content.indexOf("</"+tag+">",p);
        if (q>=0){
            let row = content.substring(p,q+3+tag.length);
            result.push(row);
            p = content.indexOf("<"+tag,p+1);
        }else{
            p = -1;
        }
    }
    return result;
}

function rightFrom(content,fragment){
    if (!content) return content;
    let p = content.indexOf(fragment);
    let result = "";
    if (p>=0){
        result = content.substring(p + fragment.length);
    }
    return result;
}

function leftFrom(content,fragment){
    if (!content) return content;
    let p = content.indexOf(fragment);
    let result = "";
    if (p>=0){
        result = content.substring(0,p);
    }
    return result;
}


function getHTML(url) {
    return new Promise(next=>{
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode === 200) {
                    next(data);
                } else {
                    next("");
                }
            });

        }).on('error', (err) => {
            next("");
        });
    });
}

function cleanString(s){
    if (!s) return s;
    s = s.replaceAll("&#x27;", "'");
    s = s.replaceAll("&amp;", "&");
    s = s.replaceAll("&quot;", '"');
    s = s.replaceAll("&lt;", "<");
    s = s.replaceAll("&gt;", ">");
    s = s.replaceAll(":", "");

    return s;
}



main();