'use strict';

const axios = require("axios")
const urlJoin = require("url-join")
const semver = require("semver")

// 获取 package 信息
function getNpmInfo(npmName, registry) {
  if (!npmName) return null;
  let registryUrl = registry || getDefaultRegistry()
  const npmInfoUrl = urlJoin(registryUrl, npmName)

  return axios.get(npmInfoUrl).then(response => {
    if (response.status === 200) {
      return response.data
    }
    return null
  }).catch(err => {
    return Promise.reject(err)
  })
}

// 获取注册表的的 URL
function getDefaultRegistry(isOriginal = true) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}

// 获取 package 所有版本信息
async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry)
  if (data) {
    return Object.keys(data.versions)
  }else {
    return []
  }
}

// 获取大于当前版本的版本号
function getSemverVersion(baseVersion, versions) {
  versions = versions
    .filter(version => semver.satisfies(version, `^${baseVersion}`))
    .sort((a, b) => semver.compare(a, b))

  return versions
}

// 获取 npm 最新版本
async function getLastNpmVersion(baseVersion, npmName, registry) {
  const versions = await getNpmVersions(npmName, registry)
  const newVersions = await getSemverVersion(baseVersion, versions)
  if (newVersions && newVersions.length > 0) {
    return newVersions[0]
  }
}

async function getNpmLatestVersion(npmName, registry) {
  let versions = (await getNpmVersions(npmName, registry))
  if (versions && versions.length > 0) {
    versions = versions.sort((a,b) => {
      return semver.compare(b, a)
    })

    return versions[0]
  }
  return null
}

module.exports = {
  getNpmInfo,
  getNpmVersions,
  getDefaultRegistry,
  getLastNpmVersion,
  getNpmLatestVersion
};

