const DEBUG = true;

function logJSONDebug(obj) {
  console.error(JSON.stringify(obj));
}

function logInfo(message, ...args) {
  console.log(message, ...args);
  if (DEBUG) {
    logJSONDebug({log: 'info', message, args});
  }
}

module.exports = {
  info: logInfo,
  debugJSON: logJSONDebug,
};
