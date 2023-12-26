const log = require("@fulcra/log/lib");
const pkg = require("../package.json");
const constant = require("./const");
const semver = require("semver");
const colors = require("colors/safe");
const rootCheck = require("root-check");
const userHome = require("user-home");

const  {homedir} = require("os")
const {sync: pathExists} = require("path-exists");
const path = require("path");
const dotEnv = require("dotenv");

console.log(homedir())

module.exports = prepare

async function prepare() {
  checkPkgVersion()
  checkRoot()
  checkUserHome()
  checkEnv()
  await checkGlobalUpdate()
}
function checkPkgVersion() {
  log.notice("版本号", pkg.version)
}



function checkRoot() {
  rootCheck()
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在!'))
  }
}

function checkEnv() {
  const dotEnvPath = path.resolve(userHome, ".env")

  if (pathExists(dotEnvPath)) {
    dotEnv.config({
      path: dotEnvPath
    })
  }
  createDefaultConfig()
  log.verbose("环境变量", process.env.CLI_HOME_PATH)
}

function createDefaultConfig() {
  const cliConfig = {
    home: userHome
  }
  if (process.env.CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  }else {
    cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}

async function checkGlobalUpdate() {
  // 获取当前版本号
  const currentVersion = pkg.version
  const npmName = pkg.name

  // 调用 npm api 获取所有的版本号
  const { getLastNpmVersion } = require("@fulcra/get-npm-info")

  // 提取所有的版本号, 对比哪些版本号大于当前版本号
  // 获取最新的版本号, 提示用户更新到该版本

  const lastVersion = await getLastNpmVersion(currentVersion, "url-join")


  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn("更新提示", colors.yellow(`请手动更新 ${npmName}, 当前版本:${currentVersion}, 最新版本:${lastVersion}, 更新命令: npm install -g ${npmName}`))
  }

}




