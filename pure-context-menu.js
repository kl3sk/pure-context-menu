/**
 * @typedef Config
 * @property {String} contextMenuClass Class applied to the context menu
 * @property {String} dropdownClass Class applied to the dropdown menu
 * @property {String} dividerClass Class applied to the divider item
 * @property {String} itemClass Class applied to the menu item
 * @property {Number} zIndex z-index assigned to the menu
 * @property {Boolean} preventCloseOnClick Global behaviour for items when clicking
 * @property {Function} show Whether to show menu based on event
 */
let baseOptions = {
  contextMenuClass: "pure-context-menu",
  dropdownClass: "dropdown-menu",
  dividerClass: "dropdown-divider",
  itemClass: "dropdown-item",
  zIndex: "9999",
  preventCloseOnClick: false,
  show: (event) => true,
};

/**
 * @typedef Item
 * @property {String} label
 * @property {Boolean} [html]
 * @property {Boolean} [preventCloseOnClick]
 * @property {Function} [callback]
 */

/**
 * Easily manage context menus
 * Works out of the box with bootstrap css
 */
class PureContextMenu {
  _el;
  _items;
  _options;
  _currentEvent;

  /**
   * @param {HTMLElement} el
   * @param {object} items
   * @param {object} opts
   */
  constructor(el, items, opts) {
    /**
     * @type {Item[]}
     */
    this._items = items;

    /**
     * @type {HTMLElement}
     */
    this._el = el;

    /**
     * @type {Config}
     */
    this._options = Object.assign(baseOptions, opts);

    // bind the menu on context menu
    // add also long press support, this helps with ios browsers
    // include https://cdn.jsdelivr.net/npm/long-press-event@2.4/dist/long-press-event.min.js in your pages
    ["contextmenu", "long-press"].forEach((type) => {
      el.addEventListener(type, this);
    });

    // close if the user clicks outside of the menu
    document.addEventListener("click", this);
  }

  /**
   * @link https://gist.github.com/WebReflection/ec9f6687842aa385477c4afca625bbf4#handling-events
   * @param {Event} event
   */
  handleEvent(event) {
    const type = event.type === "long-press" ? "contextmenu" : event.type;
    this[`on${type}`](event);
  }

  /**
   * @param {Config} opts
   */
  static updateDefaultOptions(opts) {
    baseOptions = Object.assign(baseOptions, opts);
  }

  /**
   * @returns {Config}
   */
  static getDefaultOptions() {
    return baseOptions;
  }

  /**
   * Create the menu
   * @returns {HTMLElement}
   */
  _buildContextMenu = () => {
    const contextMenu = document.createElement("ul");
    contextMenu.style.minWidth = "120px";
    contextMenu.style.maxWidth = "240px";
    contextMenu.style.display = "block";
    contextMenu.classList.add(this._options.contextMenuClass);
    contextMenu.classList.add(this._options.dropdownClass);

    for (const item of this._items) {
      const child = document.createElement("li");
      if (item === "-") {
        const divider = document.createElement("hr");
        divider.classList.add(this._options.dividerClass);
        child.appendChild(divider);
      } else {
        const link = document.createElement("a");
        if (item.html) {
          link.innerHTML = item.label;
        } else {
          link.innerText = item.label;
        }
        link.style.cursor = "pointer";
        link.style.whiteSpace = "normal";
        link.classList.add(this._options.itemClass);
        child.appendChild(link);
      }

      contextMenu.appendChild(child);
    }
    return contextMenu;
  };

