/**
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /**
  * @fileOverview The ajax-based routing for IOWA subpages.
  */

IOWA.Router = (function() {

  "use strict";

  var MASTHEAD_BG_CLASS_REGEX = /(\s|^)bg-[a-z-]+(\s|$)/;

  var currentPageTransition = null;

  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function playHeroTransition(e, el, rippleColor) {
    var callback = function(el, card) {
      // TODO: There's jank/flicker on bringing the content in,
      // especially in the masthead.
      //IOWA.Elements.Template.mastheadBgClass = IOWA.Elements.Template.pages[pageName].mastheadBgClass;
      IOWA.History.pushState({'path': el.pathname}, '', el.href);
    };
    var card = null;
    var currentEl = el;
    while (!card) {
      currentEl = currentEl.parentNode;
      if (currentEl.classList.contains('card__container')) {
        card = currentEl;
      }
    }
    IOWA.PageAnimation.play(IOWA.PageAnimation.pageCardTakeoverOut(
        card, e.pageX, e.pageY, 300, rippleColor),
        callback.bind(null, el, card));
  }


  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function handleAjaxLink(e, el) {
    e.preventDefault();
    e.stopPropagation();
    // We can get the full absolute path from the <a> element's pathname:
    // http://stackoverflow.com/questions/736513
    var pageName = parsePageNameFromAbsolutePath(el.pathname);
    var pageMeta = IOWA.Elements.Template.pages[pageName];
    IOWA.Elements.Template.nextPage = pageName;
    var callback;
    var currentPage = IOWA.Elements.Template.selectedPage;
    var bgClass = IOWA.Elements.Template.pages[pageName].mastheadBgClass;
    IOWA.Elements.Template.mastheadBgClass = bgClass;
    var isFadeRipple = (
        IOWA.Elements.Template.pages[currentPage].mastheadBgClass ===
        bgClass);
    var rippleColor = isFadeRipple ?
        '#fff': IOWA.Elements.Template.rippleColors[bgClass];

    if (currentPage !== pageName) {

      if (el.hasAttribute('data-anim-ripple')) {

        /*
        // TODO: BUG: interesting, causes Web Animations opacity bug.
        var sequence = new AnimationSequence([
          IOWA.PageAnimation.ripple(
              IOWA.Elements.Ripple, e.pageX, e.pageY, 400, isFadeRipple),
          IOWA.PageAnimation.contentSlideOut()
        ]);
        sequence.callback = callback.bind(this, el);
        */

        currentPageTransition = 'masthead-ripple-transition';

        var rippleAnim = IOWA.PageAnimation.ripple(
              IOWA.Elements.Ripple, e.pageX, e.pageY, 400, rippleColor, isFadeRipple);

        if (IOWA.PageAnimation.canRunSimultanousAnimations) {
          // Run animations simultaneously, then change the page.
          var animation = new AnimationGroup([
            rippleAnim,
            IOWA.PageAnimation.contentSlideOut()
          ]);
          callback = function() {
            IOWA.History.pushState({'path': el.pathname}, '', el.href);
          };
          IOWA.PageAnimation.play(animation, callback.bind(null, el));
        } else {
          // Run animations sequentially, then change the page.
          callback = function(el) {
            IOWA.PageAnimation.play(
                IOWA.PageAnimation.contentSlideOut(), function() {
                  IOWA.History.pushState({'path': el.pathname}, '', el.href);
                });
          };
          IOWA.PageAnimation.play(rippleAnim, callback.bind(null, el));
        }
      } else if (el.hasAttribute('data-anim-card'))  {
        currentPageTransition = 'hero-card-transition';
        playHeroTransition(e, el, rippleColor);
      } else {
        currentPageTransition = '';
        IOWA.History.pushState({'path': el.pathname}, '', el.href);
      }
    }
    // TODO: Update meta.
  }

  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function navigate(e) {
    // Allow user to open new tabs.
    if (e.metaKey || e.ctrlKey) {
      return;
    }
    // Inject page if <a> has the data-ajax-link attribute.
    for (var i = 0; i < e.path.length; ++i) {
      var el = e.path[i];
      if (el.localName === 'a' || el.localName === 'paper-button') {
        if (el.hasAttribute('data-track-link')) {
          IOWA.Analytics.trackEvent('link', 'click', el.getAttribute('data-track-link'));
        }
        if (el.hasAttribute('data-ajax-link')) {
          handleAjaxLink(e, el);
        }
        return; // found first navigation element, quit here.
      }
    }
  }

  /**
   * Renders a new page by fetching partials through ajax.
   * @param {string} pageName The name of the new page.
   * @private
   */
  function renderPage(pageName) {
    var importURL = pageName + '?partial';
    Polymer.import([importURL], function() {
      // Don't proceed if import didn't load correctly.
      var htmlImport = document.querySelector(
          'link[rel="import"][href="' + importURL + '"]');
      if (htmlImport && !htmlImport.import) {
        return;
      }
      // Update content of the page.
      injectPageContent(pageName, htmlImport.import);
    });
  }

  /**
   * Replaces templated content.
   * @private
   */
  function replaceTemplateContent(currentPageTemplates) {
    for (var j = 0; j < currentPageTemplates.length; j++) {
      var template = currentPageTemplates[j];
      var templateToReplace = document.getElementById(
          template.getAttribute('data-ajax-target-template'));
      if (templateToReplace) {
        templateToReplace.setAttribute('ref', template.id);
      }
    }
  }

  /**
   * Updates the page elements during the page transition.
   * @param {string} pageName New page identifier.
   * @param {NodeList} currentPageTemplates Content templates to be rendered.
   * @private
   */
  function updatePageElements(pageName, currentPageTemplates) {
    replaceTemplateContent(currentPageTemplates);
    document.body.id = 'page-' + pageName;
    IOWA.Elements.Template.selectedPage = pageName;
    var pageMeta = IOWA.Elements.Template.pages[pageName];
    document.title = pageMeta.title || 'Google I/O 2015';

    var masthead = IOWA.Elements.Masthead;
    masthead.className = masthead.className.replace(
        MASTHEAD_BG_CLASS_REGEX, ' ' + pageMeta.mastheadBgClass + ' ');

    setTimeout(function() {
      var animationIn = (
          currentPageTransition === 'hero-card-transition') ?
          IOWA.PageAnimation.pageCardTakeoverIn() :
          IOWA.PageAnimation.pageSlideIn();
      console.log(animationIn)
      IOWA.PageAnimation.play(animationIn);
      currentPageTransition = '';
    }, 50); // Wait for the... Good question. Maybe template binding?
    // TODO: BUG: Anyways, something to investigate. Web Animations
    // are not working properly without this delay (Chrome crashes).
  }

  /**
   * Runs animated page transition.
   * @param {string} pageName New page identifier.
   * @private
   */
  function animatePageIn(pageName) {
    // Prequery for content templates.
    var currentPageTemplates = document.querySelectorAll(
        '.js-ajax-' + pageName);

    console.log('currentPageTransition: ', currentPageTransition)
    var masthead = IOWA.Elements.Masthead;
    masthead.className = masthead.className.replace(
        MASTHEAD_BG_CLASS_REGEX,
        ' ' + IOWA.Elements.Template.mastheadBgClass + ' ');

    var bgClass = IOWA.Elements.Template.mastheadBgClass;
    var rippleColor = IOWA.Elements.Template.rippleColors[bgClass];
    IOWA.Elements.Ripple.style.backgroundColor = rippleColor;

    if (!currentPageTransition) {
      var animation = IOWA.PageAnimation.contentSlideOut();
      IOWA.PageAnimation.play(animation, updatePageElements.bind(
          null, pageName, currentPageTemplates));
    } else {
      updatePageElements(pageName, currentPageTemplates);
    }
  }

  /**
   * Parses the page name out of the last entry in absolutePath, split on '/'.
   * Defaults to 'home' if absolutePath ends in '/' or is ''.
   * @private
   */
  function parsePageNameFromAbsolutePath(absolutePath) {
    return absolutePath.split('/').pop() || 'home';
  }

  /**
   * Renders a new page for the current location.
   * @private
   */
  function renderCurrentPage() {
    renderPage(parsePageNameFromAbsolutePath(window.location.pathname));
  }

  /**
   * Injects new page content into existing layout.
   * @param {string} pageName New page identifier.
   * @param {DocumentFragment} importContent HTML containing templates to be
   *    injected.
   * @private
   */
  function injectPageContent(pageName, importContent) {
    // Add freshly fetched templates to DOM, if not yet present.
    var newTemplates = importContent.querySelectorAll('.js-ajax-template');
    for (var i = 0; i < newTemplates.length; i++) {
      var newTemplate = newTemplates[i];
      if (!document.getElementById(newTemplate.id)) {
        document.body.appendChild(newTemplate);
      }
    }
    animatePageIn(pageName);
  }

  /**
   * Initialized ajax-based routing on the page.
   */
  function init() {
    window.addEventListener('popstate', renderCurrentPage);
    document.addEventListener('click', navigate);
  }

  return {
    init: init,
    getPageName: parsePageNameFromAbsolutePath,
    animatePageIn: animatePageIn
  };

})();
