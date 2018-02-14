#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

var ver = process.versions.node;
var majorVer = parseInt(ver.split('.')[0], 10);
var path = require('path'), fs=require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var async = require('async');
var argv = require('yargs').argv;

var mkdirp = require('mkdirp');

if(!argv.name){
	console.log('Error!! Put the name');
	console.log('sonarscansql --name Yourname');
	process.exit();
}

var deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index){
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

function getCurrentDir(){
    var currentDirFull = path.resolve(process.cwd(), '.');
    var currentDirList = currentDirFull.split(path.sep);
    return currentDirList[currentDirList.length-1]
}

function fromDir(startPath,filter,callback){

    //console.log('Starting from dir '+startPath+'/');

    if (!fs.existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }

    var files=fs.readdirSync(startPath);
    for(var i=0;i<files.length;i++){
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()){
            fromDir(filename,filter,callback); //recurse
        }
        else if (filter.test(filename))callback(filename);
    };
};

var currentDirName = getCurrentDir();
var currentDirPath = path.resolve(process.cwd(), '.');
var newDirName = currentDirName + '-SQL';
var workDir = currentDirPath + path.sep + newDirName;

console.log(newDirName);

deleteFolderRecursive(workDir);
mkdirp(workDir, function (err) {
  if (err) console.error(err);
  else {
    console.log('mkdir end');

    fromDir(currentDirPath,/\.xml$/,function(filename){
	console.log(filename);
	var data = fs.readFileSync(filename, 'utf8');
       	var pattern = /<query>/g;
       	if(pattern.test(data)){
                parser.parseString(data, function(err, result) {
                        var queryList = result['query']['sql'];
                        queryList.forEach((q, i) => {
                                var sql_id = q['$']['id'];
                                var queryBody = q['_'];
                                console.log(sql_id);
                                var path = require("path");
				if (fs.existsSync(workDir + path.sep + sql_id + '.sqlx')) {
					        console.log('Error!! Detected it same query id');
					       	deleteFolderRecursive(workDir);
						process.exit();

			       	}
                                fs.writeFile(workDir + path.sep + sql_id + '.sqlx', '/* ' + sql_id + ' */\r\n' + queryBody, function(err) {
                                        if(err) {
                                               return console.log(err);
                                              }
                                        }); /* write sql file*/
                        });

                        console.log(err);
                });
	}
    });


    var exec = require('child_process').exec;
    function puts(error, stdout, stderr) {
	    console.log(stdout);
	    deleteFolderRecursive(workDir);
    }
    console.log("sonar-scanner -Dsonar.projectKey=" + newDirName + "-" +argv.name + " -Dsonar.sources=" + newDirName);
    exec("cd " + workDir + " && sonar-scanner -Dsonar.projectKey=" + newDirName + "-" +argv.name + " -Dsonar.sources=." , puts)
  }
});
