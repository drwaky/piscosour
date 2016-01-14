/*jshint node:true */

'use strict';

var logger = require("./logger"),
    runSequence = require('run-sequence'),
    spawn = require('child_process').spawn;

/**
 * Definition of a Shot
 * @param runner
 * @returns {Shot}
 * @constructor
 */
var Shot = function(runner){
    this.runner = runner;
    return this;
};

Shot.prototype.do = function(stage){
    logger.trace("#green", "shot:do",this.runner.description, stage);
    var operation = this.runner[stage];
    if (operation)
        return new Promise(function (resolve, reject) {
            operation(resolve, reject);
        });
    else
        return;
};

Shot.prototype.execute = function(cmd,args,resolve, reject){
    const child = spawn(cmd, args);

    child.stdout.on('data', function(data){
        console.log(data.toString());
    });

    child.stderr.on('data', function(data){
        logger.error(data.toString());
    });

    child.on('close', function(code){
        logger.info("child process exited with code ",code);
        if (code!==0){
            reject();
        }else{
            resolve();
        }
    });
};

Shot.prototype.runGulp = function(cmd,resolve, reject) {
    runSequence(cmd, function (err) {
        if (err) {
            logger.error("Finished '", "#cyan", cmd);
            reject();
        } else {
            logger.info("Finished '", "#cyan", cmd);
            resolve();
        }
    });
}

module.exports = Shot;