  /**
   * Normalize the context menu position so that it won't get out of bounds
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {HTMLElement} contextMenu
   */
  _normalizePosition = (mouseX, mouseY, contextMenu) => {
    const scope = this._el;
    const contextStyles = window.getComputedStyle(contextMenu);
    // clientWidth exclude borders and we add 1px for good measure
    const offset = parseInt(contextStyles.borderWidth) + 1;

    // compute what is the mouse position relative to the container element (scope)
    const bounds = scope.getBoundingClientRect();

    let scopeX = mouseX;
    let scopeY = mouseY;

    if (!["BODY", "HTML"].includes(scope.tagName)) {
      scopeX -= bounds.left;
      scopeY -= bounds.top;
    }

    const menuWidth = parseInt(contextStyles.width);

    // check if the element will go out of bounds
    const outOfBoundsOnX = scopeX + menuWidth > scope.clientWidth;
    const outOfBoundsOnY = scopeY + contextMenu.clientHeight > scope.clientHeight;

    let normalizedX = mouseX;
    let normalizedY = mouseY;

    // normalize on X
    if (outOfBoundsOnX) {
      normalizedX = scope.clientWidth - menuWidth - offset;
      if (!["BODY", "HTML"].includes(scope.tagName)) {
        normalizedX += bounds.left;
      }
    }

    // normalize on Y
    if (outOfBoundsOnY) {
      normalizedY = scope.clientHeight - contextMenu.clientHeight - offset;
      if (!["BODY", "HTML"].includes(scope.tagName)) {
        normalizedY += bounds.top;
      }
    }

    return { normalizedX, normalizedY };
  };

  _removeExistingContextMenu = () => {
    document.querySelector(`.${this._options.contextMenuClass}`)?.remove();
  };

  _bindCallbacks = (contextMenu) => {
    this._items.forEach((menuItem, index) => {
      if (menuItem === "-") {
        return;
      }

      const htmlEl = contextMenu.children[index];

      // We also need to listen on touchstart to avoid "double tap" issue
      htmlEl.ontouchstart = htmlEl.onclick = () => {
        if (menuItem.callback) {
          menuItem.callback(this._currentEvent);
        }

        // do not close the menu if set
        const preventCloseOnClick = menuItem.preventCloseOnClick ?? this._options.preventCloseOnClick ?? false;
        if (!preventCloseOnClick) {
          this._removeExistingContextMenu();
        }
      };
    });
  };

  /**
   * @param {MouseEvent} event
   */
  oncontextmenu = (event) => {
    if (!this._options.show(event)) {
      return;
    }

    // Block regular context menu if our menu is shown
    event.preventDefault();
    event.stopPropagation();

    // Don't do anything if clicked on the same menu
    if (this._isCurrentTarget(event)) {
      return;
    }

    // Store event for callbakcs
    this._currentEvent = event;

    // the current context menu should disappear when a new one is displayed
    this._removeExistingContextMenu();

    // build and show on ui
    const contextMenu = this._buildContextMenu();
    document.querySelector("body").append(contextMenu);

    // set the position already so that width can be computed
    contextMenu.style.position = "fixed";
    contextMenu.style.zIndex = this._options.zIndex;

    // adjust the position according to mouse position
    const mouseX = event.detail.clientX ?? event.clientX;
    const mouseY = event.detail.clientY ?? event.clientY;
    const { normalizedX, normalizedY } = this._normalizePosition(mouseX, mouseY, contextMenu);
    contextMenu.style.top = `${normalizedY}px`;
    contextMenu.style.left = `${normalizedX}px`;

    // bind the callbacks on each option
    this._bindCallbacks(contextMenu);
  };

  _isCurrentTarget(event) {
    const clickedTarget = event.target;
    if (clickedTarget.closest(`.${this._options.contextMenuClass}`)) {
      return true;
    }
    return false;
  }

  /**
   * Used to determine if the user has clicked outside of the context menu and if so, close it
   * @param {MouseEvent} event
   */
  onclick = (event) => {
    if (this._isCurrentTarget()) {
      return;
    }
    this._removeExistingContextMenu();
  };

  /**
   * Remove all the event listeners that were registered for this feature
   */
  off() {
    this._removeExistingContextMenu();
    document.removeEventListener("click", this);
    ["contextmenu", "long-press"].forEach((type) => {
      this._el.removeEventListener(type, this);
    });
  }
}

export default PureContextMenu;
