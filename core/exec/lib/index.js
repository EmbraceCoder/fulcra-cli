'use strict';

const Package = require("@fulcra/package")
const log = require("@fulcra/log/lib")
const path = require("path");

const {spawn} = require("@fulcra/tool")

module.exports = exec;


const SETTINGS = {
  init: "@fulcra/init"
}

const CACHE_MODULES_DIR = "dependencies"
async function exec() {
  log.verbose("Exec", "============ 动态加载命令 =============")

  let targetPath = process.env.CLI_TARGET_PATH

  let pkg;

  let storeDir = ""

  const homePath = process.env.CLI_HOME_PATH

  const cmdObj = arguments[arguments.length - 1]

  const cmdName = cmdObj.name()

  const packageName = SETTINGS[cmdName]

  const packageVersion = "latest"


  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_MODULES_DIR)
    // 生成缓存路径
    storeDir = path.resolve(targetPath, "node_modules")
    log.verbose("targetPath", targetPath)
    log.verbose("storeDir", storeDir)
    log.verbose("homePath", homePath)


    pkg = new Package({
      targetPath,
      packageName,
      storeDir,
      packageVersion
    })

    if (await pkg.exists()) {
      log.verbose("update", "更新 Package")
      // 更新 package
      await pkg.update()
    }else {
      log.verbose("install", "下载 Package")
      // 下载 package
      await pkg.install()
    }

  }else {
    log.verbose("targetPath", targetPath)
    log.verbose("storeDir", storeDir)
    log.verbose("homePath", homePath)
    pkg = new Package({
      targetPath,
      packageName,
      storeDir,
      packageVersion
    })
  }

  const rootFile = pkg.getRootFilePath()

  if (rootFile) {
    try {

      let args = Array.from(arguments)


      args = args.slice(0, args.length - 1)


      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`

      const child = spawn("node", ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

      child.on("error", e => {
        log.error(e.message)
        process.exit(1)
      })

      child.on("exit", e => {
        log.verbose("命令执行成功", e)
        process.exit(e)
      })

    }catch (e) {
      log.warn(e)
    }
  }
}


