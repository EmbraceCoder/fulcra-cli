"use strict"

const log = require("@fulcra/log/lib")
const pkg = require("../package.json")
const colors = require("colors/safe")
const commander = require("commander")
const exec = require("@fulcra/exec")
const prepare = require("./prepare");
const program = new commander.Command()

module.exports = core

async function core() {
  try {
    await prepare()
    registerCommand()
  }catch (e) {
    log.error("error", colors.red(e.message))
    if (program.opts().debug) {
      console.log(e)
    }
  }

}



function registerCommand() {

  program.addHelpCommand(false)

  program
    .name(Object.keys(pkg.bin)[0])
    .usage("<command> [options]")
    .version(pkg.version, "-v, -version", "查看脚手架版本")
    .option("-d, --debug", "是否开启调试模式", false)
    .option('-tp, --targetPath <targetPath>', "是否指定本地调试文件路径")
    .option("-h, --help", "查看帮助文档", () => {
      return program.outputHelp()
    })




  program
    .command("init")
    .description("初始化项目")
    .argument("<projectName>", "项目名称")
    .option('-f, --force', "是否强制初始化项目", false)
    .action(exec)

  program.on("option:debug", function () {
    if (program.opts().debug) {
      process.env.LOG_LEVEL = 'verbose'
    }else {
      process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
  })

  program.on("option:targetPath", function () {
    process.env.CLI_TARGET_PATH = program.opts().targetPath
  })

  program.on("command:*", function (obj) {
    const availableCommands = program.commands.map(cmd => cmd.name())
    log.error("fulcra", colors.red(`未知命令:${obj[0]}`))

    if (availableCommands.length > 0) {
      log.notice("可用命令", availableCommands.join(","))
    }

    if (program.args && program.args.length < 1) {
      program.outputHelp()
      console.log()
    }
  })

  program.parse(process.argv)
}


