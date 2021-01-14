/* jotted
 */

import 'regenerator-runtime/runtime'
import * as util from './util.js'
import * as template from './template.js'
import * as plugin from './plugin.js'
import PubSoup from './pubsoup.js'

import * as ACData from 'adaptivecards-templating'
import * as AdaptiveCards from 'adaptivecards'

class Jotted {
  constructor ($jottedContainer, opts) {
    if (!$jottedContainer) {
      throw new Error('Can\'t find Jotted container.')
    }

    console.log(new ACData.Template({}))
    console.log(new AdaptiveCards.AdaptiveCard())

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

    // the render plugin is mandatory
    options.plugins.push('render')

    // use the scriptless plugin if runScripts is false
    if (options.runScripts === false) {
      options.plugins.push('scriptless')
    }

    // get array of types from the input options and create one pane for each
    let selectedTypes = []
    options.files.forEach(function (file) {
      selectedTypes.push(file.type)
    })

    // based on input (arr[0]) and template (arr[1]) types, calculate result type
    // json + json = json (or adaptive card)
    // json + liquid = json (or adaptive card)
    // markdown + MSON = html
    this._set('resultType', 'json')

    // cached content for the change method.
    this._set('cachedContent', {
      input: null,
      template: null
    })

    // PubSoup
    var pubsoup = this._set('pubsoup', new PubSoup())

    this._set('trigger', this.trigger())
    this._set('on', function () {
      pubsoup.subscribe.apply(pubsoup, arguments)
    })
    this._set('off', function () {
      pubsoup.unsubscribe.apply(pubsoup, arguments)
    })
    var done = this._set('done', function () {
      pubsoup.done.apply(pubsoup, arguments)
    })

    // after all plugins run
    // show errors
    done('change', this.errors.bind(this))

    // DOM
    var $container = this._set('$container', $jottedContainer)
    $container.innerHTML = template.container(selectedTypes[0], selectedTypes[1], this._get('resultType'))
    util.addClass($container, template.containerClass())

    // default pane
    var paneActive = this._set('paneActive', options.pane)
    util.addClass($container, template.paneActiveClass(paneActive))

    // status nodes
    this._set('$status', {})

    for (let [index, type] of selectedTypes.entries()) {
      this.markup(index, type)
    }

    // textarea change events.
    $container.addEventListener('keyup', util.debounce(this.change.bind(this), options.debounce))
    $container.addEventListener('change', util.debounce(this.change.bind(this), options.debounce))

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
    this.plugins = this._set('plugins', {})
    plugin.init.call(this)

    // load files
    for (let [index, type] of selectedTypes.entries()) {
      this.load(index, type)
    }

    // show all tabs, even if empty
    if (options.showBlank) {
      for (let type of selectedTypes) {
        util.addClass($container, template.hasFileClass(type))
      }
    }

    this.on('change', (params, callback) => {
      this._get('cachedContent')[params.role] = params.content

      callback(null, params)
    }, 10)
  }

  findFile (index, type) {
    var file = {}
    var options = this._get('options')

    for (let fileIndex in options.files) {
      let file = options.files[fileIndex]
      if (file.type === type && parseInt(fileIndex) === index) {
        return file
      }
    }

    return file
  }

  markup (index, type) {
    var $container = this._get('$container')
    var $parent = $container.querySelectorAll(`.jotted-pane[data-jotted-type=${type}]`)[index]
    // create the markup for an editor
    var file = this.findFile(index, type)

    var $editor = document.createElement('div')
    $editor.innerHTML = template.editorContent(type, file.role, file.url)
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

  load (index, type) {
    // create the markup for an editor
    var file = this.findFile(index, type)
    var $textarea = this._get('$container').querySelectorAll(`.jotted-pane[data-jotted-type=${type}]`)[index].querySelector('textarea')

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
    } else {
      // trigger a change event on blank editors,
      // for editor plugins to catch.
      // (eg. the codemirror and ace plugins attach the change event
      // only after the initial change/load event)
      this.setValue($textarea, '')
    }
  }

  setValue ($textarea, val) {
    $textarea.value = val

    // trigger change event, for initial render
    this.change({
      target: $textarea
    })
  }

  getValue (role) {
    return this._get('cachedContent')[role]
  }

  change (e) {
    var role = util.data(e.target, 'jotted-role')
    var type = util.data(e.target, 'jotted-type')

    if (!role) {
      return
    }

    // don't trigger change if the content hasn't changed.
    // eg. when blurring the textarea.
    var cachedContent = this._get('cachedContent')
    if (cachedContent[role] === e.target.value) {
      return
    }

    // cache latest content
    cachedContent[role] = e.target.value

    // trigger the change event
    this.trigger('change', {
      type: type,
      role: role,
      file: util.data(e.target, 'jotted-file'),
      content: cachedContent[role]
    })
  }

  errors (errs, params) {
    this.status('error', errs, params)
  }

  pane (e) {
    if (!util.data(e.target, 'jotted-role')) {
      return
    }

    var $container = this._get('$container')
    var paneActive = this._get('paneActive')
    util.removeClass($container, template.paneActiveClass(paneActive))

    paneActive = this._set('paneActive', util.data(e.target, 'jotted-role'))
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

  // debounced trigger method
  // custom debouncer to use a different timer per type
  trigger () {
    var options = this._get('options')
    var pubsoup = this._get('pubsoup')

    // allow disabling the trigger debouncer.
    // mostly for testing: when trigger events happen rapidly
    // multiple events of the same type would be caught once.
    if (options.debounce === false) {
      return function () {
        pubsoup.publish.apply(pubsoup, arguments)
      }
    }

    // cooldown timer
    var cooldown = {}
    // multiple calls
    var multiple = {}

    return function (topic, { type = 'default' } = {}) {
      if (cooldown[type]) {
        // if we had multiple calls before the cooldown
        multiple[type] = true
      } else {
        // trigger immediately once cooldown is over
        pubsoup.publish.apply(pubsoup, arguments)
      }

      clearTimeout(cooldown[type])

      // set cooldown timer
      cooldown[type] = setTimeout(() => {
        // if we had multiple calls before the cooldown,
        // trigger the function again at the end.
        if (multiple[type]) {
          pubsoup.publish.apply(pubsoup, arguments)
        }

        multiple[type] = null
        cooldown[type] = null
      }, options.debounce)
    }
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
