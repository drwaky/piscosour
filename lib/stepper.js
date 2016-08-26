'use strict';

const path = require('path');

const moment = require('moment');

const config = require('./config');
const logger = require('./logger');
const fsUtils = require('./utils/fsUtils');
const Step = require('./step');
const isInside = function(key, values) {
  const sep = ',';
  if (values && values.indexOf(sep) >= 0) {
    return values.split(sep).indexOf(key) >= 0;
  } else {
    return key === values;
  }
};

/**
 *
 * Runs one step. Is the responsible to run all the stages of a step.
 *
 * @returns {{execute: execute}}
 * @module stepper
 */
const stepper = function() {

  let step;

  const _setWorkingDir = function() {
    const dirName = path.join(config.rootDir, step.params.workingDir);
    logger.trace('#green', 'stepper', 'workingDir:', '#cyan', dirName);

    if (fsUtils.exists(dirName)) {
      process.chdir(dirName);
    } else {
      logger.warn('#yellow', 'workingDir:', '#cyan', dirName, '#yellow', 'doesn\'t exists!!!', 'go to execution directory instead ->', config.rootDir);
      step.params.workingDir = '';
      process.chdir(config.rootDir);
    }
  };

  /**
   * Execute step by step recursively and synchronized!
   * @param n
   * @param resolve
   * @param reject
   */
  const _synchro = function(n, resolve, reject) {

    const _report = function(content, status, last) {
      const end = moment();
      return {
        status: status,
        message: (n + 1) + '-' + config.stages[n],
        content: content,
        time: (end - step.init),
        order: step.order,
        last: last
      };
    };

    const _resolve = function(result) {
      const isLast = n === config.stages.length - 1;
      step.report(_report(result, 0, isLast));
      if (result && result.skip || isLast) {
        logger.info('\n\n', '#magenta', 'Finished', '|', '#green', step.params.description, '-', '#duration', moment() - step.initStep, '\n');
        resolve(step.outputs);
      } else {
        _synchro(n + 1, resolve, reject);
      }
    };

    const _reject = function(err) {
      logger.error('#green', 'stepper', 'error on', '#cyan', config.stages[n], '(', n, 'of', config.stages.length, ')', '#red', 'ERROR', (err && err.error || err));
      step.report(_report(err, 1, !err || !err.keep));
      if (err && err.keep) {
        _synchro(n + 1, resolve, reject);
      } else {
        logger.info('\n\n', '#magenta', 'Finished', '|', '#green', step.params.description, '-', '#duration', moment() - step.initStep, '\n');
        reject(err);
      }
    };

    if (n < config.stages.length) {

      logger.trace('#green', 'stepper', 'running', '#cyan', config.stages[n], '(', n, 'of', config.stages.length, ')');
      _setWorkingDir();

      if (!step.params.pstage || isInside(config.stages[n], step.params.pstage)) {

        step._doPlugins(config.stages[n])
          .then((result) => {
            if (result && result.skip === true) {
              return Promise.resolve(result);
            }
            const promise = step._do(config.stages[n]);
            if (promise) {
              return promise;
            } else {
              return Promise.resolve({skipped: true});
            }
          })
          .then(_resolve)
          .catch((err) => _reject(err));

      } else {
        _resolve();
      }

    } else {
      resolve();
    }
  };

  /**
   * Execute one step with conditions checks
   *
   * @param normal step name
   */
  const execute = function(normal, resolve, reject) {
    const stepConfig = config.load(normal);

    step = stepConfig.step ? new Step(stepConfig.step, stepConfig.plugins) : {};

    if (step._do) {
      step.initStep = moment();
      step.order = normal.order ? normal.order : 0;
      logger.info('\n\n', '#magenta', 'Starting', '|', '#green', step.params.description, '| [', '#bold', normal.orig, ']', '\n');
      _synchro(0, resolve, reject);
    } else {
      reject('Step "' + normal.name + '" is not defined for context: "' + normal.context + '"');
    }
  };

  return {
    execute: execute
  };
};

module.exports = stepper();