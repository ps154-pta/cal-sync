async function toArray(asyncIterator) {
  const arr = [];
  for await (const i of asyncIterator) {
    arr.push(i);
  }
  return arr;
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
  toArray, all, any,
};
