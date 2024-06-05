const DEBUG = true;

function logJSONDebug(obj) {
  console.error(JSON.stringify(obj));
}

function logInfo(message) {
  console.log(message);
  if (DEBUG) {
    logJSONDebug({log: 'info', message});
  }
}

module.exports = {
  info: logInfo,
  debugJSON: logJSONDebug,
};
