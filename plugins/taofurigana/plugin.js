CKEDITOR.plugins.add('taofurigana', {
    lang: 'en', // %REMOVE_LINE_CORE%
    init: function (editor) {
        ('use strict');

        var commandName = 'rubyFurigana';
        var zeroWidthSpace = '\u200b';
        var zeroWidthSpaceRegex = /\u200B/g;
        var rubyTopContentRegex = /(<rt\b[^>]*>)([\s\S]*?)(<\/rt>)/gi;
        var isNormalizingSelection = false;
        var isRestoringZwsAnchor = false;
        var containsTag;
        var otherButtons = [];
        var combos = [];
        const keyCodeDelete = 46;
        const keyCodeBackspace = 8;

        /**
         * @param {CKEDITOR.dom.selection} selection
         * @returns {CKEDITOR.dom.element}
         */
        function getSelectionContent(selection) {
            var range = selection.getRanges()[0],
                content = range.extractContents().$;
            return new CKEDITOR.dom.element(content);
        }

        /**
         * @param {Node} node
         * @returns {boolean}
         */
        function isTextNode(node) {
            return node.nodeType === window.Node.TEXT_NODE;
        }

        /**
         * @param {Selection} selection
         * @returns {boolean}
         */
        function isSelectionEmpty(selection) {
            return selection && selection.isCollapsed();
        }

        /**
         * Return containing Element if current node is of type text
         * @param {Node} node
         * @returns {Node}
         */
        function getContainerElement(node) {
            return isTextNode(node) ? node.parentNode : node;
        }

        /**
         * We check for partially selected nodes
         * @param range
         * @returns {boolean}
         */
        function isValidRange(range) {
            var start = getContainerElement(range.startContainer),
                end = getContainerElement(range.endContainer);

            return start.isSameNode(end);
        }

        /**
         * Traverse a DOM tree to check if it contains a tags
         * @param {Node} rootNode
         */
        function searchTags(rootNode) {
            var childNodes = rootNode.childNodes,
                currentNode,
                i;

            for (i = 0; i < childNodes.length; i++) {
                currentNode = childNodes[i];
                if (!containsTag && !isTextNode(currentNode)) {
                    containsTag = true;
                    return;
                }
            }
        }

        /**
         * Make sure that the current selection is not already inside a furigana/ruby
         * @param {Node} node
         * @returns {boolean}
         */
        function isInFugirana(node) {
            if (!node) {
                return false;
            }

            return node.getAscendant('ruby') !== null;
        }

        /**
         * @param {Selection} selection
         * @returns {boolean}
         */
        function isWrappable(selection) {
            var range = !selection.isCollapsed && selection.getRangeAt(0);

            if (range) {
                containsTag = false;
                searchTags(range.cloneContents());

                return range.toString().trim() !== '' && isValidRange(range) && !containsTag;
            }
            return false;
        }

        /**
         * @param {CkEditor} editor - ckEditor instance
         */
        function furiganaCanBeCreated(editor) {
            var selection = editor.getSelection();
            var nativeSelection = selection.getNative();

            return nativeSelection !== null && canInsert(selection) && isWrappable(nativeSelection);
        }

        /**
         * @param {Selection} selection
         * @returns {boolean}
         */
        function canInsert(selection) {
            return (
                !isSelectionEmpty(selection) &&
                selection.getRanges()[0] &&
                !isInFugirana(selection.getRanges()[0].startContainer)
            );
        }

        /**
         * @param {CKEDITOR.dom.element} rtElement
         * @returns {boolean}
         */
        function isEffectivelyEmpty(rtElement) {
            var textContent = rtElement.$.textContent || '';

            return textContent.replace(zeroWidthSpaceRegex, '').trim() === '';
        }

        /**
         * Valid anchor: a text node whose entire contents are exactly one zero-width space (no mixed text).
         * @param {CKEDITOR.dom.node} node
         * @returns {boolean}
         */
        function isStandaloneZwsAnchor(node) {
            return node && node.type === CKEDITOR.NODE_TEXT && node.getText() === zeroWidthSpace;
        }

        /**
         * Ensure rt has editable start/end anchors in the live DOM.
         * Start and end are always distinct CKEDITOR.dom.text nodes when possible (never one node for both).
         * @param {CKEDITOR.dom.element} rtElement
         * @returns {{ startAnchor: CKEDITOR.dom.text, endAnchor: CKEDITOR.dom.text }}
         */
        function ensureRtAnchors(rtElement) {
            var first = rtElement.getFirst();
            var last = rtElement.getLast();
            var startAnchor;
            var endAnchor;

            if (!first) {
                startAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                endAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                rtElement.append(startAnchor);
                rtElement.append(endAnchor);
                return {
                    startAnchor: startAnchor,
                    endAnchor: endAnchor
                };
            }

            if (first.equals(last)) {
                if (isStandaloneZwsAnchor(first)) {
                    first.remove();
                    startAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                    endAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                    rtElement.append(startAnchor);
                    rtElement.append(endAnchor);
                } else {
                    startAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                    endAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                    startAnchor.insertBefore(first);
                    endAnchor.insertAfter(first);
                }
                return {
                    startAnchor: startAnchor,
                    endAnchor: endAnchor
                };
            }

            if (!isStandaloneZwsAnchor(first)) {
                startAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                startAnchor.insertBefore(first);
            } else {
                startAnchor = first;
            }

            last = rtElement.getLast();

            if (!isStandaloneZwsAnchor(last)) {
                endAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                rtElement.append(endAnchor);
            } else {
                endAnchor = last;
            }

            if (startAnchor.equals(endAnchor)) {
                endAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
                endAnchor.insertAfter(startAnchor);
            }

            return {
                startAnchor: startAnchor,
                endAnchor: endAnchor
            };
        }

        /**
         * @param {CKEDITOR.dom.element} rtElement
         * @returns {{ node: CKEDITOR.dom.text, offset: Number }|null}
         */
        function getFirstVisibleCharPosition(rtElement) {
            var walkerRange = new CKEDITOR.dom.range(editor.document);
            walkerRange.selectNodeContents(rtElement);
            var walker = new CKEDITOR.dom.walker(walkerRange);
            var node = walker.next();

            while (node) {
                if (node.type === CKEDITOR.NODE_TEXT) {
                    var text = node.getText();
                    for (var i = 0; i < text.length; i++) {
                        if (text.charAt(i) !== zeroWidthSpace) {
                            return {
                                node: node,
                                offset: i
                            };
                        }
                    }
                }
                node = walker.next();
            }

            return null;
        }

        /**
         * @param {CKEDITOR.dom.range} range
         * @param {CKEDITOR.dom.element} rtElement
         * @param {{ node: CKEDITOR.dom.text, offset: Number }} firstVisiblePosition
         * @returns {Boolean}
         */
        function isCaretAtOrBeforeFirstVisible(range, rtElement, firstVisiblePosition) {
            if (range.startContainer.equals(firstVisiblePosition.node)) {
                return range.startOffset <= firstVisiblePosition.offset;
            }

            var node = rtElement.getFirst();
            while (node) {
                if (node.equals(range.startContainer)) {
                    return true;
                }
                if (node.equals(firstVisiblePosition.node)) {
                    return false;
                }
                node = node.getNext();
            }

            return false;
        }

        /**
         * @param {CKEDITOR.dom.element} rtElement
         */
        function placeCaretAtRtStart(rtElement) {
            var anchors = ensureRtAnchors(rtElement);
            var selection = editor.getSelection();
            var range = new CKEDITOR.dom.range(editor.document);

            range.setStart(anchors.startAnchor, 1);
            range.collapse(true);
            selection.selectRanges([range]);
        }

        /**
         * Delete first visible rt character when caret is before it.
         * @param {CKEDITOR.dom.selection} selection
         * @param {Number} keyCode
         * @returns {Boolean}
         */
        function guardRtLeadingDelete(selection, keyCode) {
            if (!selection || !selection.isCollapsed() || (keyCode !== keyCodeBackspace && keyCode !== keyCodeDelete)) {
                return false;
            }

            var range = selection.getRanges()[0];
            if (!range) {
                return false;
            }

            var startContainer = range.startContainer;
            if (!startContainer || !startContainer.getAscendant) {
                return false;
            }

            var rtElement = startContainer.getAscendant('rt', true);
            if (!rtElement) {
                return false;
            }

            ensureRtAnchors(rtElement);
            var firstVisiblePosition = getFirstVisibleCharPosition(rtElement);

            if (!firstVisiblePosition || !isCaretAtOrBeforeFirstVisible(range, rtElement, firstVisiblePosition)) {
                return false;
            }

            editor.fire('saveSnapshot');
            editor.fire('lockSnapshot');
            try {
                var text = firstVisiblePosition.node.getText();
                firstVisiblePosition.node.$.nodeValue =
                    text.slice(0, firstVisiblePosition.offset) + text.slice(firstVisiblePosition.offset + 1);
                ensureRtAnchors(rtElement);
                placeCaretAtRtStart(rtElement);
            } finally {
                editor.fire('unlockSnapshot');
            }

            return true;
        }

        /**
         * @param {CKEDITOR.dom.node} startNode
         */
        function ensurePlaceholderForRt(startNode) {
            if (!startNode || !startNode.getAscendant) {
                return;
            }

            var rtElement = startNode.getAscendant('rt', true);

            if (rtElement) {
                ensureRtAnchors(rtElement);
            }
        }

        /**
         * Keep collapsed caret inside ruby top text to prevent input leaking to rb.
         * @param {CKEDITOR.dom.selection} selection
         * @param {CKEDITOR.dom.node} [targetNode]
         * @returns {Boolean}
         */
        function normalizeCaretIntoRt(selection, targetNode) {
            if (isNormalizingSelection || !selection || !selection.isCollapsed()) {
                return false;
            }

            var range = selection.getRanges()[0];
            if (!range) {
                return false;
            }

            var startContainer = range.startContainer;
            if (!startContainer || !startContainer.getAscendant) {
                return false;
            }

            var currentRtElement = startContainer.getAscendant('rt', true);
            if (currentRtElement) {
                ensureRtAnchors(currentRtElement);
                return false;
            }

            var rubyElement = targetNode && targetNode.getAscendant ? targetNode.getAscendant('ruby', true) : null;
            if (!rubyElement) {
                rubyElement = startContainer.getAscendant('ruby', true);
            }
            if (!rubyElement) {
                return false;
            }

            var rtElements = rubyElement.find('rt');
            var rtElement = rtElements.count() ? rtElements.getItem(0) : null;
            if (!rtElement) {
                return false;
            }

            var rtAnchors = ensureRtAnchors(rtElement);
            var caretRange = new CKEDITOR.dom.range(editor.document);
            var moveToRtStart = true;
            var rtIndex = rtElement.getIndex();

            if (startContainer.equals(rubyElement) && range.startOffset > rtIndex) {
                moveToRtStart = false;
            }

            if (moveToRtStart) {
                caretRange.setStart(rtAnchors.startAnchor, 1);
            } else {
                caretRange.setStartBefore(rtAnchors.endAnchor);
            }

            caretRange.collapse(true);
            isNormalizingSelection = true;
            try {
                selection.selectRanges([caretRange]);
            } finally {
                isNormalizingSelection = false;
            }

            return true;
        }

        /**
         * If user clicks on the right-half of the last character inside '<rb>',
         * move caret after the ruby.
         * @param {CKEDITOR.dom.selection} selection
         * @returns {Boolean}
         */
        function normalizeCaretAfterRb(selection) {
            if (isNormalizingSelection || !selection || !selection.isCollapsed()) {
                return false;
            }

            var range = selection.getRanges()[0];
            if (!range) {
                return false;
            }

            var startContainer = range.startContainer;
            if (!startContainer || !startContainer.getAscendant) {
                return false;
            }

            if (
                startContainer.type === CKEDITOR.NODE_TEXT &&
                startContainer.getParent().getName() === 'rb' &&
                range.endOffset === startContainer.getText().length
            ) {
                var caretRange = new CKEDITOR.dom.range(editor.document);
                var rubyElement = startContainer.getAscendant ? startContainer.getAscendant('ruby', true) : null;
                var nextNode = rubyElement.getNext();
                if (nextNode) {
                    caretRange.setStart(nextNode, 1);
                    caretRange.collapse(true);
                    isNormalizingSelection = true;
                    try {
                        selection.selectRanges([caretRange]);
                    } finally {
                        isNormalizingSelection = false;
                    }
                    refreshCommandState(editor);
                    return true;
                }
            }
        }

        function normalizeCaret(focusEventTarget = null) {
            var selection = editor.getSelection();
            if (!normalizeCaretAfterRb(selection)) {
                normalizeCaretIntoRt(selection, focusEventTarget);
                var range = selection && selection.getRanges()[0];
                if (range) {
                    ensurePlaceholderForRt(range.startContainer);
                }
            }
        }

        /**
         * @param {String} data
         * @returns {String}
         */
        function sanitizeRubyData(data) {
            return data.replace(rubyTopContentRegex, function (match, openingTag, content, closingTag) {
                return openingTag + content.replace(zeroWidthSpaceRegex, '') + closingTag;
            }).replace(/<\/ruby>(?:\u200B)+/gi, '</ruby>');
        }

        /**
         * Chrome issue: if caret is after ruby, and you press 'Backspace', then *all content* before caret position gets deleted, not only ruby.
         * So, need to override native 'Backspace' behavior. For simplicity, just move caret inside rt.
         * @param {CKEDITOR.dom.selection} selection
         * @param {Number} keyCode
         * @returns {Boolean}
         */
        function guardBackspaceAfterRuby(selection, keyCode) {
            if ((keyCode !== keyCodeBackspace) || !selection || !selection.isCollapsed()) {
                return false;
            }

            var range = selection.getRanges()[0];
            if (!range) {
                return false;
            }

            const node = range.startContainer;

            let prevRubyElement;
            const prevSibling = node.getPrevious();
            if (isRubyNode(prevSibling )) {
                prevRubyElement = prevSibling;
            } else if (isZwsAnchorAfterRuby(prevSibling)) {
                const prevPrevSibling = prevSibling.getPrevious();
                if (isRubyNode(prevPrevSibling)) {
                    prevRubyElement = prevPrevSibling;
                }
            }
            if (prevRubyElement) {
                var rtElement = prevRubyElement.findOne('rt');
                if (!rtElement) {
                    return false;
                }

                editor.fire('lockSnapshot');
                try {
                    ensureRtAnchors(rtElement);
                    placeCaretAtRtStart(rtElement);
                } finally {
                    editor.fire('unlockSnapshot');
                }

                return true;
            }
            return false;
        }


        /**
         * When user presses 'Delete' in the ruby where everything is already deleted:
         * ruby itself will be deleted, but zero-width space after it will not.
         * So, clean-up this orphan zero-space. Override native 'Delete' behavior for that.
         * @param {CKEDITOR.dom.selection} selection
         * @param {Number} keyCode
         * @returns {Boolean}
         */
        function guardLastDeleteInRuby(selection, keyCode) {
            if ((keyCode !== keyCodeDelete) || !selection || !selection.isCollapsed()) {
                return false;
            }

            var range = selection.getRanges()[0];
            if (!range) {
                return false;
            }

            const node = range.startContainer;

            const nextSibling  = node.getNext();
            if (isRubyNode(nextSibling)) {
                const rubyElement = nextSibling;
                var rtElement = rubyElement.findOne('rt');
                var rbElement = rubyElement.findOne('rb');
                if ((rtElement && !isEffectivelyEmpty(rtElement)) || (rbElement && !isEffectivelyEmpty(rbElement))) {
                    return false;
                }

                editor.fire('saveSnapshot');
                editor.fire('lockSnapshot');
                try {
                    const elementAfterRuby = rubyElement.getNext();
                    rubyElement.remove();
                    cleanupZwsAnchor(elementAfterRuby);
                } finally {
                    editor.fire('unlockSnapshot');
                }

                return true;
            }
            return false;
        }

        function isRubyNode(node) {
            return node && node.getName && node.getName() === 'ruby';
        }

        function isZwsAnchorAfterRuby(node) {
            return node &&
                node.type === CKEDITOR.NODE_TEXT &&
                node.getText().startsWith(zeroWidthSpace);
        }

        /**
         * Restore zero-width space anchor after ruby
         * (After editor initialized, or after Undo)
         */
        function ensureZwsAnchorsAfterRuby() {
            if (isRestoringZwsAnchor) {
                return;
            }

            var rubyList = editor.document.find('ruby');
            if (!rubyList.count()) {
                return;
            }

            isRestoringZwsAnchor = true;
            editor.fire('lockSnapshot');
            try {
                for (var i = 0; i < rubyList.count(); i++) {
                    var rubyElement = rubyList.getItem(i);
                    var next = rubyElement.getNext();

                    if (isZwsAnchorAfterRuby(next)) {
                        continue;
                    }
                    insertZwsAnchorAfterRuby(rubyElement);
                }
            } finally {
                editor.fire('unlockSnapshot');
                isRestoringZwsAnchor = false;
            }
        }

        function insertZwsAnchorAfterRuby(rubyElement) {
            var zwsAnchor = new CKEDITOR.dom.text(zeroWidthSpace, editor.document);
            zwsAnchor.insertAfter(rubyElement);
        }

        /**
         * @param {Node} startNode
         * @param {Boolean} byClick
         * @param {Selection} selection
         * @returns {boolean}
         */
        function deleteRubyIfNoRt(startNode, byClick, selection) {
            var rubyElement = startNode.getAscendant('ruby');
            if (!rubyElement) {
                return false;
            }
            var rbElements = rubyElement.find('rb');
            var rtElements = rubyElement.find('rt');
            var rbElement = rbElements.count() ? rbElements.getItem(0) : null;
            var rtElement = rtElements.count() ? rtElements.getItem(0) : null;
            var range;
            if ((rbElement && !rtElement) || (byClick && rbElement && rtElement && isEffectivelyEmpty(rtElement))) {
                // if rt is deleted
                // of if click on toolbar button check that it is empty
                // remove ruby, put base as text
                editor.fire('saveSnapshot');
                editor.fire('lockSnapshot');
                try {
                    var baseText = rbElement ? rbElement.getText() : '';
                    var replacement = new CKEDITOR.dom.text(baseText, editor.document);
                    replacement.replace(rubyElement);
                    if (!byClick) {
                        // keep caret on the base text
                        range = new CKEDITOR.dom.range(editor.document);
                        range.selectNodeContents(replacement);
                        selection.selectRanges([range]);
                    }
                    editor.updateElement();
                    editor.fire('change');
                } finally {
                    editor.fire('unlockSnapshot');
                }
                return true;
            }
        }

        /**
         * Change command state according to the current selection content
         * @param {CkEditor} editor - ckEditor instance
         */
        function refreshCommandState(editor) {
            var command = editor.getCommand(commandName);
            var selection = editor.getSelection();
            var range = selection.getRanges()[0];
            if (!otherButtons.length) {
                editor.toolbar.forEach(function (element) {
                    if (element.items && element.items.length) {
                        element.items.forEach(function (item) {
                            if (item.command && item.command !== commandName) {
                                otherButtons.push(item.command);
                            } else if (!item.command && typeof item.setState !== 'undefined') {
                                combos.push(item);
                            }
                        });
                    }
                });
            }

            function setButtonsState(state) {
                otherButtons.forEach(function (button) {
                    // Refresh not applied properly
                    editor.getCommand(button).setState(!state);
                    editor.getCommand(button).setState(state);
                });
                combos.forEach(function (combo) {
                    combo.setState(state);
                });
            }

            if (command) {
                if (furiganaCanBeCreated(editor)) {
                    command.setState(CKEDITOR.TRISTATE_OFF);
                    setButtonsState(CKEDITOR.TRISTATE_OFF);
                } else if (selection.getRanges()[0] && isInFugirana(range.startContainer)) {
                    if (deleteRubyIfNoRt(range.startContainer, false, selection)) {
                        command.setState(CKEDITOR.TRISTATE_DISABLED);
                        setButtonsState(CKEDITOR.TRISTATE_OFF);
                    } else {
                        command.setState(CKEDITOR.TRISTATE_ON);
                        setTimeout(function () {
                            setButtonsState(CKEDITOR.TRISTATE_DISABLED);
                        }, 150);
                    }
                } else {
                    command.setState(CKEDITOR.TRISTATE_DISABLED);
                    setButtonsState(CKEDITOR.TRISTATE_OFF);
                }
            }
        }

        /**
         * Remove empty ruby nodes when rt contains no user-visible content.
         * @param {CkEditor} editor - ckEditor instance
         * @param {Boolean} useSnapshots - Wrap ruby unwrapping with snapshot lock.
         * @returns {boolean}
         */
        function cleanupEmptyRubyElements(editor, useSnapshots) {
            var rubyElements = editor.document.find('ruby');
            var modified = false;

            for (var i = 0; i < rubyElements.count(); i++) {
                var ruby = rubyElements.getItem(i);
                var rtElements = ruby.find('rt');
                var rtElement = rtElements.count() ? rtElements.getItem(0) : null;

                if (rtElement && isEffectivelyEmpty(rtElement)) {
                    var rbElements = ruby.find('rb');
                    if (useSnapshots) {
                        editor.fire('saveSnapshot');
                        editor.fire('lockSnapshot');
                    }

                    try {
                        var nextSibling = ruby.getNext();
                        cleanupZwsAnchor(nextSibling);

                        var rbItem = rbElements.count() ? rbElements.getItem(0) : null;
                        if (!rbItem) {
                            ruby.remove();
                        } else {
                            var rbInnerHtml = rbItem.$.innerHTML;
                            var replacement;
                            try {
                                replacement = CKEDITOR.dom.element.createFromHtml(rbInnerHtml, editor.document);
                            } catch (err) {
                                replacement = null;
                            }
                            if (!replacement || replacement.type === CKEDITOR.NODE_TEXT) {
                                replacement = new CKEDITOR.dom.text(rbItem.getText(), editor.document);
                            }
                            replacement.replace(ruby);
                        }

                        modified = true;
                    } finally {
                        if (useSnapshots) {
                            editor.fire('unlockSnapshot');
                        }
                    }
                }
            }

            return modified;
        }

        function cleanupZwsAnchor(node) {
            if (isZwsAnchorAfterRuby(node)) {
                if (node.getText().length === 1) {
                    node.remove();
                } else {
                    node.setText(node.getText().substring(1));
                }
            }
        }

        // Create the command that can be used to apply the style.
        editor.addCommand(commandName, {
            exec: function (editor) {
                var selection = editor.getSelection(),
                    curRange = selection.getRanges()[0],
                    startNode = curRange.startContainer,
                    rubyElement,
                    rbElement,
                    rtElement,
                    range;
                if (isInFugirana(startNode)) {
                    rubyElement = startNode.getAscendant('ruby');
                    rbElement = rubyElement.find('rb');
                    if (deleteRubyIfNoRt(startNode, true)) {
                        refreshCommandState(editor);
                    } else {
                        editor.fire('saveSnapshot');
                        editor.fire('lockSnapshot');

                        try {
                            var baseTextContent = '';
                            var rbNode = rbElement.getItem(0);
                            if (rbNode) {
                                baseTextContent = rbNode.getText();
                            }

                            var textNode = new CKEDITOR.dom.text(baseTextContent, editor.document);

                            textNode.replace(rubyElement);

                            range = new CKEDITOR.dom.range(editor.document);
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            selection.selectRanges([range]);

                            var nextSibling = textNode.getNext();
                            cleanupZwsAnchor(nextSibling);

                            editor.updateElement();
                            editor.fire('change');
                            refreshCommandState(editor);
                        } finally {
                            editor.fire('unlockSnapshot');
                        }
                    }
                } else if (furiganaCanBeCreated(editor)) {
                    editor.fire('saveSnapshot');
                    editor.fire('lockSnapshot');

                    rubyElement = new CKEDITOR.dom.element('ruby', editor.document);
                    rbElement = new CKEDITOR.dom.element('rb', editor.document);
                    rbElement.append(getSelectionContent(selection));
                    rtElement = new CKEDITOR.dom.element('rt', editor.document);
                    rubyElement.append(rbElement);
                    rubyElement.append(rtElement);

                    // keep a zero-width placeholder in the live DOM so rt remains editable.
                    var rtAnchors = ensureRtAnchors(rtElement);

                    editor.insertElement(rubyElement);

                    // Chrome (version >= 128): it's impossible to select the first character after ruby. So add zero-width space after ruby. Can be added also inside ruby, after rt.
                    insertZwsAnchorAfterRuby(rubyElement);

                    // place the caret inside the rt start placeholder.
                    range = new CKEDITOR.dom.range(editor.document);
                    range.setStart(rtAnchors.startAnchor, 1);
                    range.collapse(true);
                    editor.getSelection().removeAllRanges();
                    editor.getSelection().selectRanges([range]);
                    refreshCommandState(editor);

                    editor.fire('unlockSnapshot');
                }
            }
        });
        editor.on('instanceReady', function () {
            var editable = editor.editable();
            var command = editor.getCommand(commandName);
            command.setState(CKEDITOR.TRISTATE_DISABLED);

            editable.attachListener(CKEDITOR.document, 'mouseup', function () {
                refreshCommandState(editor);
            });
            editable.attachListener(editable, 'focus', function (evt) {
                var target = evt && evt.data && evt.data.getTarget ? evt.data.getTarget() : null;
                normalizeCaret(target);
            });
            editable.attachListener(editable, 'keyup', function () {
                refreshCommandState(editor);
            });
            editable.attachListener(editable, 'keydown', function (evt) {
                var domEvent = evt && evt.data && evt.data.$ ? evt.data.$ : null;
                var keyCode = domEvent ? domEvent.keyCode : null;
                var selection = editor.getSelection();

                if (
                    guardRtLeadingDelete(selection, keyCode) ||
                    guardBackspaceAfterRuby(selection, keyCode) ||
                    guardLastDeleteInRuby(selection, keyCode)
                ) {
                    if (evt && evt.data && evt.data.preventDefault) {
                        evt.data.preventDefault();
                    }
                    editor.fire('change');
                    refreshCommandState(editor);
                }
            });
            editor.on('selectionChange', function () {
                normalizeCaret();
            });
        });
        editor.on('dataReady', function () {
            ensureZwsAnchorsAfterRuby();
        });
        editor.on('getData', function(evt) {
            evt.data.dataValue = sanitizeRubyData(evt.data.dataValue);
        });
        editor.on('blur', function () {
            var modified = cleanupEmptyRubyElements(editor, true);
            //update editor textarea
            if (modified) {
                //
                editor.updateElement();

                editor.fire('change');

                refreshCommandState(editor);
            }
        });
        editor.ui.addButton('TaoFurigana', {
            label: editor.lang[commandName].button,
            command: commandName,
            icon: this.path + 'images/taofurigana.png'
        });
    }
});
