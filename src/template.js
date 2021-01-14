/* template
 */

export function container (type1, type2, type3 = 'json') {
  return `
    <ul class="jotted-nav">
      <li class="jotted-nav-item jotted-nav-item-input">
        <a href="#" data-jotted-type="${type1}">
          Data
        </a>
      </li>
      <li class="jotted-nav-item jotted-nav-item-template">
        <a href="#" data-jotted-type="${type2}">
          Template
        </a>
      </li>
      <li class="jotted-nav-item jotted-nav-item-result">
        <a href="#" data-jotted-type="result">
          Result (${type2})
        </a>
      </li>
    </ul>   
    <div class="jotted-pane jotted-pane-input" data-jotted-type="${type1}" data-jotted-role="input"></div>
    <div class="jotted-pane jotted-pane-template" data-jotted-type="${type2}" data-jotted-role="template"></div>
    <div class="jotted-pane jotted-pane-result" data-jotted-type="${type3}" data-jotted-role="result"><div class="jotted-editor jotted-editor-${type3}"><textarea data-jotted-type="${type3}" data-jotted-role="result" data-jotted-file=""></textarea><div class="jotted-status"></div></div></div>
  `
}

export function paneActiveClass (role) {
  return `jotted-pane-active-${role}`
}

export function containerClass () {
  return 'jotted'
}

export function hasFileClass (type) {
  return `jotted-has-${type}`
}

export function editorClass (type) {
  return `jotted-editor jotted-editor-${type}`
}

export function editorContent (type, role, fileUrl = '') {
  return `
    <textarea data-jotted-type="${type}" data-jotted-role="${role}" data-jotted-file="${fileUrl}"></textarea>
    <div class="jotted-status"></div>
  `
}

export function statusMessage (err) {
  return `
    <p>${err}</p>
  `
}

export function statusClass (type) {
  return `jotted-status-${type}`
}

export function statusActiveClass (type) {
  return `jotted-status-active-${type}`
}

export function pluginClass (name) {
  return `jotted-plugin-${name}`
}

export function statusLoading (url) {
  return `Loading <strong>${url}</strong>..`
}

export function statusFetchError (url) {
  return `There was an error loading <strong>${url}</strong>.`
}
