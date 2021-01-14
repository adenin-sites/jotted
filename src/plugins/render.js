/* render plugin
 * renders the iframe
 */

import * as util from '../util.js'
import * as ACData from 'adaptivecards-templating'
import * as AdaptiveCards from 'adaptivecards'

export default class PluginRender {
  constructor (jotted, options) {
    options = util.extend(options, {})

    var $resultFrame = jotted.$container.querySelector('.jotted-pane-result textarea')
    var frameContent = ''

    // cached content
    var content = {
      input: '',
      template: ''
    }

    // public
    this.jotted = jotted
    this.content = content
    this.frameContent = frameContent
    this.$resultFrame = $resultFrame
    this.firstRender = true

    // render on each change
    jotted.on('change', this.change.bind(this), 1)
  }

  template (input = '', template = '') {
    // need both input and template to show a result
    if (!input || !template) {
      return ''
    }

    // calculate the output based on result type
    var resultType = util.data(this.$resultFrame, 'jotted-type')

    if (resultType === 'json') {
      // use adaptive cards templating tool
      var cardData, cardTemplate

      try {
        cardData = JSON.parse(input)
      } catch (e) {
        console.log("bad json")
      }

      try {
        cardTemplate = JSON.parse(template)
      } catch (e) {
        console.log("bad json")
      }

      cardTemplate = new ACData.Template(cardTemplate)

      var card = cardTemplate.expand({
        $root: cardData
      })

      return JSON.stringify(card, null, 4);

      // for html Rendering

      // var adaptiveCard = new AdaptiveCards.AdaptiveCard()
      // adaptiveCard.parse(card)

      // var renderedCard = adaptiveCard.render()

      // return adaptiveCard
    } else if (resultType === 'html') {
      // do something
      return ''
    } else {
      return ''
    }
  }

  change (params, callback) {
    // cache manipulated content
    this.content[params.role] = params.content

    // check existing and to-be-rendered content
    var oldFrameContent = this.frameContent
    this.frameContent = this.template(this.content['input'], this.content['template'])

    // don't render if previous and new frame content are the same.
    // mostly for the `play` plugin,
    // so we don't re-render the same content on each change.
    // unless we set forceRender.
    if (params.forceRender !== true && this.frameContent === oldFrameContent) {
      callback(null, params)
      return
    }

    this.$resultFrame.value = this.frameContent
    var editor = this.jotted.plugins.codemirror.editor.result // get the results pane cmeditor object
    editor.setValue(this.frameContent) // set the value in the editor

    this.jotted.trigger('render', this.frameContent)
  }
}
