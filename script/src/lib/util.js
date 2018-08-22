function getUrlParameter(param){
    if (window.location.getParameter){
        return window.location.getParameter(param);
    } else if (location.search) {
        var parts = location.search.substring(1).split('&');
        for (var i = 0; i < parts.length; i++) {
            var nv = parts[i].split('=');
            if (!nv[0]) continue;
            if (nv[0] == param) {
                return nv[1] || true;
            }
        }
    }
}

function formatFileSize(size){
    var unit = "k";
    if (isNaN(size)) size=0;
    size = Math.round(size/1000);
    if (size>1000){
        size = Math.round(size/100)/10;
        unit = "MB"
    }
    return size + unit;
}
