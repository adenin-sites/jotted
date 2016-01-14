/* jotted
 */

import * as util from './util.js'
import * as template from './template.js'
import * as plugin from './plugin.js'
import script from './script.js'
import PubSoup from './pubsoup.js'

class Jotted {
  constructor ($jottedContainer, opts) {
    if (!$jottedContainer) {
      throw new Error('Can\'t find Jotted container.')
    }

    // private data
    var _private = {}
    this._get = function (key) {
      return _private[key]
    }
    this._set = function (key, value) {
      _private[key] = value
      return _private[key]
    }

    // options
    var options = this._set('options', util.extend(opts, {
      files: [],
      showBlank: false,
      runScripts: true,
      pane: 'result',
      debounce: 250,
      plugins: []
    }))

    // show all tabs, even if empty
    if (options.showBlank) {
      util.addClass($container, template.showBlankClass())
    }

    // PubSoup
    var pubsoup = this._set('pubsoup', new PubSoup())
    // debounced trigger method
    this._set('trigger', util.debounce(pubsoup.publish.bind(pubsoup), options.debounce))
    this._set('on', function () {
      pubsoup.subscribe.apply(pubsoup, arguments)
    })
    this._set('off', function () {
      pubsoup.unsubscribe.apply(pubsoup, arguments)
    })
    var done = this._set('done', function () {
      pubsoup.done.apply(pubsoup, arguments)
    })

    // done change on all subscribers,
    // render the results.
    done('change', this.changeCallback.bind(this))

    // DOM
    var $container = this._set('$container', $jottedContainer)
    $container.innerHTML = template.container()
    util.addClass($container, template.containerClass())

    // default pane
    var paneActive = this._set('paneActive', options.pane)
    util.addClass($container, template.paneActiveClass(paneActive))

    this._set('$status', {})

    for (let type of [ 'html', 'css', 'js' ]) {
      this.markup(type)
    }

    this.createResultFrame()

    // change events
    $container.addEventListener('change', util.debounce(this.change.bind(this), options.debounce))
    $container.addEventListener('keyup', util.debounce(this.change.bind(this), options.debounce))

    // pane change
    $container.addEventListener('click', this.pane.bind(this))

    // expose public properties
    this.$container = this._get('$container')
    this.on = this._get('on')
    this.off = this._get('off')
    this.done = this._get('done')
    this.trigger = this._get('trigger')
    this.paneActive = this._get('paneActive')

    // init plugins
    this._set('plugins', {})
    plugin.init.call(this)

    // load files
    for (let type of [ 'html', 'css', 'js' ]) {
      this.load(type)
    }
  }

  findFile (type) {
    var file = {}
    var options = this._get('options')

    for (let fileIndex in options.files) {
      let file = options.files[fileIndex]
      if (file.type === type) {
        return file
      }
    }

    return file
  }

  markup (type) {
    var $container = this._get('$container')
    var $parent = $container.querySelector(`.jotted-pane-${type}`)
    // create the markup for an editor
    var file = this.findFile(type)

    var $editor = document.createElement('div')
    $editor.innerHTML = template.editorContent(type, file.url)
    $editor.className = template.editorClass(type)

    $parent.appendChild($editor)

    // get the status node
    this._get('$status')[type] = $parent.querySelector('.jotted-status')

    // if we have a file for the current type
    if (typeof file.url !== 'undefined' || typeof file.content !== 'undefined') {
      // add the has-type class to the container
      util.addClass($container, template.hasFileClass(type))
    }
  }

  load (type) {
    // create the markup for an editor
    var file = this.findFile(type)
    var $textarea = this._get('$container').querySelector(`.jotted-pane-${type} textarea`)

    // file as string
    if (typeof file.content !== 'undefined') {
      this.setValue($textarea, file.content)
    } else if (typeof file.url !== 'undefined') {
      // show loading message
      this.status('loading', [ template.statusLoading(file.url) ], {
        type: type,
        file: file
      })

      // file as url
      util.fetch(file.url, (err, res) => {
        if (err) {
          // show load errors
          this.status('error', [ template.statusFetchError(err) ], {
            type: type
          })

          return
        }

        // clear the loading status
        this.clearStatus('loading', {
          type: type
        })

        this.setValue($textarea, res)
      })
    }
  }

