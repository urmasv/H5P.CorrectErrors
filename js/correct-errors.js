(function (H5P) {
  'use strict';

  var DEFAULT_L10N = {
    checkAnswer: 'Check',
    tryAgain: 'Try again',
    correct: 'Correct',
    incorrect: 'Incorrect',
    correctFeedback: 'Everything is correct!',
    yourResult: 'Result: @score / @max',
    correctText: 'Correct: @count',
    wrongText: 'Wrong: @count',
    missingCountText: 'Missing: @count',
    emptyContent: 'The author has not added any text.',
    solutionPrefix: 'Correct answer:',
    dragHint: '',
    selectPlaceholder: 'choose...',
    emptyGap: 'empty',
    gapLabel: 'Answer field @num',
    editableLabel: 'Editable answer text',
    extraText: 'Extra text',
    missingText: 'Missing text',
  };

  var DEFAULTS = {
    taskDescription: 'Paranda tekst. Vajaduse korral asenda, kustuta või lisa teksti.',
    correctText: 'Hello, [world]! Can you correct the [text]?',
    wrongText: '',
    specialCharacters: '',
    mode: 'freeedit',
    scoreMode: 'fulltext',
    extraOptions: '',
    delimiters: '[]',
    optionSeparator: '|',
    dropdownOptionsMode: 'partial',
    dragOptionsPosition: 'bottom',
    gapInputWidthMode: 'byAnswer',
    behaviour: {
      delimiters: '[]',
      optionSeparator: '|',
      caseSensitive: true,
      shuffleOptions: true,
      dropdownOptionsMode: 'partial',
      dragOptionsPosition: 'bottom',
      gapInputWidthMode: 'byAnswer',
      showEvaluatedParts: false,
      enableRetry: true,
      showCorrectTextAfterCheck: true
    },
    l10n: DEFAULT_L10N
  };

  function CorrectErrors(params, contentId, extras) {
    var self = this;

    H5P.EventDispatcher.call(self);

    var rawParams = params || {};
    var rawBehaviour = rawParams.behaviour || {};

    self.params = mergeDeep({}, DEFAULTS, rawParams);
    self.params.behaviour = mergeDeep({}, DEFAULTS.behaviour, rawBehaviour);
    self.params.behaviour.caseSensitive = true;

    // Some settings were moved between the main semantics level and behaviour
    // during development. Only copy a main-level value into behaviour when it
    // actually exists in the saved content. Never copy DEFAULTS.* back into
    // behaviour, because that would overwrite the author's saved behaviour
    // value, e.g. selected markers `{}`, `##`, `@@` or `*` with the default `[]`.
    if (Object.prototype.hasOwnProperty.call(rawParams, 'delimiters')) {
      self.params.behaviour.delimiters = rawParams.delimiters;
    }
    else {
      self.params.delimiters = self.params.behaviour.delimiters;
    }

    if (Object.prototype.hasOwnProperty.call(rawParams, 'optionSeparator')) {
      self.params.behaviour.optionSeparator = rawParams.optionSeparator;
    }
    else {
      self.params.optionSeparator = self.params.behaviour.optionSeparator;
    }

    if (Object.prototype.hasOwnProperty.call(rawParams, 'dropdownOptionsMode')) {
      self.params.behaviour.dropdownOptionsMode = rawParams.dropdownOptionsMode;
    }
    else {
      self.params.dropdownOptionsMode = self.params.behaviour.dropdownOptionsMode;
    }

    if (Object.prototype.hasOwnProperty.call(rawParams, 'dragOptionsPosition')) {
      self.params.behaviour.dragOptionsPosition = rawParams.dragOptionsPosition;
    }
    else {
      self.params.dragOptionsPosition = self.params.behaviour.dragOptionsPosition;
    }

    if (Object.prototype.hasOwnProperty.call(rawParams, 'gapInputWidthMode')) {
      self.params.behaviour.gapInputWidthMode = rawParams.gapInputWidthMode;
    }
    else {
      self.params.gapInputWidthMode = self.params.behaviour.gapInputWidthMode;
    }

    if (Object.prototype.hasOwnProperty.call(rawParams, 'showEvaluatedParts')) {
      self.params.behaviour.showEvaluatedParts = !!rawParams.showEvaluatedParts;
    }
    // This library now contains only the direct text correction task.
    // Gap-filling modes have been split into H5P.Gapfill.
    self.params.mode = 'freeedit';

    self.params.l10n = normaliseL10n(self.params.l10n || {});
    self.contentId = contentId;
    self.extras = extras || {};
    self.container = null;
    self.wrapper = null;
    self.correct = null;
    self.wrong = null;
    self.checked = false;
    self.answerGiven = false;
    self.score = 0;
    self.maxScore = 0;
    self.lastResult = null;
    self.selectedDragText = null;
    self.solutionElement = null;
    self.activeEditableElement = null;
  }

  CorrectErrors.prototype = Object.create(H5P.EventDispatcher.prototype);
  CorrectErrors.prototype.constructor = CorrectErrors;

  CorrectErrors.prototype.attach = function ($container) {
    var self = this;
    var container = getDomElement($container);

    self.container = container;
    self.correct = parseMarkedText(self, self.params.correctText || '');
    self.wrong = parseMarkedText(self, self.params.wrongText || '');
    self.checked = false;
    self.answerGiven = false;
    self.score = 0;
    self.lastResult = null;
    self.selectedDragText = null;
    self.solutionElement = null;
    self.activeEditableElement = null;

    container.innerHTML = '';
    container.className += ' h5p-correct-errors-container';

    self.wrapper = document.createElement('div');
    self.wrapper.className = 'h5p-correct-errors h5p-correct-errors-mode-' + self.params.mode;
    container.appendChild(self.wrapper);

    render(self);
    self.triggerResize();
  };

  CorrectErrors.prototype.getAnswerGiven = function () {
    return !!this.answerGiven;
  };

  CorrectErrors.prototype.getScore = function () {
    return this.score || 0;
  };

  CorrectErrors.prototype.getMaxScore = function () {
    return this.maxScore || calculateMaxScore(this);
  };

  CorrectErrors.prototype.resetTask = function () {
    this.checked = false;
    this.answerGiven = false;
    this.score = 0;
    this.lastResult = null;
    this.selectedDragText = null;
    this.solutionElement = null;
    render(this);
    this.triggerResize();
  };

  CorrectErrors.prototype.showSolutions = function () {
    var result;

    if (!this.wrapper) {
      return;
    }

    result = evaluate(this, false);
    showCorrectAnswersInTask(this);
    showSolution(this);
    lockResponseArea(this, true);
    updateControls(this);
    this.score = result.maxScore;
    this.lastResult = {
      score: result.maxScore,
      maxScore: result.maxScore,
      success: true
    };
    this.triggerResize();
  };

  CorrectErrors.prototype.getXAPIData = function () {
    var event = this.getXAPIAnswerEvent();
    return event ? { statement: event.data.statement } : null;
  };

  CorrectErrors.prototype.getXAPIAnswerEvent = function (result) {
    var event;
    var statementResult;

    result = result || this.lastResult || evaluate(this, false);
    event = this.createXAPIEvent('answered');

    if (!event || !event.data || !event.data.statement) {
      return null;
    }

    if (typeof event.setScoredResult === 'function') {
      event.setScoredResult(result.score, result.maxScore, this, true, result.success);
    }

    statementResult = event.data.statement.result = event.data.statement.result || {};
    statementResult.response = this.getXAPIResponse();
    statementResult.completion = true;
    statementResult.success = !!result.success;
    statementResult.score = statementResult.score || {};
    statementResult.score.raw = result.score;
    statementResult.score.max = result.maxScore;
    statementResult.score.min = 0;
    statementResult.score.scaled = result.maxScore > 0 ? result.score / result.maxScore : 0;

    return event;
  };

  CorrectErrors.prototype.createXAPIEvent = function (verb) {
    var event;
    var definition;

    if (typeof this.createXAPIEventTemplate === 'function') {
      event = this.createXAPIEventTemplate(verb);
    }
    else if (H5P.XAPIEvent) {
      event = new H5P.XAPIEvent(verb);
    }

    if (!event || !event.data || !event.data.statement) {
      return null;
    }

    if (typeof event.getVerifiedStatementValue === 'function') {
      definition = event.getVerifiedStatementValue(['object', 'definition']);
    }
    else {
      event.data.statement.object = event.data.statement.object || {};
      definition = event.data.statement.object.definition = event.data.statement.object.definition || {};
    }

    extendObject(definition, this.getxAPIDefinition());

    return event;
  };

  CorrectErrors.prototype.getxAPIDefinition = function () {
    var languageTag = this.getLanguageTag();
    var definition = {
      name: {},
      description: {},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: 'fill-in',
      correctResponsesPattern: this.getXAPICorrectResponsesPattern()
    };

    definition.name[languageTag] = this.getTitle();
    definition.name['en-US'] = definition.name[languageTag];
    definition.description[languageTag] = this.getDescription();
    definition.description['en-US'] = definition.description[languageTag];

    return definition;
  };

  CorrectErrors.prototype.getXAPICorrectResponsesPattern = function () {
    return [getDisplayCorrectText(this)];
  };

  CorrectErrors.prototype.getXAPIResponse = function () {
    if (!this.wrapper) {
      return '';
    }
    if (this.params.mode === 'freeedit') {
      return stripAuthorMarkers(this, getFreeEditResponse(this));
    }
    return getGapResponses(this).join('[,]');
  };

  CorrectErrors.prototype.getTitle = function () {
    var metadata = this.extras && this.extras.metadata;
    var title = metadata && metadata.title ? metadata.title : 'Paranda tekst';

    return H5P.createTitle ? H5P.createTitle(title) : title;
  };

  CorrectErrors.prototype.getDescription = function () {
    var description = stripHtml(this.params.taskDescription || '').replace(/\s+/g, ' ').trim();

    return description || this.getTitle();
  };

  CorrectErrors.prototype.getLanguageTag = function () {
    var metadata = this.extras && this.extras.metadata;
    var language = (metadata && (metadata.defaultLanguage || metadata.language)) || 'et';
    var parts = String(language).replace('_', '-').split('-');

    if (!parts[0]) {
      return 'et';
    }

    parts[0] = parts[0].toLowerCase();
    if (parts[1]) {
      parts[1] = parts[1].toUpperCase();
    }

    return parts.length === 1 ? parts[0] : parts.join('-');
  };

  CorrectErrors.prototype.emitXAPIResult = function (result) {
    var event;

    try {
      event = this.getXAPIAnswerEvent(result);
      if (event) {
        this.trigger(event);
      }
    }
    catch (e) {
      // Older H5P integrations may not expose all xAPI helpers for custom libraries.
    }
  };

  CorrectErrors.prototype.triggerAnswered = function (score, maxScore) {
    this.emitXAPIResult({
      score: score,
      maxScore: maxScore,
      wrong: Math.max(0, maxScore - score),
      success: score === maxScore
    });
  };

  CorrectErrors.prototype.triggerResize = function () {
    if (H5P && typeof H5P.trigger === 'function') {
      H5P.trigger(this, 'resize');
    }
  };

  function render(self) {
    self.wrapper.innerHTML = '';
    self.wrapper.className = 'h5p-correct-errors h5p-correct-errors-mode-' + self.params.mode;

    if (isEmptyText(self.params.correctText)) {
      renderEmpty(self);
      return;
    }

    renderTaskDescription(self);
    renderSpecialCharacterButtons(self);
    renderTask(self);
    renderControls(self);
    renderFeedbackElement(self);
    updateControls(self);
  }

  function renderEmpty(self) {
    var empty = document.createElement('div');
    empty.className = 'h5p-correct-errors-empty';
    empty.textContent = self.params.l10n.emptyContent;
    self.wrapper.appendChild(empty);
  }

  function renderTaskDescription(self) {
    var task;

    if (!self.params.taskDescription) {
      return;
    }

    task = document.createElement('div');
    task.className = 'h5p-correct-errors-task';
    task.innerHTML = self.params.taskDescription;
    self.wrapper.appendChild(task);
  }

  function renderSpecialCharacterButtons(self) {
    var chars = getSpecialCharacters(self);
    var bar;

    if (!chars.length) {
      return;
    }

    bar = document.createElement('div');
    bar.className = 'h5p-correct-errors-special-characters';

    chars.forEach(function (character) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'h5p-correct-errors-special-key';
      button.textContent = character;
      button.setAttribute('aria-label', character);
      button.addEventListener('mousedown', function (event) {
        // Keep the caret inside the editable text while pressing the helper key.
        event.preventDefault();
      });
      button.addEventListener('click', function () {
        if (!self.checked) {
          insertSpecialCharacter(self, character);
        }
      });
      bar.appendChild(button);
    });

    self.wrapper.appendChild(bar);
  }

  function getSpecialCharacters(self) {
    var raw = decodeHtmlEntities(String(self.params.specialCharacters || ''));
    var hasSeparators = /[\s,;]+/.test(raw);
    var parts = hasSeparators ? raw.split(/[\s,;]+/) : toChars(raw);
    var chars = [];

    parts.forEach(function (part) {
      var value = trim(part);
      if (value !== '' && chars.indexOf(value) === -1) {
        chars.push(value);
      }
    });

    return chars;
  }

  function registerEditableElement(self, element) {
    ['focus', 'click', 'keyup', 'mouseup'].forEach(function (type) {
      element.addEventListener(type, function () {
        if (!self.checked) {
          self.activeEditableElement = element;
        }
      });
    });
  }

  function insertSpecialCharacter(self, character) {
    var editable = getActiveEditableElement(self);

    if (!editable) {
      return;
    }

    insertTextAtCaret(editable, character);
    self.activeEditableElement = editable;
    self.answerGiven = trim(getFreeEditResponse(self)) !== '';
    updateControls(self);
  }

  function getActiveEditableElement(self) {
    var element = self.activeEditableElement;

    if (element && self.wrapper && self.wrapper.contains(element) && element.isContentEditable) {
      return element;
    }

    return self.wrapper ? self.wrapper.querySelector('.h5p-correct-errors-free-edit [contenteditable="true"], .h5p-correct-errors-free-edit[contenteditable="true"]') : null;
  }

  function insertTextAtCaret(element, text) {
    var selection;
    var range;
    var textNode;

    if (!element) {
      return;
    }

    element.focus();

    if (typeof window !== 'undefined' && window.getSelection) {
      selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        if (!rangeIsInside(range, element)) {
          range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
        }
      }
      else {
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
      }

      textNode = document.createTextNode(text);
      range.deleteContents();
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    else if (typeof document !== 'undefined' && document.selection) {
      document.selection.createRange().text = text;
    }
    else {
      element.textContent += text;
    }

    dispatchInputEvent(element);
  }

  function rangeIsInside(range, element) {
    var node = range.commonAncestorContainer;
    if (node && node.nodeType === 3) {
      node = node.parentNode;
    }
    return node === element || (element.contains && element.contains(node));
  }

  function dispatchInputEvent(element) {
    var event;
    if (typeof Event === 'function') {
      event = new Event('input', {bubbles: true});
    }
    else {
      event = document.createEvent('Event');
      event.initEvent('input', true, true);
    }
    element.dispatchEvent(event);
  }

  function renderTask(self) {
    var task = document.createElement('div');
    task.className = 'h5p-correct-errors-answer-area';

    if (self.params.mode === 'freeedit') {
      renderFreeEdit(self, task);
    }
    else {
      renderGapTask(self, task);
    }

    self.wrapper.appendChild(task);
  }

  function renderFreeEdit(self, task) {
    var hasWrongText = self.params.wrongText && trim(self.params.wrongText) !== '';
    var showEvaluatedParts = shouldShowEvaluatedParts(self);

    if ((isMarkedScoreMode(self) || showEvaluatedParts) && self.correct.gaps.length > 0 && (!hasWrongText || hasSameMarkedStructure(self.correct, self.wrong))) {
      renderStructuredFreeEdit(self, task);
      return;
    }

    var editable = document.createElement('div');
    editable.className = 'h5p-correct-errors-free-edit';
    if (showEvaluatedParts && !self.correct.gaps.length) {
      editable.className += ' h5p-correct-errors-show-evaluated-whole';
    }
    editable.contentEditable = 'true';
    editable.tabIndex = 0;
    editable.setAttribute('role', 'textbox');
    editable.setAttribute('aria-multiline', 'true');
    editable.setAttribute('aria-label', self.params.l10n.editableLabel);
    editable.textContent = stripAuthorMarkers(self, getFreeEditStartText(self));
    registerEditableElement(self, editable);
    editable.addEventListener('input', function () {
      self.activeEditableElement = editable;
      self.answerGiven = trim(getFreeEditResponse(self)) !== '';
      updateControls(self);
    });
    task.appendChild(editable);
    renderSolutionElement(self, task);
  }

  function renderStructuredFreeEdit(self, task) {
    var editable = document.createElement('div');
    var sameStructure = hasSameMarkedStructure(self.correct, self.wrong);
    var gapIndex = 0;
    var i;

    editable.className = 'h5p-correct-errors-free-edit h5p-correct-errors-free-edit-structured';
    if (shouldShowEvaluatedParts(self)) {
      editable.className += ' h5p-correct-errors-show-evaluated-parts';
    }
    editable.setAttribute('role', 'group');
    editable.setAttribute('aria-label', self.params.l10n.editableLabel);

    for (i = 0; i < self.correct.segments.length; i++) {
      var segment = self.correct.segments[i];
      var wrongSegment = sameStructure ? self.wrong.segments[i] : null;
      var span = document.createElement('span');

      span.contentEditable = 'true';
      span.tabIndex = 0;
      span.className = 'h5p-correct-errors-edit-segment';
      span.setAttribute('role', 'textbox');

      if (segment.type === 'text') {
        span.className += ' h5p-correct-errors-edit-static';
        span.textContent = wrongSegment && wrongSegment.type === 'text' ? wrongSegment.text : segment.text;
      }
      else {
        span.className += ' h5p-correct-errors-edit-marked';
        span.setAttribute('data-index', String(gapIndex));
        span.textContent = wrongSegment && wrongSegment.type === 'gap' ? wrongSegment.raw : '';
        gapIndex++;
      }

      registerEditableElement(self, span);
      span.addEventListener('input', function () {
        self.activeEditableElement = span;
        self.answerGiven = trim(getFreeEditResponse(self)) !== '';
        updateControls(self);
      });
      editable.appendChild(span);
    }

    task.appendChild(editable);
    renderSolutionElement(self, task);
  }

  function renderGapTask(self, task) {
    var line = document.createElement('div');
    var distractors = getExtraOptions(self).concat(getWrongMarkedOptions(self));
    var dragArea = null;
    var gapIndex = 0;
    var i;

    line.className = 'h5p-correct-errors-gap-line';
    line.setAttribute('dir', 'auto');

    if (self.params.mode === 'dragdrop') {
      dragArea = renderDragOptions(self, distractors);
      if (getDragOptionsPosition(self) === 'top') {
        task.appendChild(dragArea);
      }
    }

    for (i = 0; i < self.correct.segments.length; i++) {
      var segment = self.correct.segments[i];
      if (segment.type === 'text') {
        appendText(line, segment.text, 'span', 'h5p-correct-errors-text-part');
      }
      else {
        renderGapElement(self, line, segment, gapIndex, distractors);
        gapIndex++;
      }
    }

    task.appendChild(line);

    if (self.params.mode === 'dragdrop' && getDragOptionsPosition(self) !== 'top' && dragArea) {
      task.appendChild(dragArea);
    }

    renderSolutionElement(self, task);
  }

  function renderGapElement(self, line, segment, gapIndex, distractors) {
    var wrap = document.createElement('span');
    wrap.className = 'h5p-correct-errors-gap-wrap';
    wrap.setAttribute('data-index', String(gapIndex));

    if (self.params.mode === 'input') {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'h5p-correct-errors-gap h5p-correct-errors-gap-input';
      input.setAttribute('data-index', String(gapIndex));
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('aria-label', getGapLabel(self, gapIndex));
      setInputGapWidth(self, input, segment);
      input.addEventListener('input', function () {
        self.answerGiven = hasAnyGapAnswer(self);
        updateControls(self);
      });
      wrap.appendChild(input);
    }
    else if (self.params.mode === 'dropdown') {
      var select = document.createElement('select');
      var options = getDropdownOptions(self, segment, distractors);
      var opt;

      select.className = 'h5p-correct-errors-gap h5p-correct-errors-gap-select';
      select.setAttribute('data-index', String(gapIndex));
      select.setAttribute('aria-label', getGapLabel(self, gapIndex));

      opt = document.createElement('option');
      opt.value = '';
      opt.className = 'h5p-correct-errors-select-placeholder-option';
      opt.textContent = self.params.l10n.selectPlaceholder;
      select.appendChild(opt);
      updateSelectPlaceholderClass(select);

      options.forEach(function (option) {
        var item = document.createElement('option');
        item.value = option;
        item.textContent = option === '' ? self.params.l10n.emptyGap : option;
        select.appendChild(item);
      });

      select.addEventListener('change', function () {
        updateSelectPlaceholderClass(select);
        self.answerGiven = hasAnyGapAnswer(self);
        updateControls(self);
      });
      wrap.appendChild(select);
    }
    else if (self.params.mode === 'dragdrop') {
      var dropzone = document.createElement('span');
      dropzone.className = 'h5p-correct-errors-gap h5p-correct-errors-dropzone';
      dropzone.tabIndex = 0;
      dropzone.setAttribute('role', 'button');
      dropzone.setAttribute('data-index', String(gapIndex));
      dropzone.setAttribute('aria-label', getGapLabel(self, gapIndex));
      setDropzoneGapWidth(self, dropzone, segment);

      dropzone.addEventListener('dragover', function (event) {
        if (self.checked) {
          return;
        }
        event.preventDefault();
        dropzone.classList.add('h5p-correct-errors-drop-hover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('h5p-correct-errors-drop-hover');
      });
      dropzone.addEventListener('drop', function (event) {
        if (self.checked) {
          return;
        }
        event.preventDefault();
        dropzone.classList.remove('h5p-correct-errors-drop-hover');
        setDropzoneValue(self, dropzone, event.dataTransfer.getData('text/plain'));
      });
      dropzone.addEventListener('click', function () {
        if (!self.checked && self.selectedDragText !== null) {
          setDropzoneValue(self, dropzone, self.selectedDragText);
        }
      });
      dropzone.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && !self.checked && self.selectedDragText !== null) {
          setDropzoneValue(self, dropzone, self.selectedDragText);
          event.preventDefault();
        }
      });
      dropzone.addEventListener('dblclick', function () {
        if (!self.checked) {
          setDropzoneValue(self, dropzone, '');
        }
      });
      wrap.appendChild(dropzone);
    }

    line.appendChild(wrap);
  }

  function renderDragOptions(self, distractors) {
    var pool = [];
    var dragArea = document.createElement('div');
    var tokens = document.createElement('div');

    self.correct.gaps.forEach(function (gap) {
      (gap.answers || []).forEach(function (answer) {
        if (answer !== '') {
          pool.push(answer);
        }
      });
    });
    pool = uniqueOptions(self, pool.concat(cleanVisibleOptions(distractors)));
    if (self.params.behaviour.shuffleOptions) {
      pool = shuffle(pool);
    }

    dragArea.className = 'h5p-correct-errors-drag-area h5p-correct-errors-drag-area-' + getDragOptionsPosition(self);
    tokens.className = 'h5p-correct-errors-drag-tokens';

    pool.forEach(function (answer) {
      var token = document.createElement('button');
      token.type = 'button';
      token.className = 'h5p-correct-errors-token';
      token.draggable = true;
      token.textContent = answer;
      token.addEventListener('dragstart', function (event) {
        if (self.checked) {
          event.preventDefault();
          return;
        }
        self.selectedDragText = answer;
        event.dataTransfer.setData('text/plain', answer);
      });
      token.addEventListener('click', function () {
        if (self.checked) {
          return;
        }
        self.selectedDragText = answer;
        Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-correct-errors-token'), function (button) {
          button.classList.remove('h5p-correct-errors-token-selected');
        });
        token.classList.add('h5p-correct-errors-token-selected');
      });
      tokens.appendChild(token);
    });

    dragArea.appendChild(tokens);
    return dragArea;
  }

  function renderControls(self) {
    var controls = document.createElement('div');
    var check = document.createElement('button');

    controls.className = 'h5p-correct-errors-controls';

    check.type = 'button';
    check.className = 'h5p-correct-errors-control h5p-correct-errors-check';
    check.textContent = self.params.l10n.checkAnswer;
    check.addEventListener('click', function () {
      if (!hasGivenAnswer(self)) {
        self.answerGiven = false;
        updateControls(self);
        return;
      }
      checkAnswers(self, true);
    });
    controls.appendChild(check);
    self.checkButton = check;

    if (self.params.behaviour.enableRetry) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'h5p-correct-errors-control h5p-correct-errors-retry';
      retry.textContent = self.params.l10n.tryAgain;
      retry.hidden = true;
      retry.addEventListener('click', function () {
        self.resetTask();
      });
      controls.appendChild(retry);
      self.retryButton = retry;
    }

    self.wrapper.appendChild(controls);
  }

  function renderFeedbackElement(self) {
    var feedback = document.createElement('div');
    feedback.className = 'h5p-add-spaces-feedback h5p-correct-errors-feedback';
    feedback.setAttribute('aria-live', 'polite');
    self.feedbackElement = feedback;
    self.wrapper.appendChild(feedback);
  }

  function checkAnswers(self, sendXapi) {
    var result;

    if (!hasGivenAnswer(self)) {
      self.answerGiven = false;
      updateControls(self);
      return;
    }

    result = evaluate(self, true);

    self.checked = true;
    self.answerGiven = true;
    self.score = result.score;
    self.maxScore = result.maxScore;
    self.lastResult = result;

    renderEvaluatedAnswers(self, result);
    if (self.params.behaviour.showCorrectTextAfterCheck) {
      showSolution(self);
    }
    updateFeedback(self, self.params.l10n.yourResult
      .replace('@score', String(result.score))
      .replace('@max', String(result.maxScore)), result);
    lockResponseArea(self, true);
    updateControls(self);
    self.triggerResize();

    if (sendXapi !== false) {
      emitXAPIResult(self, result);
    }
  }

  function evaluate(self) {
    if (self.params.mode === 'freeedit') {
      return evaluateFreeEdit(self);
    }
    return evaluateGaps(self);
  }

  function evaluateFreeEdit(self) {
    if (isMarkedScoreMode(self) && self.correct.gaps.length > 0 && self.wrapper.querySelectorAll('.h5p-correct-errors-edit-marked').length > 0) {
      return evaluateStructuredFreeEdit(self);
    }
    return evaluateWholeText(self);
  }

  function evaluateStructuredFreeEdit(self) {
    var marked = self.wrapper.querySelectorAll('.h5p-correct-errors-edit-marked');
    var score = 0;
    var missing = 0;
    var incorrect = 0;

    Array.prototype.forEach.call(marked, function (span) {
      var index = parseInt(span.getAttribute('data-index'), 10);
      var value = getTextContent(span);
      var correct = isCorrectAnswer(self, value, self.correct.gaps[index].answers);
      span.setAttribute('data-correct', correct ? 'true' : 'false');
      span.setAttribute('data-user', value);
      span.setAttribute('data-expected', firstVisibleAnswer(self.correct.gaps[index].answers));
      if (correct) {
        score++;
      }
      else if (trim(value) === '') {
        missing++;
      }
      else {
        incorrect++;
      }
    });

    return {
      score: score,
      maxScore: Math.max(marked.length, 1),
      success: score === Math.max(marked.length, 1),
      details: {
        correct: score,
        incorrect: incorrect,
        missing: missing,
        extra: 0
      }
    };
  }

  function evaluateWholeText(self) {
    var learnerText = stripAuthorMarkers(self, getFreeEditResponse(self));
    var match = getWholeTextMatch(self, learnerText);
    var expectedText = match.expectedText || firstCorrectText(self);
    var correct = !!match.correct;
    var unitAssessment = getBestFullTextUnitAssessment(self, learnerText);
    var diff;
    var counts;
    var visualDiff;
    var visualCounts;

    // In full-text mode the whole visible text still has to be right for
    // success, but the score/details must be counted per marked answer unit.
    // Example: [maailm] and [tühikuid|tühikut] are two units. If the first is
    // wrong and the second alternative is right, the result must be 1 / 2, not
    // 0 / 2. Older versions only awarded these unit points when the whole text
    // was fully correct.
    if (unitAssessment && unitAssessment.hasGaps) {
      visualDiff = correct ? [] : diffChars(stripAuthorMarkers(self, learnerText || ''), stripAuthorMarkers(self, expectedText || ''), self);
      visualCounts = countDiffRuns(visualDiff);

      return {
        score: unitAssessment.correct,
        maxScore: unitAssessment.total,
        success: correct && unitAssessment.correct === unitAssessment.total && unitAssessment.missing === 0 && unitAssessment.incorrect === 0,
        userText: learnerText,
        expectedText: expectedText,
        details: {
          correct: unitAssessment.correct,
          incorrect: unitAssessment.incorrect + (correct ? 0 : unitAssessment.staticErrors),
          // The missing count shown in the feedback must match the orange
          // missing chunks shown in the evaluated answer text. Unit extraction
          // can recognise an answer as wrong without marking it as missing,
          // but renderComparison still shows missing characters/chunks in
          // orange. Count those orange chunks here.
          missing: correct ? 0 : Math.max(unitAssessment.missing, visualCounts.missing),
          extra: visualCounts.extra
        }
      };
    }

    diff = correct ? [] : diffChars(learnerText, expectedText, self);
    counts = countDiffOperations(diff);

    return {
      score: correct ? 1 : 0,
      maxScore: 1,
      success: correct,
      userText: learnerText,
      expectedText: expectedText,
      details: {
        correct: correct ? 1 : 0,
        incorrect: correct ? 0 : (counts.extra || (counts.missing ? 0 : 1)),
        missing: correct ? 0 : counts.missing,
        extra: correct ? 0 : counts.extra
      }
    };
  }

  function evaluateGaps(self) {
    var values = getGapResponses(self);
    var score = 0;
    var maxScore = self.correct.gaps.length;
    var missing = 0;
    var incorrect = 0;

    values.forEach(function (value, index) {
      var correct = isCorrectAnswer(self, value, self.correct.gaps[index].answers);
      if (correct) {
        score++;
      }
      else if (trim(value) === '') {
        missing++;
      }
      else {
        incorrect++;
      }
    });

    return {
      score: score,
      maxScore: Math.max(maxScore, 1),
      success: score === Math.max(maxScore, 1),
      gapValues: values,
      details: {
        correct: score,
        incorrect: incorrect,
        missing: missing,
        extra: 0
      }
    };
  }

  function renderEvaluatedAnswers(self, result) {
    if (self.params.mode === 'freeedit') {
      renderEvaluatedFreeEdit(self, result);
    }
    else {
      renderEvaluatedGaps(self, result);
    }
  }

  function renderEvaluatedFreeEdit(self, result) {
    var editable = self.wrapper.querySelector('.h5p-correct-errors-free-edit');

    if (!editable) {
      return;
    }

    if (isMarkedScoreMode(self) && self.correct.gaps.length > 0 && editable.classList.contains('h5p-correct-errors-free-edit-structured')) {
      Array.prototype.forEach.call(editable.querySelectorAll('.h5p-correct-errors-edit-segment'), function (span) {
        span.contentEditable = 'false';
        span.removeAttribute('tabindex');
        if (span.classList.contains('h5p-correct-errors-edit-marked')) {
          var index = parseInt(span.getAttribute('data-index'), 10);
          var user = span.getAttribute('data-user') || getTextContent(span);
          var correct = span.getAttribute('data-correct') === 'true';
          span.innerHTML = '';
          span.classList.add(correct ? 'h5p-correct-errors-correct' : 'h5p-correct-errors-incorrect');
          if (correct) {
            appendPlainText(span, user);
          }
          else {
            renderComparison(span, user, firstVisibleAnswer(self.correct.gaps[index].answers), self);
          }
        }
      });
      editable.classList.toggle('h5p-correct-errors-correct', result.success);
      editable.classList.toggle('h5p-correct-errors-incorrect', !result.success);
      return;
    }

    editable.innerHTML = '';
    editable.contentEditable = 'false';
    editable.removeAttribute('tabindex');
    editable.classList.toggle('h5p-correct-errors-correct', result.success);
    editable.classList.toggle('h5p-correct-errors-incorrect', !result.success);

    if (result.success) {
      appendPlainText(editable, stripAuthorMarkers(self, result.userText || ''));
    }
    else {
      renderComparison(editable, stripAuthorMarkers(self, result.userText || ''), stripAuthorMarkers(self, result.expectedText || ''), self);
    }
  }

  function renderEvaluatedGaps(self) {
    var gaps = self.wrapper.querySelectorAll('.h5p-correct-errors-gap');

    Array.prototype.forEach.call(gaps, function (gap) {
      var index = parseInt(gap.getAttribute('data-index'), 10);
      var value = getGapValue(gap);
      var correct = isCorrectAnswer(self, value, self.correct.gaps[index].answers);
      var resultSpan;

      if (gap.tagName.toLowerCase() === 'select') {
        var missingSelection = trim(value) === '';
        var expected = firstVisibleAnswer(self.correct.gaps[index].answers);
        gap.disabled = true;
        gap.classList.remove('h5p-correct-errors-select-missing');
        gap.classList.remove('h5p-correct-errors-select-wrong');
        if (correct) {
          gap.classList.add('h5p-correct-errors-correct');
        }
        else if (missingSelection) {
          ensureSelectOption(gap, expected, expected === '' ? self.params.l10n.emptyGap : expected);
          gap.value = expected;
          updateSelectPlaceholderClass(gap);
          gap.classList.add('h5p-correct-errors-select-missing');
        }
        else {
          gap.classList.add('h5p-correct-errors-incorrect');
          gap.classList.add('h5p-correct-errors-select-wrong');
        }
        return;
      }

      resultSpan = document.createElement('span');
      resultSpan.className = 'h5p-correct-errors-gap-result ' + (correct ? 'h5p-correct-errors-correct' : 'h5p-correct-errors-incorrect');
      if (correct) {
        appendPlainText(resultSpan, value);
      }
      else if (self.params.mode === 'dragdrop') {
        renderDragDropResultComparison(resultSpan, value, firstVisibleAnswer(self.correct.gaps[index].answers), self);
      }
      else {
        renderComparison(resultSpan, value, firstVisibleAnswer(self.correct.gaps[index].answers), self);
      }

      if (gap.parentNode) {
        gap.parentNode.replaceChild(resultSpan, gap);
      }
    });
  }

  function showCorrectAnswersInTask(self) {
    if (self.params.mode === 'freeedit') {
      var editable = self.wrapper.querySelector('.h5p-correct-errors-free-edit');
      if (editable) {
        editable.innerHTML = '';
        editable.contentEditable = 'false';
        editable.removeAttribute('tabindex');
        editable.classList.add('h5p-correct-errors-correct');
        appendPlainText(editable, getDisplayCorrectText(self));
      }
      return;
    }

    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-correct-errors-gap'), function (gap) {
      var index = parseInt(gap.getAttribute('data-index'), 10);
      var answer = firstVisibleAnswer(self.correct.gaps[index].answers);
      if (gap.tagName.toLowerCase() === 'input' || gap.tagName.toLowerCase() === 'select') {
        gap.value = answer;
      }
      else {
        gap.textContent = answer;
      }
      gap.classList.add('h5p-correct-errors-correct');
    });
  }

  function renderSolutionElement(self, parent) {
    var solution = document.createElement('div');

    solution.className = 'h5p-correct-errors-solution';
    solution.hidden = true;

    parent.appendChild(solution);
    self.solutionElement = solution;
    updateSolutionElement(self);
  }

  function showSolution(self) {
    if (!self.solutionElement) {
      return;
    }

    updateSolutionElement(self);
    self.solutionElement.hidden = false;
  }

  function updateSolutionElement(self) {
    var prefix;

    if (!self.solutionElement) {
      return;
    }

    self.solutionElement.innerHTML = '';
    prefix = document.createElement('strong');
    prefix.textContent = self.params.l10n.solutionPrefix + ' ';
    self.solutionElement.appendChild(prefix);
    appendPlainText(self.solutionElement, getDisplayCorrectText(self));
  }

  function updateFeedback(self, message, result) {
    var score;
    var details;
    var detailLine;
    var correctCount;
    var wrongCount;
    var missingCount;

    if (!self.feedbackElement) {
      return;
    }

    self.feedbackElement.innerHTML = '';
    self.feedbackElement.classList.remove('h5p-add-spaces-feedback-success');
    self.feedbackElement.classList.remove('h5p-add-spaces-feedback-failure');
    self.feedbackElement.classList.remove('h5p-correct-errors-feedback-success');
    self.feedbackElement.classList.remove('h5p-correct-errors-feedback-failure');

    if (!message && !result) {
      return;
    }

    if (result && result.success) {
      var success = document.createElement('div');
      success.className = 'h5p-add-spaces-result-score h5p-correct-errors-result-score';
      success.textContent = self.params.l10n.correctFeedback || DEFAULT_L10N.correctFeedback;
      self.feedbackElement.appendChild(success);
    }

    if (message) {
      score = document.createElement('div');
      score.className = 'h5p-add-spaces-result-score h5p-correct-errors-result-score';
      score.textContent = message;
      self.feedbackElement.appendChild(score);
    }

    if (result && result.details) {
      details = result.details || {};
      correctCount = details.correct || 0;
      wrongCount = details.incorrect || 0;
      missingCount = details.missing || 0;

      detailLine = document.createElement('div');
      detailLine.className = 'h5p-capital-letters-result-details h5p-correct-errors-result-details';
      appendFeedbackDetail(detailLine, self.params.l10n.correctText || DEFAULT_L10N.correctText, correctCount, 'h5p-correct-errors-select-correct');
      appendFeedbackDetail(detailLine, self.params.l10n.wrongText || DEFAULT_L10N.wrongText, wrongCount, 'h5p-correct-errors-select-wrong');
      appendFeedbackDetail(detailLine, self.params.l10n.missingCountText || DEFAULT_L10N.missingCountText, missingCount, 'h5p-correct-errors-select-missing');
      self.feedbackElement.appendChild(detailLine);
    }

    if (result) {
      self.feedbackElement.classList.add(result.success ? 'h5p-add-spaces-feedback-success' : 'h5p-add-spaces-feedback-failure');
      self.feedbackElement.classList.add(result.success ? 'h5p-correct-errors-feedback-success' : 'h5p-correct-errors-feedback-failure');
    }
  }

  function appendFeedbackDetail(parent, template, count, stateClass) {
    var item = document.createElement('span');
    var parts = splitTemplateAroundCount(template);
    var label = '';
    var labelSpan;
    var countSpan;

    item.className = 'h5p-correct-errors-result-detail-item';

    label = ((parts.before || '') + (parts.after || '')).trim();
    if (label) {
      labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      item.appendChild(labelSpan);
    }

    countSpan = document.createElement('span');
    countSpan.className = 'h5p-correct-errors-feedback-count ' + (stateClass || '');
    countSpan.textContent = String(count);
    item.appendChild(countSpan);

    parent.appendChild(item);
  }

  function splitTemplateAroundCount(template) {
    var source = template || '';
    var index = source.indexOf('@count');

    if (index === -1) {
      return {before: source, after: ''};
    }

    return {
      before: source.slice(0, index),
      after: source.slice(index + '@count'.length)
    };
  }

  function replacePlaceholders(template, values) {
    var result = template || '';
    Object.keys(values || {}).forEach(function (key) {
      result = result.split('@' + key).join(values[key]);
    });
    return result;
  }

  function updateControls(self) {
    if (self.checkButton) {
      self.checkButton.hidden = !!self.checked;
      self.checkButton.disabled = !!self.checked || !hasGivenAnswer(self);
    }
    if (self.retryButton) {
      self.retryButton.hidden = !self.checked;
    }
  }

  function lockResponseArea(self, locked) {
    var answerArea;

    if (!self.wrapper) {
      return;
    }

    answerArea = self.wrapper.querySelector('.h5p-correct-errors-answer-area');
    if (answerArea) {
      answerArea.classList.toggle('is-locked', !!locked);
      answerArea.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }

    Array.prototype.forEach.call(self.wrapper.querySelectorAll('[contenteditable]'), function (element) {
      element.contentEditable = locked ? 'false' : 'true';
      if (locked) {
        element.removeAttribute('tabindex');
      }
    });

    Array.prototype.forEach.call(self.wrapper.querySelectorAll('input, select, button.h5p-correct-errors-token, button.h5p-correct-errors-special-key'), function (element) {
      element.disabled = !!locked;
      if (locked) {
        element.setAttribute('tabindex', '-1');
        if (element.draggable !== undefined) {
          element.draggable = false;
        }
      }
      else {
        element.removeAttribute('tabindex');
      }
    });
  }

  function renderComparison(parent, userText, expectedText, self) {
    var ops = diffChars(userText || '', expectedText || '', self);

    ops.forEach(function (op) {
      if (op.type === 'equal') {
        appendPlainChar(parent, op.ch);
      }
      else if (op.type === 'extra') {
        appendClassifiedChar(parent, op.ch, true, self);
      }
      else if (op.type === 'missing') {
        appendClassifiedChar(parent, op.ch, false, self);
      }
    });
  }

  function countDiffOperations(ops) {
    var counts = {
      extra: 0,
      missing: 0
    };

    (ops || []).forEach(function (op) {
      if (op.type === 'extra') {
        counts.extra += toChars(op.ch).length || 1;
      }
      else if (op.type === 'missing') {
        counts.missing += toChars(op.ch).length || 1;
      }
    });

    return counts;
  }

  function countDiffRuns(ops) {
    var counts = {
      extra: 0,
      missing: 0
    };
    var previousType = null;

    (ops || []).forEach(function (op) {
      if (!op || (op.type !== 'extra' && op.type !== 'missing')) {
        previousType = op && op.type === 'equal' ? 'equal' : null;
        return;
      }

      if (op.type !== previousType) {
        counts[op.type] += 1;
      }
      previousType = op.type;
    });

    return counts;
  }

  function diffChars(userText, expectedText, self) {
    var user = toChars(userText);
    var expected = toChars(expectedText);
    var n = user.length;
    var m = expected.length;
    var dp = [];
    var i;
    var j;
    var ops = [];

    if (n * m > 40000) {
      return [{type: 'extra', ch: userText}, {type: 'missing', ch: expectedText}];
    }

    for (i = 0; i <= n; i++) {
      dp[i] = [];
      for (j = 0; j <= m; j++) {
        dp[i][j] = 0;
      }
    }

    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        if (normaliseComparableChar(self, user[i]) === normaliseComparableChar(self, expected[j])) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        }
        else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    i = 0;
    j = 0;
    while (i < n && j < m) {
      if (normaliseComparableChar(self, user[i]) === normaliseComparableChar(self, expected[j])) {
        ops.push({type: 'equal', ch: user[i]});
        i++;
        j++;
      }
      else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({type: 'extra', ch: user[i]});
        i++;
      }
      else {
        ops.push({type: 'missing', ch: expected[j]});
        j++;
      }
    }
    while (i < n) {
      ops.push({type: 'extra', ch: user[i]});
      i++;
    }
    while (j < m) {
      ops.push({type: 'missing', ch: expected[j]});
      j++;
    }

    return ops;
  }

  function appendText(parent, text, tag, className) {
    var element = document.createElement(tag || 'span');
    element.className = className || '';
    element.textContent = text || '';
    parent.appendChild(element);
    return element;
  }

  function appendPlainText(parent, text) {
    toChars(text || '').forEach(function (ch) {
      appendPlainChar(parent, ch);
    });
  }

  function renderDragDropResultComparison(parent, userText, expectedText, self) {
    if (trim(userText || '') !== '') {
      appendWholeMarkedText(parent, userText || '', 'h5p-correct-errors-drag-wrong-result', self.params.l10n.incorrectText || self.params.l10n.extraText);
    }

    if (expectedText !== '') {
      appendWholeMarkedText(parent, expectedText || '', 'h5p-correct-errors-drag-correct-result', self.params.l10n.correctAnswer || self.params.l10n.missingText);
    }
  }

  function appendWholeMarkedText(parent, text, className, ariaLabel) {
    var span = document.createElement('span');
    span.className = className;
    span.setAttribute('aria-label', ariaLabel || '');
    span.textContent = text || ' ';
    parent.appendChild(span);
  }

  function appendPlainChar(parent, ch) {
    var span = document.createElement('span');
    span.className = 'h5p-correct-errors-result-plain';
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    parent.appendChild(span);
  }


  function getOptionSeparator(self) {
    var value = self.params && self.params.behaviour ? self.params.behaviour.optionSeparator : '|';
    value = unwrapSettingValue(value, '|');
    value = String(value === null || value === undefined ? '|' : value).replace(/[\r\n]/g, '');
    return value === '' ? '|' : value;
  }

  function getScoreMode(self) {
    var value = unwrapSettingValue(self && self.params ? self.params.scoreMode : null, 'fulltext');
    return value === 'marked' ? 'marked' : 'fulltext';
  }

  function isMarkedScoreMode(self) {
    return getScoreMode(self) === 'marked';
  }

  function shouldShowEvaluatedParts(self) {
    var behaviour = self && self.params ? self.params.behaviour || {} : {};
    return isMarkedScoreMode(self) && !!behaviour.showEvaluatedParts;
  }

  function isFullTextScoreMode(self) {
    return getScoreMode(self) === 'fulltext';
  }

  function unwrapSettingValue(value, fallback) {
    var guard = 0;

    while (value !== null && value !== undefined && typeof value === 'object' && guard < 10) {
      guard++;
      if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        value = value.value;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'params')) {
        value = value.params;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'raw')) {
        value = value.raw;
        continue;
      }
      break;
    }

    if (value === null || value === undefined || typeof value === 'object') {
      return fallback;
    }

    return value;
  }

  function getDelimiterPair(self) {
    var value = unwrapSettingValue(self.params && self.params.behaviour && self.params.behaviour.delimiters, '[]');
    var open;
    var close;

    switch (value) {
      case '{}':
        open = '{';
        close = '}';
        break;
      case '##':
        open = '#';
        close = '#';
        break;
      case '@@':
        open = '@';
        close = '@';
        break;
      case '*':
        open = '*';
        close = '*';
        break;
      case '[]':
        open = '[';
        close = ']';
        break;
      default:
        // Backwards compatibility for content created with older draft versions.
        open = (self.params.behaviour && self.params.behaviour.openingDelimiter) || '[';
        close = (self.params.behaviour && self.params.behaviour.closingDelimiter) || ']';
        break;
    }

    return {open: open, close: close};
  }

  function appendClassifiedChar(parent, ch, isExtra, self) {
    var chars = toChars(ch || '');
    if (chars.length > 1) {
      chars.forEach(function (part) {
        appendClassifiedChar(parent, part, isExtra, self);
      });
      return;
    }

    var span = document.createElement('span');
    var isSpace = ch === ' ';

    span.className = isExtra ? 'h5p-correct-errors-extra-text' : 'h5p-correct-errors-missing-text';
    if (isSpace) {
      span.className += ' h5p-correct-errors-marked-space';
    }
    span.setAttribute('aria-label', isExtra ? self.params.l10n.extraText : self.params.l10n.missingText);
    span.textContent = isSpace ? '\u00a0' : ch;
    parent.appendChild(span);
  }

  function parseMarkedText(self, text) {
    text = decodeHtmlEntities(String(text || ''));
    var delimiters = getDelimiterPair(self);
    var open = delimiters.open;
    var close = delimiters.close;
    var segments = [];
    var gaps = [];
    var position = 0;

    while (position < text.length) {
      var start = text.indexOf(open, position);
      if (start === -1) {
        pushTextSegment(segments, text.substring(position));
        break;
      }

      if (start > position) {
        pushTextSegment(segments, text.substring(position, start));
      }

      var end = text.indexOf(close, start + open.length);
      if (end === -1) {
        pushTextSegment(segments, text.substring(start));
        break;
      }

      var raw = text.substring(start + open.length, end);
      var gap = {
        type: 'gap',
        raw: raw,
        answers: parseAnswerOptions(self, raw)
      };
      segments.push(gap);
      gaps.push(gap);
      position = end + close.length;
    }

    return {segments: segments, gaps: gaps};
  }

  function pushTextSegment(segments, text) {
    if (!text) {
      return;
    }
    if (segments.length && segments[segments.length - 1].type === 'text') {
      segments[segments.length - 1].text += text;
    }
    else {
      segments.push({type: 'text', text: text});
    }
  }

  function parseAnswerOptions(self, raw) {
    var separator = getOptionSeparator(self);
    var parts = separator ? String(raw).split(separator) : [raw];
    var answers = [];

    parts.forEach(function (part) {
      var value = trim(String(part));
      answers.push(value === '!!' ? '' : value);
    });

    return answers.length ? answers : [''];
  }

  function matchesParsedText(self, parsed, learnerText) {
    var positions = [0];
    var text = String(learnerText === null || learnerText === undefined ? '' : learnerText);

    parsed.segments.forEach(function (segment) {
      var next = [];

      positions.forEach(function (position) {
        if (segment.type === 'text') {
          if (textPartMatches(self, text, position, segment.text)) {
            pushUniqueNumber(next, position + String(segment.text || '').length);
          }
        }
        else {
          (segment.answers || ['']).forEach(function (answer) {
            answer = String(answer === null || answer === undefined ? '' : answer);
            if (textPartMatches(self, text, position, answer)) {
              pushUniqueNumber(next, position + answer.length);
            }
          });
        }
      });

      positions = next;
    });

    return positions.indexOf(text.length) !== -1;
  }

  function getWholeTextMatch(self, learnerText) {
    var text = String(learnerText === null || learnerText === undefined ? '' : learnerText);
    var parsedList = getFullTextParsedCandidates(self);
    var bestExpected = firstCorrectText(self);
    var i;
    var variants;
    var j;

    // Full-text scoring must accept all alternatives inside the author's
    // markers. Do this from the parsed marker structure used by the working
    // marked-parts scorer, but compare the complete learner text. This branch
    // does not normalise spaces; a double space or a space in the wrong place
    // remains a mistake.
    for (i = 0; i < parsedList.length; i++) {
      if (matchesParsedText(self, parsedList[i], text)) {
        return {correct: true, expectedText: text};
      }
    }

    // If the answer is wrong, the visual comparison and the detail counts must
    // use the closest allowed full-text variant, not always the first variant.
    // Otherwise an answer that is close to an alternative is compared against a
    // different answer and the error marks become misleading.
    bestExpected = getClosestExpectedVariant(self, text, parsedList);

    // Keep direct variant comparison as a second exact check for compatibility.
    for (i = 0; i < parsedList.length; i++) {
      variants = buildCorrectTextVariants(parsedList[i], 100000);
      for (j = 0; j < variants.length; j++) {
        if (normalise(self, text) === normalise(self, variants[j])) {
          return {correct: true, expectedText: variants[j]};
        }
      }
    }

    return {correct: false, expectedText: bestExpected};
  }

  function getClosestExpectedVariant(self, learnerText, parsedList) {
    var bestExpected = firstCorrectText(self);
    var bestCost = null;
    var i;
    var variants;
    var j;
    var counts;
    var cost;

    for (i = 0; i < parsedList.length; i++) {
      variants = buildCorrectTextVariants(parsedList[i], 100000);
      for (j = 0; j < variants.length; j++) {
        counts = countDiffOperations(diffChars(learnerText, variants[j], self));
        cost = counts.extra + counts.missing;
        if (bestCost === null || cost < bestCost) {
          bestCost = cost;
          bestExpected = variants[j];
        }
        if (bestCost === 0) {
          return bestExpected;
        }
      }
    }

    return bestExpected;
  }

  function getBestFullTextUnitAssessment(self, learnerText) {
    var parsedList = getFullTextParsedCandidates(self);
    var best = null;
    var i;
    var assessment;

    for (i = 0; i < parsedList.length; i++) {
      assessment = assessParsedFullTextUnits(self, parsedList[i], learnerText);
      if (!assessment || !assessment.hasGaps) {
        continue;
      }
      if (!best || isBetterFullTextAssessment(assessment, best)) {
        best = assessment;
      }
    }

    return best || {hasGaps: false};
  }

  function isBetterFullTextAssessment(candidate, current) {
    var candidateErrors = candidate.incorrect + candidate.missing + candidate.staticErrors;
    var currentErrors = current.incorrect + current.missing + current.staticErrors;

    if (candidate.correct !== current.correct) {
      return candidate.correct > current.correct;
    }
    if (candidateErrors !== currentErrors) {
      return candidateErrors < currentErrors;
    }
    return candidate.total > current.total;
  }

  function assessParsedFullTextUnits(self, parsed, learnerText) {
    var extraction;
    var correct = 0;
    var missing = 0;
    var incorrect = 0;
    var total;

    if (!parsed || !parsed.gaps || parsed.gaps.length === 0) {
      return {hasGaps: false};
    }

    extraction = extractFullTextGapValues(self, parsed, learnerText);
    if (!extraction || extraction.values.length !== parsed.gaps.length) {
      return null;
    }

    total = parsed.gaps.length;
    extraction.values.forEach(function (value, index) {
      if (isCorrectAnswer(self, value, parsed.gaps[index].answers)) {
        correct++;
      }
      else if (trim(value) === '') {
        missing++;
      }
      else {
        incorrect++;
      }
    });

    return {
      hasGaps: true,
      total: total,
      correct: correct,
      missing: missing,
      incorrect: incorrect,
      staticErrors: extraction.staticErrors || 0
    };
  }

  function extractFullTextGapValues(self, parsed, learnerText) {
    var text = String(learnerText === null || learnerText === undefined ? '' : learnerText);
    var segments = parsed.segments || [];
    var values = [];
    var position = 0;
    var staticErrors = 0;
    var i;
    var segment;
    var nextText;
    var nextPosition;

    for (i = 0; i < segments.length; i++) {
      segment = segments[i];

      if (segment.type === 'text') {
        if (textPartMatches(self, text, position, segment.text || '')) {
          position += String(segment.text || '').length;
        }
        else {
          staticErrors++;
          nextPosition = findTextPart(self, text, segment.text || '', position);
          if (nextPosition === -1) {
            return null;
          }
          position = nextPosition + String(segment.text || '').length;
        }
        continue;
      }

      nextText = getNextStaticTextSegment(segments, i + 1);
      if (nextText !== null && nextText !== '') {
        nextPosition = findTextPart(self, text, nextText, position);
        if (nextPosition === -1) {
          return null;
        }
        values.push(text.substring(position, nextPosition));
        position = nextPosition;
      }
      else {
        values.push(text.substring(position));
        position = text.length;
      }
    }

    if (position !== text.length) {
      staticErrors++;
    }

    return {values: values, staticErrors: staticErrors};
  }

  function getNextStaticTextSegment(segments, startIndex) {
    var i;
    for (i = startIndex; i < segments.length; i++) {
      if (segments[i].type === 'text' && String(segments[i].text || '') !== '') {
        return segments[i].text;
      }
    }
    return null;
  }

  function findTextPart(self, text, needle, startPosition) {
    var i;
    var max;
    needle = String(needle === null || needle === undefined ? '' : needle);

    if (needle === '') {
      return startPosition;
    }

    max = text.length - needle.length;
    for (i = startPosition; i <= max; i++) {
      if (textPartMatches(self, text, i, needle)) {
        return i;
      }
    }

    return -1;
  }

  function getFullTextUnitCount(self) {
    var candidates = getFullTextParsedCandidates(self);
    var count = 0;

    (candidates || []).forEach(function (parsed) {
      if (parsed && parsed.gaps) {
        count = Math.max(count, parsed.gaps.length);
      }
    });

    return Math.max(count, 1);
  }

  function getFullTextParsedCandidates(self) {
    var candidates = [];
    var originalDelimiters = self.params && self.params.behaviour ? self.params.behaviour.delimiters : null;
    var rawCorrectText = self.params ? self.params.correctText : '';
    var delimiterValues = [originalDelimiters, '[]', '{}', '##', '@@', '*'];

    pushParsedCandidate(candidates, self.correct);

    // Robust fallback for contents that were created while marker settings were
    // moved between semantics locations. It tries the saved marker setting first
    // and then the supported marker pairs. This affects full-text matching only;
    // the author-facing marked-parts mode remains untouched.
    delimiterValues.forEach(function (delimiter) {
      var parsed;
      if (!delimiter) {
        return;
      }
      if (self.params && self.params.behaviour) {
        self.params.behaviour.delimiters = unwrapSettingValue(delimiter, '[]');
      }
      parsed = parseMarkedText(self, rawCorrectText || '');
      pushParsedCandidate(candidates, parsed);
    });

    if (self.params && self.params.behaviour) {
      self.params.behaviour.delimiters = originalDelimiters;
    }

    return candidates.length ? candidates : [self.correct];
  }

  function pushParsedCandidate(candidates, parsed) {
    var key;
    if (!parsed || !parsed.segments) {
      return;
    }
    key = serialiseParsedText(parsed);
    for (var i = 0; i < candidates.length; i++) {
      if (serialiseParsedText(candidates[i]) === key) {
        return;
      }
    }
    candidates.push(parsed);
  }

  function serialiseParsedText(parsed) {
    var output = '';
    (parsed.segments || []).forEach(function (segment) {
      if (segment.type === 'text') {
        output += 'T:' + segment.text + ';';
      }
      else {
        output += 'G:' + (segment.answers || []).join('\u0001') + ';';
      }
    });
    return output;
  }

  function buildCorrectTextVariants(parsed, limit) {
    var variants = [''];

    if (!parsed || !parsed.segments) {
      return variants;
    }

    parsed.segments.forEach(function (segment) {
      var next = [];
      if (segment.type === 'text') {
        variants.forEach(function (variant) {
          if (next.length < limit) {
            next.push(variant + segment.text);
          }
        });
      }
      else {
        variants.forEach(function (variant) {
          (segment.answers || ['']).forEach(function (answer) {
            if (next.length < limit) {
              next.push(variant + String(answer === null || answer === undefined ? '' : answer));
            }
          });
        });
      }
      variants = next;
    });

    return variants;
  }

  function textPartMatches(self, text, position, expected) {
    expected = String(expected === null || expected === undefined ? '' : expected);
    if (position + expected.length > text.length) {
      return false;
    }
    return normalise(self, text.substr(position, expected.length)) === normalise(self, expected);
  }

  function pushUniqueNumber(array, value) {
    if (array.indexOf(value) === -1) {
      array.push(value);
    }
  }


  function stripMarkersToFirstCorrect(parsed) {
    var output = '';
    parsed.segments.forEach(function (segment) {
      output += segment.type === 'text' ? segment.text : firstVisibleAnswer(segment.answers);
    });
    return output;
  }

  function firstCorrectText(self) {
    return getDisplayCorrectText(self);
  }

  function getDisplayCorrectText(self) {
    return getDisplayTextFromRaw(self, self && self.params ? self.params.correctText || '' : '');
  }

  function getDisplayTextFromRaw(self, rawText) {
    // Learner-facing text must never expose author markers. Do not depend on
    // the currently selected marker pair only: older contents and copied text
    // may contain a different supported marker pair. Choose the parse that
    // removes the largest number of marked chunks.
    return stripAuthorMarkers(self, rawText || '');
  }

  function stripAuthorMarkers(self, rawText) {
    var text = decodeHtmlEntities(String(rawText === null || rawText === undefined ? '' : rawText));
    var best = {text: text, count: 0};
    var pairs = [
      {open: '[', close: ']'},
      {open: '{', close: '}'},
      {open: '#', close: '#'},
      {open: '@', close: '@'},
      {open: '*', close: '*'}
    ];

    pairs.forEach(function (pair) {
      var current = stripMarkersWithPair(self, text, pair.open, pair.close);
      if (current.count > best.count) {
        best = current;
      }
    });

    return best.text;
  }

  function stripMarkersWithPair(self, text, open, close) {
    var output = '';
    var position = 0;
    var count = 0;
    var start;
    var end;
    var raw;

    if (!open || !close) {
      return {text: text, count: 0};
    }

    while (position < text.length) {
      start = text.indexOf(open, position);
      if (start === -1) {
        output += text.substring(position);
        break;
      }

      output += text.substring(position, start);
      end = text.indexOf(close, start + open.length);
      if (end === -1) {
        output += text.substring(start);
        break;
      }

      raw = text.substring(start + open.length, end);
      output += firstVisibleAnswer(parseAnswerOptions(self, raw));
      count++;
      position = end + close.length;
    }

    return {text: output, count: count};
  }

  function stripSupportedMarkersToFirstAnswer(self, rawText) {
    var text = decodeHtmlEntities(String(rawText === null || rawText === undefined ? '' : rawText));
    var best = {text: text, count: 0};

    getSupportedDelimiterValues(self).forEach(function (delimiterValue) {
      var current = stripMarkersWithDelimiterValue(self, text, delimiterValue);
      if (current.count > best.count) {
        best = current;
      }
    });

    return best;
  }

  function stripMarkersWithDelimiterValue(self, text, delimiterValue) {
    var pair = delimiterValueToPair(self, delimiterValue);
    var output = '';
    var position = 0;
    var count = 0;
    var start;
    var end;
    var raw;

    if (!pair.open || !pair.close) {
      return {text: text, count: 0};
    }

    while (position < text.length) {
      start = text.indexOf(pair.open, position);
      if (start === -1) {
        output += text.substring(position);
        break;
      }

      output += text.substring(position, start);
      end = text.indexOf(pair.close, start + pair.open.length);
      if (end === -1) {
        output += text.substring(start);
        break;
      }

      raw = text.substring(start + pair.open.length, end);
      output += firstVisibleAnswer(parseAnswerOptions(self, raw));
      count++;
      position = end + pair.close.length;
    }

    return {text: output, count: count};
  }

  function delimiterValueToPair(self, delimiterValue) {
    var value = unwrapSettingValue(delimiterValue, '[]');
    switch (value) {
      case '{}':
        return {open: '{', close: '}'};
      case '##':
        return {open: '#', close: '#'};
      case '@@':
        return {open: '@', close: '@'};
      case '*':
        return {open: '*', close: '*'};
      case '[]':
        return {open: '[', close: ']'};
      default:
        return {
          open: (self.params.behaviour && self.params.behaviour.openingDelimiter) || '[',
          close: (self.params.behaviour && self.params.behaviour.closingDelimiter) || ']'
        };
    }
  }

  function getBestParsedTextForDisplay(self, rawText) {
    var delimiterValues = getSupportedDelimiterValues(self);
    var best = null;
    var bestGapCount = -1;

    delimiterValues.forEach(function (delimiter) {
      var parsed = parseMarkedTextWithDelimiterValue(self, rawText, delimiter);
      var gapCount = parsed && parsed.gaps ? parsed.gaps.length : 0;
      if (!best || gapCount > bestGapCount) {
        best = parsed;
        bestGapCount = gapCount;
      }
    });

    return best || parseMarkedText(self, rawText || '');
  }

  function parseMarkedTextWithDelimiterValue(self, text, delimiterValue) {
    var originalDelimiters = self && self.params && self.params.behaviour ? self.params.behaviour.delimiters : null;
    var parsed;

    if (self && self.params && self.params.behaviour) {
      self.params.behaviour.delimiters = delimiterValue;
    }
    parsed = parseMarkedText(self, text || '');
    if (self && self.params && self.params.behaviour) {
      self.params.behaviour.delimiters = originalDelimiters;
    }

    return parsed;
  }

  function getSupportedDelimiterValues(self) {
    var values = [];
    pushUniqueValue(values, unwrapSettingValue(self && self.params && self.params.behaviour ? self.params.behaviour.delimiters : null, '[]'));
    pushUniqueValue(values, unwrapSettingValue(self && self.params ? self.params.delimiters : null, '[]'));
    ['[]', '{}', '##', '@@', '*'].forEach(function (delimiter) {
      pushUniqueValue(values, delimiter);
    });
    return values;
  }

  function pushUniqueValue(array, value) {
    value = unwrapSettingValue(value, '[]');
    if (array.indexOf(value) === -1) {
      array.push(value);
    }
  }

  function getBestDisplayParsedText(self) {
    var candidates = getFullTextParsedCandidates(self);
    var i;

    for (i = 0; i < candidates.length; i++) {
      if (candidates[i] && candidates[i].gaps && candidates[i].gaps.length > 0) {
        return candidates[i];
      }
    }

    return self.correct || parseMarkedText(self, self.params ? self.params.correctText || '' : '');
  }

  function getFreeEditStartText(self) {
    if (self.params.wrongText && trim(self.params.wrongText) !== '') {
      return getDisplayTextFromRaw(self, self.params.wrongText || '');
    }

    if (self.correct.gaps.length > 0) {
      var output = '';
      self.correct.segments.forEach(function (segment) {
        output += segment.type === 'text' ? segment.text : '____';
      });
      return output;
    }

    return firstCorrectText(self);
  }

  function hasSameMarkedStructure(left, right) {
    if (!right || left.gaps.length !== right.gaps.length) {
      return false;
    }
    if (left.segments.length !== right.segments.length) {
      return false;
    }
    for (var i = 0; i < left.segments.length; i++) {
      if (left.segments[i].type !== right.segments[i].type) {
        return false;
      }
    }
    return true;
  }

  function getFreeEditResponse(self) {
    var editable = self.wrapper ? self.wrapper.querySelector('.h5p-correct-errors-free-edit') : null;
    return editable ? getTextContent(editable) : '';
  }

  function getGapResponses(self) {
    var values = [];
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-correct-errors-gap'), function (gap) {
      values.push(getGapValue(gap));
    });
    return values;
  }

  function getGapValue(gap) {
    var tag = gap.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select') {
      return gap.value || '';
    }
    return gap.textContent || '';
  }

  function setDropzoneValue(self, dropzone, value) {
    dropzone.textContent = value || '';
    dropzone.classList.toggle('h5p-correct-errors-dropzone-filled', !!value);
    self.answerGiven = hasAnyGapAnswer(self);
    updateControls(self);
  }

  function hasGivenAnswer(self) {
    if (!self || !self.wrapper) {
      return false;
    }

    if (self.params.mode === 'freeedit') {
      return !!self.answerGiven && trim(getFreeEditResponse(self)) !== '';
    }

    return hasAnyGapAnswer(self);
  }

  function hasAnyGapAnswer(self) {
    return getGapResponses(self).some(function (value) {
      return trim(value) !== '';
    });
  }

  function calculateMaxScore(self) {
    if (!self.correct) {
      return 0;
    }
    if (self.params.mode === 'freeedit' && isFullTextScoreMode(self)) {
      return getFullTextUnitCount(self);
    }
    if (self.params.mode === 'freeedit' && isMarkedScoreMode(self)) {
      return Math.max(self.correct.gaps.length, 1);
    }
    return Math.max(self.correct.gaps.length, 1);
  }

  function isCorrectAnswer(self, value, answers) {
    var normalisedValue = normalise(self, value);
    for (var i = 0; i < answers.length; i++) {
      if (normalisedValue === normalise(self, answers[i])) {
        return true;
      }
    }
    return false;
  }

  function normalise(self, value) {
    value = String(value === null || value === undefined ? '' : value);
    if (!self.params.behaviour.caseSensitive) {
      value = value.toLocaleLowerCase();
    }
    return value;
  }

  function normaliseComparableChar(self, ch) {
    ch = String(ch === null || ch === undefined ? '' : ch);
    return self.params.behaviour.caseSensitive ? ch : ch.toLocaleLowerCase();
  }

  function firstVisibleAnswer(answers) {
    if (!answers || !answers.length) {
      return '';
    }
    for (var i = 0; i < answers.length; i++) {
      if (answers[i] !== '') {
        return answers[i];
      }
    }
    return '';
  }

  function getExtraOptions(self) {
    var text = self.params.extraOptions || '';
    var options = [];
    String(text).split(/[\n,]+/).forEach(function (part) {
      var option = trim(part);
      if (option !== '') {
        options.push(option);
      }
    });
    return options;
  }

  function getWrongMarkedOptions(self) {
    var options = [];
    self.wrong.gaps.forEach(function (gap) {
      if (trim(gap.raw) !== '') {
        options.push(gap.raw);
      }
    });
    return options;
  }

  function uniqueOptions(self, options) {
    var seen = {};
    var unique = [];
    options.forEach(function (option) {
      var key = normalise(self, option);
      if (!seen[key]) {
        seen[key] = true;
        unique.push(option);
      }
    });
    return unique;
  }


  function getDropdownOptions(self, segment, distractors) {
    var options = [];
    var mode = self.params && self.params.behaviour && self.params.behaviour.dropdownOptionsMode;

    if (mode === 'all') {
      (self.correct.gaps || []).forEach(function (gap) {
        options = options.concat(gap.answers || []);
      });
    }
    else {
      options = options.concat(segment && segment.answers ? segment.answers : []);
    }

    options = uniqueOptions(self, options.concat(distractors || []));
    options = cleanVisibleOptions(options);

    if (self.params.behaviour.shuffleOptions) {
      options = shuffle(options);
    }

    return options;
  }

  function ensureSelectOption(select, value, label) {
    var exists = false;

    Array.prototype.forEach.call(select.options || [], function (option) {
      if (option.value === value) {
        exists = true;
      }
    });

    if (!exists) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function getDragOptionsPosition(self) {
    var position = self.params && self.params.behaviour && self.params.behaviour.dragOptionsPosition;
    return position === 'top' ? 'top' : 'bottom';
  }

  function cleanVisibleOptions(options) {
    return options.filter(function (option) {
      return option !== '';
    });
  }

  function shuffle(array) {
    var copy = array.slice(0);
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }


  function setInputGapWidth(self, input, segment) {
    var chars = getGapWidthChars(self, segment);
    input.setAttribute('size', String(chars));
    input.style.width = 'calc(' + chars + 'ch + 0.8em)';
  }

  function setDropzoneGapWidth(self, dropzone, segment) {
    var chars = getGapWidthChars(self, segment);
    dropzone.style.minWidth = 'calc(' + chars + 'ch + 0.8em)';
  }

  function getGapWidthChars(self, segment) {
    var mode = self.params && self.params.behaviour && self.params.behaviour.gapInputWidthMode;
    var answers;
    var length;

    if (mode === 'uniform') {
      length = 0;
      (self.correct.gaps || []).forEach(function (gap) {
        length = Math.max(length, longestVisibleAnswerLength(gap.answers));
      });
    }
    else {
      answers = segment && segment.answers ? segment.answers : [];
      length = longestVisibleAnswerLength(answers);
    }

    return Math.max(4, Math.min(40, length || 4));
  }

  function longestVisibleAnswerLength(answers) {
    var length = 0;
    (answers || []).forEach(function (answer) {
      if (answer !== '') {
        length = Math.max(length, toChars(answer).length);
      }
    });
    return length;
  }

  function updateSelectPlaceholderClass(select) {
    if (!select) {
      return;
    }
    select.classList.toggle('h5p-correct-errors-gap-select-placeholder', (select.value || '') === '');
  }

  function getGapLabel(self, index) {
    return (self.params.l10n.gapLabel || 'Answer field @num').replace('@num', String(index + 1));
  }

  function getTextContent(element) {
    if (!element) {
      return '';
    }
    return getNodeText(element, true).replace(/\n$/g, '').replace(/\u00a0/g, ' ');
  }

  function getNodeText(node, isRoot) {
    var text = '';
    var nodeName;
    var isBlock;

    if (!node) {
      return '';
    }

    if (node.nodeType === 3) {
      return node.nodeValue || '';
    }

    nodeName = String(node.nodeName || '').toLowerCase();
    if (nodeName === 'br') {
      return '\n';
    }

    if (!node.childNodes || !node.childNodes.length) {
      return '';
    }

    Array.prototype.forEach.call(node.childNodes, function (child) {
      text += getNodeText(child, false);
    });

    isBlock = /^(div|p|li|tr|h1|h2|h3|h4|h5|h6)$/.test(nodeName);
    if (!isRoot && isBlock && text !== '' && text.charAt(text.length - 1) !== '\n') {
      text += '\n';
    }

    return text;
  }

  function isEmptyText(text) {
    return trim(stripHtml(String(text || ''))) === '';
  }

  function extendObject(target, source) {
    var key;

    target = target || {};
    source = source || {};

    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }

    return target;
  }

  function stripHtml(text) {
    return String(text || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  function decodeHtmlEntities(text) {
    var previous;
    var decoded = String(text || '');
    var textarea;

    if (typeof document === 'undefined') {
      return decoded
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
    }

    textarea = document.createElement('textarea');
    do {
      previous = decoded;
      textarea.innerHTML = previous;
      decoded = textarea.value;
    } while (decoded !== previous && /&[a-zA-Z#0-9]+;/.test(decoded));

    return decoded;
  }

  function toChars(str) {
    if (typeof Array.from === 'function') {
      return Array.from(str || '');
    }
    return String(str || '').split('');
  }

  function trim(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
  }

  function mergeDeep(target) {
    var i;
    target = target || {};
    for (i = 1; i < arguments.length; i++) {
      var source = arguments[i] || {};
      Object.keys(source).forEach(function (key) {
        if (isPlainObject(source[key])) {
          target[key] = mergeDeep(isPlainObject(target[key]) ? target[key] : {}, source[key]);
        }
        else {
          target[key] = source[key];
        }
      });
    }
    return target;
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function normaliseL10n(l10n) {
    var merged = mergeDeep({}, DEFAULT_L10N, l10n || {});

    // Backwards compatibility with the first base package.
    if (l10n.check && !l10n.checkAnswer) {
      merged.checkAnswer = l10n.check;
    }
    if (l10n.retry && !l10n.tryAgain) {
      merged.tryAgain = l10n.retry;
    }
    if (l10n.showAnswer && !l10n.solutionPrefix) {
      merged.solutionPrefix = l10n.showAnswer + ':';
    }
    if (l10n.score && !l10n.yourResult) {
      merged.yourResult = l10n.score + ': @score / @max';
    }

    return merged;
  }

  function getDomElement($container) {
    if (!$container) {
      return document.createElement('div');
    }
    return $container.jquery ? $container.get(0) : $container;
  }

  function emitXAPIResult(self, result) {
    if (self && typeof self.emitXAPIResult === 'function') {
      self.emitXAPIResult(result);
    }
  }

  H5P.CorrectErrors = CorrectErrors;
})(H5P);
