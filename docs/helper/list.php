// simple PHP example script to list all modules in a directory and subdirectories
// if you want to load your modules from your own server

<?php
header('Content-Type: application/json');

// the following headers allow cross-domain access, not needed if you run this script on the same domain as the bassoontracker html page
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header("Access-Control-Allow-Headers: X-Requested-With");

$dir = "./mods"; //path to your module files
$urltoDir = "http://your.site.com/mods"; //url to your module files, leave blank if you want to use the same path as $dir

function read_dir($path) {
	$list = array();
	if($dh = opendir($path)){
		while (false !== ($entry = readdir($dh))) {
			if ($entry != "." && $entry != "..") {
				if (is_dir($path . "/" . $entry)){
					array_push($list, array(
						'title' => $entry,
						'children' => read_dir($path . "/" . $entry),
						)
					);
				}else{
					$ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
					$name = pathinfo($entry, PATHINFO_FILENAME);
					$url = $path . '/' . $entry;
					array_push($list, array(
						'title' => $name, 
						'url' => str_replace($GLOBALS['dir'], $GLOBALS['urltoDir'], $url), // note that the files need to have CORS enabled as well if you want to load them from a different domain
						'icon' => $ext,
						'info' => filesize($url) . " bytes"));
				}
			}
    	}
	}
	return $list;
}

	
if(is_dir($dir)){
    $return_array = array('modules'=> read_dir($dir));
    echo json_encode($return_array);
}

?>