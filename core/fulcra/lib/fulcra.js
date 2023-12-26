#! /usr/bin/env node

const importLocal = require("import-local")

if (importLocal(__filename)) {
  require("npmlog").info("cli", "正在使用 fulcra-cli 本地版本")
}else {
  require(".")(process.argv.slice(2))
}
