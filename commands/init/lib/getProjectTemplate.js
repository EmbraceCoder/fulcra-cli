"use strict"

const request = require("@fulcra/request")

function getProjectTemplate() {
  return request({
    url: "/template",
    method: "GET"
  })
}

module.exports = {
  getProjectTemplate
}
