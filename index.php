<?php
$myFile = "ip.txt";
if(isset($_POST['ip'])){
	$fh = fopen($myFile, 'w') or die("can't open file");
	fwrite($fh, $_POST['ip']);
	fclose($fh);
	echo '200 OK';
}
else{
	echo "Redirecting...";
	$file = fopen($myFile, "r") or die("Unable to open file!");
	$ip = fgets($file);
	fclose($file);
	header('Location: http://'.$ip);
}
?>