  setValue ($textarea, val) {
    $textarea.value = val

    // trigger change event, for initial render
    this.change({
      target: $textarea
    })
  }

  change (e) {
    if (!util.data(e.target, 'jotted-type')) {
      return
    }

    // don't use .trigger,
    // so we don't debounce different change calls (html, css, js)
    // causing only one of them to be inserted.
    // the textarea change event is debounced when attached.
    this._get('pubsoup').publish('change', {
      type: util.data(e.target, 'jotted-type'),
      file: util.data(e.target, 'jotted-file'),
      content: e.target.value
    })
  }

  createResultFrame (css = '') {
    // maintain previous styles
    var $newStyle = document.createElement('style')

    var $styleInject = this._get('$styleInject')
    if ($styleInject) {
      $newStyle.textContent = $styleInject.textContent
    }

    $styleInject = this._set('$styleInject', $newStyle)
    var $paneResult = this._get('$container').querySelector('.jotted-pane-result')

    var $resultFrame = this._get('$resultFrame')
    if ($resultFrame) {
      $paneResult.removeChild($resultFrame)
    }

    $resultFrame = this._set('$resultFrame', document.createElement('iframe'))
    $paneResult.appendChild($resultFrame)

    var $frameDoc = $resultFrame.contentWindow.document
    $frameDoc.open()
    $frameDoc.write(template.frameContent())
    $frameDoc.close()

    $frameDoc.head.appendChild($styleInject)
  }

  changeCallback (errors, params) {
    this.status('error', errors, params)
    var options = this._get('options')

    if (params.type === 'html') {
      // if we have script execution enabled,
      // re-create the iframe,
      // to stop execution of any previously started js,
      // and garbage collect it.
      if (options.runScripts) {
        this.createResultFrame()
      }

      // can't cache the $resultFrame reference, because
      // it's re-created when using runScripts.
      this._get('$resultFrame').contentWindow.document.body.innerHTML = params.content

      if (options.runScripts) {
        script.call(this)
      }

      return
    }

    if (params.type === 'css') {
      this._get('$styleInject').textContent = params.content
      return
    }

    if (params.type === 'js') {
      // catch and show js errors
      try {
        this._get('$resultFrame').contentWindow.eval(params.content)
      } catch (err) {
        // only show eval errors if we don't have other errors from plugins.
        // useful for preprocessor error reporting (eg. babel, coffeescript).
        if (!errors.length) {
          this.status('error', [ err.message ], {
            type: 'js'
          })
        }
      }

      return
    }
  }

  pane (e) {
    if (!util.data(e.target, 'jotted-type')) {
      return
    }

    var $container = this._get('$container')
    var paneActive = this._get('paneActive')
    util.removeClass($container, template.paneActiveClass(paneActive))

    paneActive = this._set('paneActive', util.data(e.target, 'jotted-type'))
    util.addClass($container, template.paneActiveClass(paneActive))

    e.preventDefault()
  }

  status (statusType = 'error', messages = [], params = {}) {
    if (!messages.length) {
      return this.clearStatus(statusType, params)
    }

    var $status = this._get('$status')

    // add error/loading class to status
    util.addClass($status[params.type], template.statusClass(statusType))

    util.addClass(this._get('$container'), template.statusActiveClass(params.type))

    var markup = ''
    messages.forEach(function (err) {
      markup += template.statusMessage(err)
    })

    $status[params.type].innerHTML = markup
  }

  clearStatus (statusType, params) {
    var $status = this._get('$status')

    util.removeClass($status[params.type], template.statusClass(statusType))
    util.removeClass(this._get('$container'), template.statusActiveClass(params.type))
    $status[params.type].innerHTML = ''
  }
}

// register plugins
Jotted.plugin = function () {
  return plugin.register.apply(this, arguments)
}

// register bundled plugins
import BundlePlugins from './bundle-plugins.js'
BundlePlugins(Jotted)

export default Jotted