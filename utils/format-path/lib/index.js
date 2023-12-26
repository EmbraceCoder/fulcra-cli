'use strict';
const path = require("path")
module.exports = formatPath;

function formatPath(p) {
  if (p) {
    const sep = path.sep

    if (sep === '/' && typeof p === "string") {
      return p
    }else {
      return p.replace(/\\/g, '/')
    }

  }
  return p
}
