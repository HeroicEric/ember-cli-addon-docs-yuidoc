'use strict';

const Y = require('yuidocjs');
const nodePath = require('path');

const YUIDoc = Y.YUIDoc;
const DIGESTERS = Y.DocParser.DIGESTERS;
const TAGLIST = Y.DocParser.TAGLIST;

// Aliases
TAGLIST.push('accessor');
TAGLIST.push('action');
TAGLIST.push('computed');
TAGLIST.push('const');
TAGLIST.push('constant');
TAGLIST.push('field');
TAGLIST.push('function');
TAGLIST.push('variable');

// New types
TAGLIST.push('yield');
TAGLIST.push('argument');
TAGLIST.push('export');

const classDigest = DIGESTERS.class;
const paramDigest = DIGESTERS.param;
const propertyDigest = DIGESTERS.property;
const methodDigest = DIGESTERS.method;

DIGESTERS.const = propertyDigest;
DIGESTERS.constant = propertyDigest;
DIGESTERS.field = propertyDigest;
DIGESTERS.variable = propertyDigest;
DIGESTERS.computed = propertyDigest;
DIGESTERS.accessor = propertyDigest;

DIGESTERS.action = methodDigest;
DIGESTERS.argument = methodDigest;
DIGESTERS.function = methodDigest;

DIGESTERS.class = function(tagname, value, target, block) {
  return classDigest.call(this, tagname, `${target.file}~${value}`, target, block);
}

DIGESTERS.yield = function(tagname, value, target, block) {
  target.yields = target.yields || [];
  let fakeTarget = { params: target.yields };

  return paramDigest.call(this, tagname, value, fakeTarget, block);
}

function normalizePaths(document, inputPaths) {
  let regexStrs = inputPaths
    .map((str) => nodePath.join(str, '/'))
    .map((str) => str.replace(/\\/g, '\\\\')) // Ensure Windows-style paths are correctly escaped for the regex
    .map((str) => str.replace(/\./g, '\\.')); // Ensure eventual dots in path are correctly escaped for the regex

  let inputPath = new RegExp(regexStrs.map((str) => `(${str})`).join('|'));

  for (let path in document.files) {
    let normalizedPath = normalizePath(path, inputPath);
    let file = document.files[path];

    file.name = normalizedPath;

    document.files[normalizedPath] = file;
    delete document.files[path];
  }

  for (let id in document.classes) {
    let normalizedId = normalizePath(id, inputPath);
    let klass = document.classes[id];

    klass.name = normalizedId;
    klass.shortname = normalizedId;
    klass.file = normalizePath(klass.file, inputPath);

    document.classes[normalizedId] = klass;
    delete document.classes[id];
  }

  for (let item of document.classitems) {
    item.file = normalizePath(item.file, inputPath);
    item.class = normalizePath(item.class, inputPath);
  }

  for (let warning of document.warnings) {
    warning.line = normalizePath(warning.line, inputPath);
  }
}

function normalizePath(filePath, inputPath) {
  return filePath
    .replace(inputPath, '') // Remove root of path
    .replace(/\\/g, '/') // Convert windows-style slashes
    .replace(/(\/index)?\.js/, ''); // Remove index.js / .js
}

function isAcceptableWarning(warning) {
  return warning.message.match(/^unknown tag:/);
}

module.exports = function generateYUIDoc(inputPaths, project) {
  let json = new YUIDoc({
    quiet: true,
    writeJSON: false,
    paths: inputPaths,
    project: {
      name: project.name()
    }
  }).run();

  normalizePaths(json, inputPaths);

  for (let warning of json.warnings) {
    if (!isAcceptableWarning(warning)) {
      project.ui.writeWarnLine(`${warning.line}: ${warning.message}`);
    }
  }

  return json;
};
