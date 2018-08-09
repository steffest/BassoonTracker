var Dropbox = function(){
    var me = {};

	var authRedirect = "https://www.stef.be/bassoontracker/auth/dropbox.html";
    me.isConnected = false;

    me.checkConnected = function(next){
        if (dropboxService.getAccessToken()){
            dropboxService('users/get_current_account',undefined,{onComplete:function(result){
                if (result && result.account_id){
                    me.isConnected = true;
                    if (next) next(true);
                }
            },onError:function(){
                if (next) next(false);
            }});
        }else{
            if (next) next(false);
        }
    };

    me.authenticate = function(){
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

            data.entries.forEach(function(file){
                var size = Math.floor(file.size/1000) + "kb";
                result.push({title:file.name + ' (' + size + ')' || "---",url:file.id});
            });

            next(result);

        });
    };

    me.getFile = function(id,next){
        dropboxService('files/download', {path: id}, function(result,a,b){
            console.log(result);
            console.log(a); // content
            console.log(b);
            next(a);
        });
    };

    me.putFile = function(path,content,next){
        dropboxService('files/upload', {path: path}, content,{
            onComplete : function(result,a,b){
                console.log(result);
                console.log(a);
                console.log(b);
                if (next) next(result);
            },
            onError : function(result,a,b){
                if (next) next(false);
            }
        });
    };

    return me;
}();