import ModalDialog from "../ui/components/modalDialog.js";
import UI from "../ui/ui.js";
import EventBus from "../eventBus.js";
import {EVENT, SETTINGS} from "../enum.js";

var Dropbox = function(){
    var me = {};

	var authRedirect = "https://www.stef.be/bassoontracker/auth/dropbox.html";
    me.isConnected = false;
    var dropboxService;

    me.checkConnected = function(){

        return new Promise(async next=>{
            if (me.isConnected){
                next(true);
            }

            if (!dropboxService){
                let module = await import("../lib/dropbox.js");
                dropboxService = module.default();
            }

            if (dropboxService.getAccessToken()){
                dropboxService('users/get_current_account',undefined,{onComplete:function(result){
                        if (result && result.account_id){
                            me.isConnected = true;
                            next(true);
                        }
                    },onError:function(){
                        next(false);
                    }});
            }else{
                next(false);
            }
        })
    };

    me.showConnectDialog = function(){
        var dialog = ModalDialog();
        dialog.setProperties({
            width: UI.mainPanel.width,
            height: UI.mainPanel.height,
            top: 0,
            left: 0,
            ok: true,
            cancel: true
        });

        dialog.onClick = function(touchData){
            var elm = dialog.getElementAtPoint(touchData.x,touchData.y);
            if (elm && elm.name){
				UI.setStatus("");
                if (elm.name === "okbutton"){
                    Dropbox.authenticate();
                }else{
                    dialog.close();
                    EventBus.trigger(EVENT.dropboxConnectCancel);
                }
            }
        };

        dialog.setText("DROPBOX ://BassoonTracker is not yet connected to DropBox//Do you want to do that now?//(BassoonTracker will only have access/to its own BassoonTracker folder,/not your entire DropBox)");

        UI.setModalElement(dialog);
    };

    me.authenticate = async function(){
        dropboxService.clearAccessToken();
        dropboxService.authenticate({client_id: 'ukk9z4f0nd1xa13',redirect_uri : authRedirect} , {
            onComplete:function(a){
                console.log("ok!");
                console.log(a);
            },
            onError:function(a){
                console.error("not OK!");
                console.log(a);
            }
        });
    };

    me.list = function(path,next){
        dropboxService('files/list_folder', {path: path}, function(data){

            var result = [];

            data.entries.forEach(function(item){

                if (item[".tag"] &&item[".tag"] === "folder"){
					result.push({title:item.name,url:item.path_lower,children:[]});
                }else{
					var size = Math.floor(item.size/1000) + "kb";
					result.push({title:item.name + ' (' + size + ')' || "---",url:item.id,path:item.path_display});
                }
            });

            next(result);

        });
    };

    me.get = function(url,next){
        me.list(url,next);
    };

    me.getFile = function(file,next){
        dropboxService('files/download', {path: file.url}, function(result,a,b){
            console.log(result);
            console.log(a); // content
            console.log(b);
            next(a);
        });
    };

    me.putFile = function(path,content,next){

        var options = {path: path};
        if (SETTINGS.dropboxMode === "overwrite"){
			options.mode =  "overwrite";
        }else{
			options.mode =  "add";
			options.autorename = true;
        }

        UI.setStatus("Uploading to Dropbox...",true);
        dropboxService('files/upload', options, content,{
            onComplete : function(result,a,b){
                console.log(result);
                console.log(a);
                console.log(b);
                UI.setStatus("Done uploading to Dropbox");
                if (next) next(result);
            },
            onError : function(result,a,b){
                UI.setStatus("Error uploading to Dropbox ...");
                if (next) next(false);
            }
        });
    };

    return me;
}();

export default Dropbox;