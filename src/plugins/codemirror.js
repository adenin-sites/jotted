/* coremirror plugin
 */

import * as util from '../util.js'

export default class PluginCodeMirror {
  constructor (jotted, options) {
    var priority = 1
    var i

    this.editor = {}
    this.jotted = jotted

    // custom modemap for codemirror
    var modemap = {
      'html': 'htmlmixed'
    }

    options = util.extend(options, {
      lineNumbers: true
    })

    // check if CodeMirror is loaded
    if (typeof window.CodeMirror === 'undefined') {
      return
    }

    var $editors = jotted.$container.querySelectorAll('.jotted-editor')

    for (i = 0; i < $editors.length; i++) {
      let $textarea = $editors[i].querySelector('textarea')
      let type = util.data($textarea, 'jotted-type')
      let role = util.data($textarea, 'jotted-role')
      let file = util.data($textarea, 'jotted-file')

      this.editor[role] = window.CodeMirror.fromTextArea($textarea, options)
      this.editor[role].setOption('mode', util.getMode(type, file, modemap))

      if (role === 'result') {
        this.editor[role].setOption('readOnly', true)
      }
    }

    jotted.on('change', this.change.bind(this), priority)
  }

  editorChange (params) {
    return () => {
      // trigger a change event
      this.jotted.trigger('change', params)
    }
  }

  change (params, callback) {
    var editor = this.editor[params.role]

    // if the event is not started by the codemirror change.
    // triggered only once per editor,
    // when the textarea is populated/file is loaded.
    if (!params.cmEditor) {
      editor.setValue(params.content)

      // attach the event only after the file is loaded
      params.cmEditor = editor
      editor.on('change', this.editorChange(params))
    }

    // manipulate the params and pass them on
    params.content = editor.getValue()
    callback(null, params)
  }
}
