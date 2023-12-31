'use strict';
const LOWEST_NODE_VERSION = "12.0.0"
const semver = require("semver");
const colors = require("colors/safe");
const log = require("@fulcra/log/lib")
class Command {
  constructor(argv) {

    log.verbose("argv", argv)

    this._argv = argv

    if (!argv) {
      throw new Error("参数不能为空")
    }

    if (!Array.isArray(argv)) {
      throw new Error("参数必须为数组")
    }
    if (argv.length < 1) {
      throw new Error("参数列表不能为空")
    }


    let chain = Promise.resolve()
    chain = chain.then(() => this.checkNodeVersion())
    chain = chain.then(() => this.initArgs())
    chain = chain.then(() => this.init())
    chain = chain.then(() => this.exec())
    chain.catch(err => {
      log.warn("Command Error", err)
    })

  }

  init() {
    throw new Error('init 必须被实现')
  }

  exec() {
    throw new Error('exec 必须被实现')
  }

  checkNodeVersion() {
    // 获取当前版本号
    const curNodeVersion = process.version
    // 对比最低版本号
    const lowestNodeVersion = LOWEST_NODE_VERSION

    if (!semver.gte(curNodeVersion, lowestNodeVersion)) {
      throw new Error(colors.red(`fulcra 需要安装 v${lowestNodeVersion} 以上版本的 Node.js`))
    }
  }

  initArgs() {
    this._cmd = this._argv[this._argv.length - 1]
    this._argv = this._argv.slice(0, this._argv.length - 1)
  }

}

module.exports = Command
