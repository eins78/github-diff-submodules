// ==UserScript==
// @name github-diff-submodules
// @version 1.0.0-alpha.2
// @description script to display submodule diffs in github.com diff views
// @downloadURL http://code.178.is/github-diff-submodules/github-diff-submodules.user.script.js
// @match     *://github.com/*
// ==/UserScript==
/*global $*/
//       ^-  github already has it

// helpers
var trimCommitHash = function (lines) {
  var str = (lines && lines.first && lines.first().text())
  if (typeof str !== 'string' || !str.match(/Subproject\ commit\ /)) return
  return str
    .replace(/^\s*(\+|-)Subproject\ commit\ ([0-9a-f]*)\s*$/, '$1$2')
}

var buildCompareUrl = function (repoUrl, diff) {
  if (!(typeof repoUrl === 'string' && diff && diff.old && diff.new)) return
  var oldHash = diff.old.slice(1) // cuts of '+'
  var newHash = diff.new.slice(1) // cuts of '-'
  return repoUrl
          .split('/')
          .concat(['compare', (oldHash + '...' + newHash)])
          .join('/')
}

var findSubmodules = function ($node) {
  return $node.find('.file').map(function () {
    var $file = $(this)
    var diff = $file
      .filter(function () {
        return $(this).data().position !== 0
      })
      .map(function () {
        var file = $(this)
        return {
          old: trimCommitHash(file
                .find('.blob-code-deletion')),
          new: trimCommitHash(file
                .find('.blob-code-addition'))
        }
      }).filter(function (d) {
        return !(d && d.old && d.new && d.old.length > 1 && d.old.length > 1)
      }).get(0)

    if (!(diff && diff.old && diff.new)) return

    var res = {
      diff: diff,
      path: $.trim($file.find('.user-select-contain').attr('title')),
      node: $file
    }

    return res
  })
}

var findFilenamesInRepoListing = function ($html) {
  return $html
    .find('.file-wrap tr')
    .map(function () {
      return $(this).find('.content span a:first')
    })
}

var getSubmoduleUrl = function ($html, repoPath) {
  var node = findFilenamesInRepoListing($html)
    .filter(function () {
      return ($(this).text() === repoPath)
    })
    .get(0)

  if (node && node.attr) {
    return node.attr('href')
  }
}

// main
function GithubDiffSubmodules ($baseHtml) {
  var subModules = $(findSubmodules($baseHtml))
  var treeUrl = $baseHtml.find('.commit a.btn.right').attr('href')

  if (!(subModules && treeUrl)) return

  // get the super repo filelisting HTML
  $.get(treeUrl, function (data) {
    var $treeHtml = $(data)

    // work with HTML for each submodule
    $(subModules).each(function () {
      var mod = this

      // build and get diff URL
      var repoUrl = getSubmoduleUrl($treeHtml, mod.path)
      var diffUrl = buildCompareUrl(repoUrl, mod.diff)
      if (!(diffUrl)) return

      $.get(diffUrl, function (data) {
        var $html = $(data)
        var $files = $html.find('#files .file')

        // cleanup HTML from answer
        $files.each(function () {
          var $file = $(this)

          $file.attr('id', mod.path + '-' + $file.attr('id'))

          $file.find('.file-header .file-info .user-select-contain')
            .each(function () {
              var $pathname = $(this)
              var path = '/' + $.trim($pathname.text())
              $pathname
                .html($('<strong>').text(mod.path)
                  .add($('<span>').text(path + ' (submodule)')))
                .attr('title', mod.path + path)
            })
        })

        // append them and recurse
        // ? .css({'padding-left': '51px'})
        var $res = $('<div>')
          .data('type', 'submodule-diff').append($files)
        $(mod.node).after($res)

        // // TODO: recurse
        // GithubDiffSubmodules(
        //   $(mod.node.find('[data-type="submodule-diff"]')))
      })
    })
  })
}

// run it
GithubDiffSubmodules(($('body')))
