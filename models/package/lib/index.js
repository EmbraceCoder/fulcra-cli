'use strict';

const {isObject} = require("@fulcra/tool")
const formatPath = require("@fulcra/format-path")
const {getDefaultRegistry, getNpmLatestVersion} = require("@fulcra/get-npm-info/lib")
const path = require("path");
const npminstall = require("npminstall")
const pathExists = require("path-exists").sync
const pkgDir = require("pkg-dir").sync
const fse = require("fs-extra")
const semver = require("semver")
const log = require("@fulcra/log/lib")

class Package {
  constructor(options) {
    if (!options) {
      throw new Error("Package 类的 options 参数不能为空")
    }

    if (!isObject(options)) {
      throw new Error("Package 类的 options 参数必须为对象")
    }

    // package 路径
    this.targetPath = options.targetPath

    // 缓存 package 的路径
    this.storeDir = options.storeDir
    // package 名字
    this.packageName = options.packageName
    // package 版本号
    this.packageVersion = options.packageVersion

  }

  async prepare() {

    // 如果 store 目录没有被创建则创建一个
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir)
    }

    if (this.packageVersion === "latest") {
      this.packageVersion = await getNpmLatestVersion(this.packageName)
    }
  }

  get cacheFilePath() {
    return path.resolve(this.storeDir, this.packageName)
  }

  // 判断当前 Package 是否存在
  async exists() {
    if (this.storeDir) {
      // 非本地模式
      // 使用缓存
      await this.prepare()
      return pathExists(this.cacheFilePath)
    }else {
      // 非缓存模式, 指定了 targetPath, 没有指定 storePath,  使用本地调试文件
      return pathExists(this.targetPath)
    }
  }

  // 安装 package
  async install() {
    await this.prepare()
    return npminstall({
      // 指定安装的目标路径
      root: this.targetPath,
      // 指定存储安装包的路径
      storeDir: this.storeDir,
      // 指定要使用的注册表的 URL
      registry: getDefaultRegistry(),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion
        }
      ]
    })
  }
  // 更新 package
  async update() {
    await this.prepare()
    const latestPackageVersion = await getNpmLatestVersion(this.packageName)
    const dir = pkgDir(this.cacheFilePath)

    if (pathExists(dir)) {
      const pkg = require(path.resolve(dir, "package.json"))
      log.verbose("当前版本", pkg.version)
      log.verbose("最新版本", latestPackageVersion)
      log.verbose("是否更新", semver.gt(latestPackageVersion, pkg.version))

      if (semver.gt(latestPackageVersion, pkg.version)) {
        await npminstall({
          // 指定安装的目标路径
          root: this.targetPath,
          // 指定存储安装包的路径
          storeDir: this.storeDir,
          // 指定要使用的注册表的 URL
          registry: getDefaultRegistry(),
          pkgs: [
            {
              name: this.packageName,
              version: latestPackageVersion
            }
          ]
        })
        this.packageVersion = latestPackageVersion
      }
    }
  }

  // 获取入口文件路径
  getRootFilePath() {

    function _getRootFile(targetPath) {
      // 1. 获取 package.json 所在目录 - pkg-dir
      const dir = pkgDir(targetPath)

      if (dir) {
        // 2. 读取 package.json
        const pkgFile = require(path.resolve(dir, 'package.json'))
        // 3. 寻找 main / lib
        if (pkgFile && pkgFile.main) {
          // 4. 路径兼容 (macOS / windows)
          return formatPath(path.resolve(dir, pkgFile.main))
        }
      }
      return null
    }

    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath)
    }else {
      return _getRootFile(this.targetPath)
    }


  }
}

module.exports = Package;

