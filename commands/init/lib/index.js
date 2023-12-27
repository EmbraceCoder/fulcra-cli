'use strict';

const Command = require("@fulcra/command")
const log = require("@fulcra/log/lib")
const fs = require("fs")
const fse = require("fs-extra")
const path = require("path");
const inquirer = require("inquirer")
const semver = require("semver")
const {getProjectTemplate} = require("./getProjectTemplate")
const Package = require("@fulcra/package")
const {homedir} = require("os")
const {spinnerStart, sleep, execAsync} = require("@fulcra/tool")

const ejs = require("ejs")
const glob = require("glob")


const CREATE_TYPE = {
  PROJECT: 'project',
  COMPONENT: 'component'
}

const TEMPLATE_TYPE = {
  NORMAL: 'normal',
  CUSTOM: 'custom'
}
const WHITE_COMMAND = ['npm', 'cnpm', 'yarn', 'pnpm']

class InitCommand extends Command {
  init() {
    log.verbose("InitCommand", "============ 创建项目 =============")

    this.projectName = this._argv[0] || ""
    this.force = !!this._cmd.force

    log.verbose("参数:", this._argv)

    log.verbose("项目名称:", this.projectName)
    log.verbose("是否强制初始化:", this.force)

  }

  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare()

      if (projectInfo) {
        this.projectInfo = projectInfo
        // 2. 下载模版
        log.verbose("项目信息:", projectInfo)

        await this.downloadTemplate()

        // 3. 安装模版
        await this.installTemplate()
      }

    } catch (e) {
      log.error(e.message)
    }

  }

  // 命令执行前的准备
  async prepare() {

    log.verbose("process env", process.env)

    const template = await getProjectTemplate()

    if (!template && template.length === 0) {
      throw new Error("项目模版不存在")
    }

    this.template = template

    // 1. 判断当前目录是否存在
    if (this.isCreateProjectDirExists(this.projectName)) {
      let isCover = false
      if (!this.force) {
        // 1.1. 询问是都继续创建
        isCover = (await inquirer.prompt({
          type: "confirm",
          message: "文件夹目录已存在, 是否继续创建项目?",
          name: "isCover",
          default: false
        })).isCover


        if (!isCover) {
          process.exit(1)
        }
      }

      if (isCover || this.force) {
        // 2. 是否强制更新
        const {confirmDelete} = await inquirer.prompt({
          type: "confirm",
          name: "confirmDelete",
          default: false,
          message: "是否清除已存在目录下的文件?"
        })
        if (confirmDelete) {
          fse.emptydirSync(path.resolve(process.cwd(), this.projectName))
        }
      }
    }

    return await this.getProjectInfo()

  }

  // 获取项目信息
  async getProjectInfo() {
    let projectInfo = {}
    let isProjectNameValid = false


    // 如果传入的项目名称合法, 则跳过输入项目名称
    if (isValidName(this.projectName)) {
      projectInfo.projectName = this.projectName
      isProjectNameValid = true
    }

    function isValidName(v) {
      return /^[a-zA-Z]+[\w-]*[a-zA-Z0-9]$/.test(v)
    }

    // 选择项目或者组件
    const {type} = await inquirer.prompt({
      type: "list",
      name: "type",
      message: "请选择初始化类型",
      default: CREATE_TYPE.PROJECT,
      choices: [{
        name: "项目",
        value: CREATE_TYPE.PROJECT
      }, {
        name: "组件",
        value: CREATE_TYPE.COMPONENT
      }]
    })

    log.verbose("type", type)


    this.template = this.template.filter(temp => {
      return temp.tag.includes(type)
    })

    const title = type === CREATE_TYPE.PROJECT ? "项目" : "组件"

    const projectPrompt = []

    const projectNamePrompt = {
      type: "input",
      name: 'projectName',
      message: `请输入${title}名称:`,
      default: "",
      validate: function (v) {
        const done = this.async();

        if (!isValidName(v)) {
          done(`请输入合法的${title}名称`)
          return
        }

        done(null, true)
      },
      filter: function (v) {
        return v
      }
    }

    if (!isProjectNameValid) {
      projectPrompt.push(projectNamePrompt)
    }

    projectPrompt.push(
      {
        type: "list",
        name: "projectTemplate",
        message: `请选择${title}模板`,
        choices: this.createTemplateChoice()
      },
      {
        type: "input",
        name: 'projectVersion',
        message: `请输入${title}版本号:`,
        default: "1.0.0",
        validate: function (v) {

          const done = this.async();

          if (!(!!semver.valid(v))) {
            done(`请输入合法的${title}版本号`)
            return
          }

          done(null, true)
        },
        filter: function (v) {
          return v
        }
      }

    )

    // 获取项目的基本信息
    switch (type) {
      case CREATE_TYPE.PROJECT:
        const project = await inquirer.prompt(projectPrompt)

        projectInfo = {
          type,
          ...project,
          ...projectInfo
        }
        break;
      case CREATE_TYPE.COMPONENT:

        const descriptionPrompt =       {
            type: "input",
            name: 'componentDescription',
            message: "请输入组件描述信息:",
            default: "",
            validate: function (v) {

              const done = this.async();

              if (!v) {
                done("请输入组件描述信息")
                return
              }

              done(null, true)
            },
          }
        projectPrompt.push(descriptionPrompt)

        const component = await inquirer.prompt(projectPrompt)

        projectInfo = {
          type,
          ...component,
          ...projectInfo
        }
        break;
    }

    // 生成 className

    if (projectInfo.projectName) {

      projectInfo.className = require("kebab-case")(projectInfo.projectName).replace(/^-/, '')
    }

    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion
    }

    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription
    }

    projectInfo.defProjectName = this.projectName

    // 返回项目的基本信息
    return projectInfo
  }

  // 查看创建项目的文件夹是否存在, 或文件夹是否为空
  isCreateProjectDirExists(projectName) {
    const localPath = process.cwd()

    const fileList = fs.readdirSync(localPath)

    return fileList.includes(projectName) && fs.readdirSync(path.resolve(localPath, projectName)).length > 0
  }

  // 创建模版渲染
  createTemplateChoice() {
    return this.template.map(item => {
      return {
        name: item.name,
        value: item.npmName
      }
    })
  }

  // 下载模版
  async downloadTemplate() {
    // 通过项目模版 API 获取项目模版信息
    const {projectTemplate} = this.projectInfo
    const userHome = homedir()
    const templateInfo = this.template.find(temp => {
      return temp.npmName === projectTemplate
    })

    this.templateInfo = templateInfo
    log.verbose("模版信息", templateInfo)

    const targetPath = path.resolve(userHome, '.fulcra-cli', 'template')
    const storeDir = path.resolve(userHome, '.fulcra-cli', 'template', 'node_modules')
    const {npmName, version} = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })

    this.templateNpm = templateNpm

    if (!await templateNpm.exists()) {
      // 下载 template
      const spinner = spinnerStart("正在下载模版...")
      await sleep()
      try {
        await templateNpm.install()
      } catch (err) {
        throw new Error(err.message)
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success("下载模板成功")
        }

      }

    } else {
      const spinner = spinnerStart("正在更新模版...")
      await sleep()
      try {
        await templateNpm.update()
        log.success("更新模板成功")
      } catch (err) {
        throw new Error(err.message)
      } finally {
        spinner.stop(true)
      }
    }
    // 通过 express 搭建一套后端系统
    // 通过 npm 存储项目模版
    // 将项目模版信息存储到 mongodb 数据库中
    // 通过 express 获取 mongodb 中的数据并通过 API 返回
  }

  // 安装模版
  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE.NORMAL
      }

      switch (this.templateInfo.type) {
        case TEMPLATE_TYPE.NORMAL:
          await this.installNormalTemplate()
          break;
        case TEMPLATE_TYPE.CUSTOM:
          await this.installCustomTemplate()
          break;
        default:
          throw new Error("项目模版类型无法识别")
      }

    } else {
      throw new Error("项目模版信息不存在!")
    }
  }

  // 执行命令
  async execCommand(command, errMsg) {
    let ret;
    if (command) {
      const cmdArray = command.split(" ")
      const cmd = this.checkCommand(cmdArray[0])
      if (!cmd) {
        throw new Error("命令不存在! 命令:" + command)
      }

      const args = cmdArray.slice(1)
      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: path.resolve(process.cwd(), this.projectName)
      })
    }
    // 项目启动

    if (ret !== 0) {
      throw new Error(errMsg)
    }

    return ret
  }

  // 安装标准模版
  async installNormalTemplate() {

    const spinner = spinnerStart("正在安装模版...")
    await sleep()
    // 拷贝代码到当前目录
    const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
    const targetPath = path.resolve(process.cwd(), this.projectName)

    try {

      fse.ensureDirSync(templatePath)
      fse.ensureDirSync(targetPath)
      fse.copySync(templatePath, targetPath)

    } catch (err) {

      throw new Error(err.message)

    } finally {

      spinner.stop(true)
      log.success("模版安装成功")

    }

    // ejs 模版渲染

    const {
      installCommand, startCommand
    } = this.templateInfo

    const ignoreTemplate = this.templateInfo.ignore || []

    const ignore = ['**/node_modules/**', '**/assets/**', ...ignoreTemplate]

    await this.ejsRender({ignore})


    // 依赖安装
    await this.execCommand(installCommand, "项目依赖安装失败!")

    // 运行项目
    await this.execCommand(startCommand, "项目运行失败!")
  }

  // 安装自定义模版
  async installCustomTemplate() {
    if (await this.templateNpm.exists()) {
      // 查找入口文件
      const rootFile = this.templateNpm.getRootFilePath()
      if (fs.existsSync(rootFile)) {
        log.verbose("download", "====== 开始执行自定义模版 =======")
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
        const targetPath = path.resolve(process.cwd(), this.projectName)

        const options = {
          sourcePath: templatePath,
          targetPath: targetPath,
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo
        }
        const code = `require('${rootFile}')(${JSON.stringify(options)})`
        log.verbose("code", code)
        await execAsync('node', ['-e', code], {
          stdio: 'inherit',
          cwd: process.cwd()
        })
      }else {
        throw new Error("自定义模版入口文件不存在")
      }

    }

  }

  // 检查命令
  checkCommand(cmd) {
    return WHITE_COMMAND.includes(cmd) ? cmd : null
  }

  // ejs 模版渲染
  async ejsRender(options) {
    const dir = path.resolve(process.cwd(), this.projectName)
    const _this = this

    return new Promise((resolve, reject) => {
      glob('**', {
        cwd: dir,
        ignore: options.ignore,
        nodir: true
      }, (err, files) => {


        if (err) {
          reject(err)
        }
        const imagePattern = /\.(jpg|png|gif|jpeg)$/i; // 正则表达式匹配.jpg和.png文件
        Promise.all(files.map(file => {
          const filePath = path.join(dir, file)
          return new Promise((resolve, reject) => {
            if (!imagePattern.test(filePath)) {
              ejs.renderFile(filePath, _this.projectInfo
                , {}, (err, result) => {
                  if (err) {
                    reject(err)
                  } else {
                    fse.writeFile(filePath, result)
                    resolve(result)
                  }
                })
            }else {
              resolve()
            }
          })
        })).then(() => {
          resolve()
        }).catch(err => {
          reject(err)
        })
      })
    })
  }

}

function init(argv) {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
