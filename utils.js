async function toArray(asyncIterator) {
  const arr = [];
  for await (const i of asyncIterator) {
    arr.push(i);
  }
  return arr;
}

function isEmpty(value) {
  for (let prop in value) {
    if (value.hasOwnProperty(prop)) return false;
  }
  return true;
}

function all(arr, predicate) {
  for (const item in arr) {
    if (!predicate(item)) {
      return false;
    }
  }
  return true;
}

function any(arr, predicate) {
  for (const item in arr) {
    if (predicate(item)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  toArray,
  isEmpty,
  all,
  any,
};
