CKEDITOR.plugins.add('taofurigana', {
	lang: 'en', // %REMOVE_LINE_CORE%
	init: function (editor) {
		'use strict';

		var commandName = 'rubyFurigana';
		var zeroWidthSpace = '\u200b';
		var zeroWidthSpaceRegex = /\u200B/g;
		var rubyTopContentRegex = /(<rt\b[^>]*>)([\s\S]*?)(<\/rt>)/gi;
		var isNormalizingSelection = false;
		var isRestoringZwsAnchor = false;
		var isLastMousedownInsideEditor = false;
		var hasRuby = false; // to run listeners only if ruby is being used
		var containsTag;
		var statelessButtons = [];
		var statelessButtonsList = ['bold', 'italic', 'strike', 'spanUnderline', 'subscript', 'superscript'];
		var otherButtons = [];
		var combos = [];
		var keyCodeDelete = 46;
		var keyCodeBackspace = 8;
		var keyCodeLeftArrow = 37;
		var refreshCommandStateTimer = null;
		var disableToolbarButtonsTimer = null;
		var lastFuriganaCommandState = null;

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
		 * Make sure that the current selection is already inside rt of furigana/ruby
		 * @param {Node} node
		 * @returns {boolean}
		 */
		function isInRtFugirana(node) {
			if (!node) {
				return false;
			}

			return isInFugirana(node) && node.getAscendant('rt', true) !== null;
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
			return getEffectiveLength(rtElement) === 0;
		}

		/**
		 * @param {CKEDITOR.dom.element} rtElement
		 * @returns {boolean}
		 */
		function getEffectiveLength(rtElement) {
			var textContent = rtElement.$.textContent || '';
			return textContent.replace(zeroWidthSpaceRegex, '').trim().length;
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
		 * Place caret at the end of rt (before the trailing ZWS anchor) so Backspace
		 * deletes furigana from the end of the reading.
		 * @param {CKEDITOR.dom.element} rtElement
		 */
		function placeCaretAtRtEnd(rtElement) {
			var anchors = ensureRtAnchors(rtElement);
			var selection = editor.getSelection();
			var range = new CKEDITOR.dom.range(editor.document);

			range.setStartBefore(anchors.endAnchor);
			range.collapse(true);
			selection.selectRanges([range]);
		}

		/**
		 * Keep hasRuby in sync so keydown/selection listeners stop after the last ruby is gone.
		 * Leaving it stuck true makes every Backspace run orphan-ZWS walks and feels laggy.
		 */
		function refreshHasRubyFlag() {
			var root = editor.editable() || editor.document;
			hasRuby = !!(root && root.find('ruby').count());
		}

		/**
		 * @param {CKEDITOR.dom.node} startNode
		 */
		function ensurePlaceholderForRt(startNode) {
			if (!startNode || !startNode.getAscendant) {
				return;
			}

			var rtElement = startNode.getAscendant('rt', true);

			// Do not re-seed ZWS into an empty rt — that causes Backspace to thrash
			// textLen 0↔1 forever (see INF-530 probe). New rubies get anchors at create time.
			if (rtElement && !isEffectivelyEmpty(rtElement)) {
				ensureRtAnchors(rtElement);
			}
		}

		/**
		 * Replace ruby with plain base text and put caret at the end of that text
		 * so further Backspace deletes the base word normally.
		 * @param {CKEDITOR.dom.element} rubyElement
		 * @param {CKEDITOR.dom.selection} [selection]
		 * @returns {CKEDITOR.dom.text|null}
		 */
		function unwrapRubyToBaseText(rubyElement, selection) {
			if (!rubyElement) {
				return null;
			}

			var rbElements = rubyElement.find('rb');
			var rbElement = rbElements.count() ? rbElements.getItem(0) : null;
			var replacement;

			if (!rbElement) {
				replacement = new CKEDITOR.dom.text('', editor.document);
			} else {
				// Preserve inline markup inside rb (same approach as cleanupEmptyRubyElements).
				var rbInnerHtml = rbElement.$.innerHTML.replace(zeroWidthSpaceRegex, '');
				try {
					replacement = rbInnerHtml
						? CKEDITOR.dom.element.createFromHtml(rbInnerHtml, editor.document)
						: null;
				} catch (err) {
					replacement = null;
				}
				if (!replacement || replacement.type === CKEDITOR.NODE_TEXT) {
					replacement = new CKEDITOR.dom.text(
						rbElement.getText().replace(zeroWidthSpaceRegex, ''),
						editor.document
					);
				}
			}

			replacement.replace(rubyElement);
			cleanupZwsAnchor(replacement.getNext());
			cleanupOrphanedZwsAfter(replacement);
			refreshHasRubyFlag();

			if (selection) {
				var range = new CKEDITOR.dom.range(editor.document);
				if (replacement.type === CKEDITOR.NODE_TEXT) {
					range.setStart(replacement, replacement.getText().length);
				} else {
					range.moveToElementEditEnd(replacement);
				}
				range.collapse(true);
				selection.selectRanges([range]);
			}

			return replacement;
		}

		/**
		 * When rt has no visible furigana left, Backspace/Delete should unwrap ruby
		 * instead of deleting ZWS anchors that ensureRtAnchors immediately re-inserts.
		 * @param {CKEDITOR.dom.selection} selection
		 * @param {Number} keyCode
		 * @returns {Boolean}
		 */
		function guardEmptyRtUnwrap(selection, keyCode) {
			if (
				(keyCode !== keyCodeBackspace && keyCode !== keyCodeDelete) ||
				!selection ||
				!selection.isCollapsed()
			) {
				return false;
			}

			var range = selection.getRanges()[0];
			if (!range || !range.startContainer || !range.startContainer.getAscendant) {
				return false;
			}

			var rtElement = range.startContainer.getAscendant('rt', true);
			if (!rtElement || !isEffectivelyEmpty(rtElement)) {
				return false;
			}

			var rubyElement = rtElement.getAscendant('ruby', true);
			if (!rubyElement) {
				return false;
			}

			editor.fire('saveSnapshot');
			editor.fire('lockSnapshot');
			try {
				unwrapRubyToBaseText(rubyElement, selection);
				editor.fire('change');
			} finally {
				editor.fire('unlockSnapshot');
			}

			return true;
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

			if (isEffectivelyEmpty(rtElement)) {
				return guardEmptyRtUnwrap(selection, keyCode);
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

				if (isEffectivelyEmpty(rtElement)) {
					var rubyElement = rtElement.getAscendant('ruby', true);
					unwrapRubyToBaseText(rubyElement, selection);
				} else {
					ensureRtAnchors(rtElement);
					placeCaretAtRtStart(rtElement);
				}
			} finally {
				editor.fire('unlockSnapshot');
			}

			return true;
		}
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

			// Base text (bottom): leave caret alone so Backspace/Delete stay responsive.
			if (startContainer.getAscendant('rb', true)) {
				return false;
			}

			var currentRtElement = startContainer.getAscendant('rt', true);
			if (currentRtElement) {
				if (isEffectivelyEmpty(currentRtElement)) {
					return false;
				}
				var isAtRtStart = range.startOffset === 0;
				// Only repair anchors when caret is on the leading edge; skip DOM work mid-rt.
				if (!isAtRtStart) {
					return false;
				}
				ensureRtAnchors(currentRtElement);
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

		function normalizeCaret(focusEventTarget) {
			var selection = editor.getSelection();
			normalizeCaretIntoRt(selection, focusEventTarget);
			var range = selection && selection.getRanges()[0];
			if (range) {
				ensurePlaceholderForRt(range.startContainer);
			}
		}

		/**
		 * @param {String} data
		 * @returns {String}
		 */
		function sanitizeRubyData(data) {
			return data
				.replace(rubyTopContentRegex, function (match, openingTag, content, closingTag) {
					return openingTag + content.replace(zeroWidthSpaceRegex, '') + closingTag;
				});
		}

		/**
		 * Next DOM node after `node`, crossing empty parents up to the editable
		 * so orphans separated by a line break / new block can be found.
		 * @param {CKEDITOR.dom.node} node
		 * @returns {CKEDITOR.dom.node|null}
		 */
		function getNextNodeCrossingBoundaries(node) {
			if (!node) {
				return null;
			}

			var next = node.getNext();
			if (next) {
				return next;
			}

			var parent = node.getParent();
			var editable = editor.editable();
			while (parent && editable && !parent.equals(editable)) {
				next = parent.getNext();
				if (next) {
					return next;
				}
				parent = parent.getParent();
			}

			return null;
		}

		/**
		 * True when node is a trailing-ruby ZWS that is no longer immediately after a ruby
		 * (e.g. Enter moved it onto the next line before ruby was removed).
		 * @param {CKEDITOR.dom.node} node
		 * @returns {Boolean}
		 */
		function isOrphanZwsAnchor(node) {
			return isZwsAnchorAfterRuby(node) && !isRubyNode(node.getPrevious());
		}

		/**
		 * Remove orphaned ZWS anchors that may sit after `fromNode`, including across
		 * `<br>` and the next block (ENTER_P / ENTER_BR line breaks).
		 * @param {CKEDITOR.dom.node} fromNode
		 * @returns {Boolean} true if an orphan ZWS was removed
		 */
		function cleanupOrphanedZwsAfter(fromNode) {
			if (!fromNode) {
				return false;
			}

			var node = getNextNodeCrossingBoundaries(fromNode);
			var guard = 0;

			while (node && guard < 50) {
				guard++;

				if (isOrphanZwsAnchor(node)) {
					cleanupZwsAnchor(node);
					return true;
				}

				if (isEmptyTextNode(node)) {
					node = getNextNodeCrossingBoundaries(node);
					continue;
				}

				if (node.type === CKEDITOR.NODE_ELEMENT) {
					var name = node.getName && node.getName();
					if (name === 'br') {
						node = getNextNodeCrossingBoundaries(node);
						continue;
					}

					var first = node.getFirst && node.getFirst();
					if (first) {
						if (isOrphanZwsAnchor(first)) {
							cleanupZwsAnchor(first);
							return true;
						}
						// Dive into the next block / wrapper to find a leading orphan ZWS.
						node = first;
						continue;
					}

					node = getNextNodeCrossingBoundaries(node);
					continue;
				}

				// Visible content — stop searching.
				break;
			}

			return false;
		}

		/**
		 * Chrome can delete a whole line when Backspace hits an orphan ZWS left after
		 * ruby removal across a line break. Strip that ZWS before native delete runs.
		 * @param {CKEDITOR.dom.selection} selection
		 * @param {Number} keyCode
		 * @returns {Boolean}
		 */
		function guardOrphanZwsBackspace(selection, keyCode) {
			if (keyCode !== keyCodeBackspace || !selection || !selection.isCollapsed()) {
				return false;
			}

			var range = selection.getRanges()[0];
			if (!range || !range.startContainer) {
				return false;
			}

			var startContainer = range.startContainer;
			var startOffset = range.startOffset;
			var cleaned = false;

			editor.fire('lockSnapshot');
			try {
				if (
					startContainer.type === CKEDITOR.NODE_TEXT &&
					isOrphanZwsAnchor(startContainer) &&
					startOffset <= 1
				) {
					cleanupZwsAnchor(startContainer);
					cleaned = true;
				} else if (startContainer.type === CKEDITOR.NODE_ELEMENT && startOffset === 0) {
					var child = startContainer.getChild(startOffset);
					if (isOrphanZwsAnchor(child)) {
						cleanupZwsAnchor(child);
						cleaned = true;
					}
				}

				// Only search across the boundary when the next node looks like an orphan ZWS,
				// so normal Backspace at end-of-word is not delayed after ruby was removed.
				if (!cleaned) {
					var atEndOfText =
						startContainer.type === CKEDITOR.NODE_TEXT &&
						startOffset >= startContainer.getText().length;
					var atEndOfBlock = range.checkEndOfBlock && range.checkEndOfBlock();

					if (atEndOfText || atEndOfBlock) {
						var next = getNextNodeCrossingBoundaries(startContainer);
						var nextFirst = next && next.type === CKEDITOR.NODE_ELEMENT && next.getFirst ? next.getFirst() : null;
						if (isOrphanZwsAnchor(next) || isOrphanZwsAnchor(nextFirst)) {
							cleaned = cleanupOrphanedZwsAfter(startContainer);
						}
					}
				}
			} finally {
				editor.fire('unlockSnapshot');
			}

			return cleaned;
		}

		/**
		 * Chrome issue: if caret is after ruby, and:
		 *  - you press 'Backspace' -> *all content* before caret position gets deleted, not only ruby.
		 *  - you press 'LeftArrow' -> caret moves to the very beginning of the content.
		 * So, need to override native behavior for these keys. Place caret at end of rt so
		 * Backspace continues deleting the reading from the end (Mac Delete = Backspace).
		 * @param {CKEDITOR.dom.selection} selection
		 * @param {Number} keyCode
		 * @returns {Boolean}
		 */
		function guardBackspaceOrLeftArrowAfterRuby(selection, keyCode) {
			if (
				(keyCode !== keyCodeBackspace && keyCode !== keyCodeLeftArrow) ||
				!selection ||
				!selection.isCollapsed()
			) {
				return false;
			}

			var range = selection.getRanges()[0];
			if (!range) {
				return false;
			}

			var rubyElement = findAdjacentRuby(range, false);
			if (rubyElement) {
				var rtElement = rubyElement.findOne('rt');
				if (!rtElement) {
					return false;
				}

				// Empty reading: unwrap to base text instead of entering a ZWS-only rt.
				if (keyCode === keyCodeBackspace && isEffectivelyEmpty(rtElement)) {
					editor.fire('saveSnapshot');
					editor.fire('lockSnapshot');
					try {
						unwrapRubyToBaseText(rubyElement, selection);
						editor.fire('change');
					} finally {
						editor.fire('unlockSnapshot');
					}
					return true;
				}

				editor.fire('lockSnapshot');
				try {
					ensureRtAnchors(rtElement);
					placeCaretAtRtEnd(rtElement);
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
			if ((keyCode !== keyCodeDelete && keyCode !== keyCodeBackspace) || !selection || !selection.isCollapsed()) {
				return false;
			}

			var range = selection.getRanges()[0];
			if (!range || !range.startContainer) {
				return false;
			}

			var deleteDirectionToNext = keyCode === keyCodeDelete;
			var rubyElement = range.startContainer.getAscendant('ruby');
			if (!rubyElement) {
				rubyElement = findAdjacentRuby(range, deleteDirectionToNext);
			}
			if (rubyElement) {
				var rtElement = rubyElement.findOne('rt');
				var rbElement = rubyElement.findOne('rb');
				var rtLength = rtElement ? getEffectiveLength(rtElement) : 0;
				var rbLength = rbElement ? getEffectiveLength(rbElement) : 0;
				if (rtLength + rbLength > 1) {
					return false;
				}

				editor.fire('saveSnapshot');
				editor.fire('lockSnapshot');
				try {
					var previousNode = rubyElement.getPrevious();
					var parentNode = rubyElement.getParent();
					var elementAfterRuby = rubyElement.getNext();
					rubyElement.remove();
					cleanupZwsAnchor(elementAfterRuby);
					cleanupOrphanedZwsAfter(previousNode || parentNode);
					refreshHasRubyFlag();
				} finally {
					editor.fire('unlockSnapshot');
				}

				return true;
			}
			return false;
		}

		/**
		 * Pressing Left inside rt when only zero-width anchors precede the caret would keep
		 * the caret trapped in rt; move it to just before the ruby instead.
		 * @param {CKEDITOR.dom.selection} selection
		 * @param {Number} keyCode
		 * @returns {Boolean}
		 */
		function guardLeftArrowFromRtLeadingZws(selection, keyCode) {
			if (keyCode !== keyCodeLeftArrow || !selection || !selection.isCollapsed()) {
				return false;
			}

			var range = selection.getRanges()[0];
			if (!range || !range.startContainer) {
				return false;
			}

			var startContainer = range.startContainer;
			if (startContainer.type === CKEDITOR.NODE_TEXT && startContainer.getAscendant('rt', true)) {
				var beforeCaret = startContainer.getText().substring(0, range.startOffset);
				var rtElement = startContainer.getAscendant('rt', true);
				var rubyElement = startContainer.getAscendant('ruby', true);
				if (
					rubyElement &&
					rtElement.getFirst().equals(startContainer) &&
					!beforeCaret.replace(zeroWidthSpaceRegex, '').length
				) {
					if (!rubyElement.getPrevious()) {
						return true;
					} else {
						editor.fire('lockSnapshot');
						try {
							var caretRange = new CKEDITOR.dom.range(editor.document);
							caretRange.moveToPosition(rubyElement, CKEDITOR.POSITION_BEFORE_START);
							selection.selectRanges([caretRange]);
						} finally {
							editor.fire('unlockSnapshot');
							return true;
						}
					}
				}
			}
			return false;
		}

		/**
		 *
		 * @param {CKEDITOR.dom.range} range
		 * @param {boolean} searchNext - if true, find adjacent ruby after the range. If false, before the range.
		 * @returns {CKEDITOR.dom.element|null}
		 */
		function findAdjacentRuby(range, searchNext) {
			if (searchNext) {
				var node = range.getBoundaryNodes().endNode;
				var isAtTheEndOfNode = node && range.checkBoundaryOfElement(node, CKEDITOR.END);
				if (isAtTheEndOfNode) {
					var nextSibling = node.getNext();
					if (isRubyNode(nextSibling)) {
						return nextSibling;
					}
				}
			} else {
				//searchPrevious
				var node = range.startContainer;
				var offset = range.startOffset;
				if (node.type !== CKEDITOR.NODE_TEXT) {
					node = range.getBoundaryNodes().startNode;
					if (node.type === CKEDITOR.NODE_TEXT && (!node.getText().length || range.checkBoundaryOfElement(node, CKEDITOR.END))) {
						offset = node.getText().length;
					} else {
						return null;
					}
				}
				var prevSibling = node.getPrevious();
				if (prevSibling) {
					if (isRubyNode(prevSibling) && isZwsAnchorAfterRuby(node) && offset <= 1) {
						return prevSibling;
					} else if (isEmptyTextNode(node) && offset === 0) {
						var prevPrevSibling = prevSibling.getPrevious();
						if (
							isRubyNode(prevPrevSibling) &&
							isZwsAnchorAfterRuby(prevSibling) &&
							prevSibling.getText().length <= 1
						) {
							return prevPrevSibling;
						}
					}
				}
			}
		}

		function isRubyNode(node) {
			return node && node.getName && node.getName() === 'ruby';
		}

		function isZwsAnchorAfterRuby(node) {
			if (node && node.type === CKEDITOR.NODE_TEXT) {
				var text = node.getText();
				return text.length >= 1 && text[0] === zeroWidthSpace && text[1] !== zeroWidthSpace;
			}
			return false;
		}

		function isEmptyTextNode(node) {
			if (node && node.type === CKEDITOR.NODE_TEXT) {
				return !node.getText().length;
			}
			return false;
		}

		/**
		 * Restore zero-width space anchor after ruby
		 * (After editor initialized, or after Undo)
		 */
		function ensureZwsAnchorsAfterRuby() {
			if (isRestoringZwsAnchor) {
				return;
			}

			var root = editor.editable() || editor.document || editor.element;
			var rubyList = root && root.find ? root.find('ruby') : null;
			if (!rubyList || !rubyList.count()) {
				hasRuby = false;
				return;
			}

			hasRuby = true;
			isRestoringZwsAnchor = true;
			editor.fire('lockSnapshot');
			try {
				for (var i = 0; i < rubyList.count(); i++) {
					var rubyElement = rubyList.getItem(i);
					var next = rubyElement.getNext();

					if (isZwsAnchorAfterRuby(next)) {
						continue;
					}
					// if bold/italic/underline was used over selection with ruby,
					// zero-space will get inside the wrapper: '<ruby>...</ruby><em>\u200b</em>'
					// remove orphan zero-space from there and readd it after the ruby.
					// (NB! we can't reliably know if it's "our" zero-space or not, but let's assume it is...)
					if (next && next.getFirst && isZwsAnchorAfterRuby(next.getFirst())) {
						cleanupZwsAnchor(next.getFirst());
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

		function isSelectionBeforeZwsAnchorOfRt(selection) {
			if (!selection || !selection.isCollapsed()) {
				return false;
			}
			var range = selection.getRanges()[0];
			var node = range.startContainer;
			if (
				range.startOffset === 0 &&
				node &&
				node.type === CKEDITOR.NODE_TEXT &&
				node.getAscendant('rt', true) &&
				node.getText().startsWith(zeroWidthSpace)
			) {
				return true;
			}
			return false;
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
			if ((rbElement && !rtElement) || (byClick && rbElement && rtElement && isEffectivelyEmpty(rtElement))) {
				// if rt is deleted
				// of if click on toolbar button check that it is empty
				// remove ruby, put base as text
				editor.fire('saveSnapshot');
				editor.fire('lockSnapshot');
				try {
					unwrapRubyToBaseText(rubyElement, byClick ? null : selection);
					editor.fire('change');
				} finally {
					editor.fire('unlockSnapshot');
				}
				return true;
			}
		}

		/**
		 * Change command state according to the current selection content.
		 * Debounced: uncanceled setTimeout(150) on every keyup was stacking and making
		 * Backspace/Delete feel progressively slower until blur drained the queue.
		 * @param {CkEditor} editor - ckEditor instance
		 * @param {Boolean} [immediate]
		 */
		function refreshCommandState(editor, immediate) {
			if (!immediate) {
				if (refreshCommandStateTimer) {
					clearTimeout(refreshCommandStateTimer);
				}
				refreshCommandStateTimer = setTimeout(function () {
					refreshCommandStateTimer = null;
					refreshCommandStateNow(editor);
				}, 50);
				return;
			}

			if (refreshCommandStateTimer) {
				clearTimeout(refreshCommandStateTimer);
				refreshCommandStateTimer = null;
			}
			refreshCommandStateNow(editor);
		}

		/**
		 * @param {CkEditor} editor - ckEditor instance
		 */
		function refreshCommandStateNow(editor) {
			var command = editor.getCommand(commandName);
			var selection = editor.getSelection();
			var range = selection && selection.getRanges()[0];
			if (!otherButtons.length && editor.toolbar) {
				editor.toolbar.forEach(function (element) {
					if (element.items && element.items.length) {
						element.items.forEach(function (item) {
							if (item.command && item.command !== commandName) {
								otherButtons.push(item.command);
								if (statelessButtonsList.includes(item.command)) {
									statelessButtons.push(item);
								}
							} else if (!item.command && typeof item.setState !== 'undefined') {
								combos.push(item);
							}
						});
					}
				});
			}

			function setButtonsState(state) {
				otherButtons.forEach(function (button) {
					var cmd = editor.getCommand(button);
					if (cmd && cmd.state !== state) {
						cmd.setState(state);
					}
				});
				combos.forEach(function (combo) {
					if (combo.getState && combo.getState() !== state) {
						combo.setState(state);
					} else if (!combo.getState) {
						combo.setState(state);
					}
				});
			}

			function scheduleDisableToolbarButtons() {
				if (disableToolbarButtonsTimer) {
					clearTimeout(disableToolbarButtonsTimer);
				}
				disableToolbarButtonsTimer = setTimeout(function () {
					disableToolbarButtonsTimer = null;
					setButtonsState(CKEDITOR.TRISTATE_DISABLED);
					statelessButtons.forEach(function (button) {
						button.setState(CKEDITOR.TRISTATE_OFF);
					});
				}, 150);
			}

			if (!command) {
				return;
			}

			if (furiganaCanBeCreated(editor)) {
				if (lastFuriganaCommandState !== CKEDITOR.TRISTATE_OFF) {
					command.setState(CKEDITOR.TRISTATE_OFF);
					setButtonsState(CKEDITOR.TRISTATE_OFF);
					lastFuriganaCommandState = CKEDITOR.TRISTATE_OFF;
				}
				if (disableToolbarButtonsTimer) {
					clearTimeout(disableToolbarButtonsTimer);
					disableToolbarButtonsTimer = null;
				}
			} else if (range && range.startContainer && isInFugirana(range.startContainer)) {
				// Only auto-unwrap empty rt when caret is in rt — not on every rb keystroke.
				if (isInRtFugirana(range.startContainer) && deleteRubyIfNoRt(range.startContainer, false, selection)) {
					command.setState(CKEDITOR.TRISTATE_DISABLED);
					setButtonsState(CKEDITOR.TRISTATE_OFF);
					lastFuriganaCommandState = CKEDITOR.TRISTATE_DISABLED;
					if (disableToolbarButtonsTimer) {
						clearTimeout(disableToolbarButtonsTimer);
						disableToolbarButtonsTimer = null;
					}
				} else if (lastFuriganaCommandState !== CKEDITOR.TRISTATE_ON) {
					command.setState(CKEDITOR.TRISTATE_ON);
					lastFuriganaCommandState = CKEDITOR.TRISTATE_ON;
					scheduleDisableToolbarButtons();
				}
			} else {
				if (lastFuriganaCommandState !== CKEDITOR.TRISTATE_DISABLED) {
					command.setState(CKEDITOR.TRISTATE_DISABLED);
					setButtonsState(CKEDITOR.TRISTATE_OFF);
					lastFuriganaCommandState = CKEDITOR.TRISTATE_DISABLED;
				}
				if (disableToolbarButtonsTimer) {
					clearTimeout(disableToolbarButtonsTimer);
					disableToolbarButtonsTimer = null;
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
							var previousNode = ruby.getPrevious();
							var parentNode = ruby.getParent();
							ruby.remove();
							cleanupOrphanedZwsAfter(previousNode || parentNode);
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
							cleanupOrphanedZwsAfter(replacement);
						}

						refreshHasRubyFlag();
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
							unwrapRubyToBaseText(rubyElement, selection);
							editor.fire('change');
							refreshCommandState(editor);
						} finally {
							editor.fire('unlockSnapshot');
						}
					}
				} else if (furiganaCanBeCreated(editor)) {
					hasRuby = true;

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
				if (isLastMousedownInsideEditor) {
					isLastMousedownInsideEditor = false;
					refreshCommandState(editor, true);

					if (hasRuby) {
						var selection = editor.getSelection();
						if (isSelectionBeforeZwsAnchorOfRt(selection)) {
							normalizeCaret(selection);
						}
					}
				}
			});
			editable.attachListener(editable, 'mousedown', function () {
				isLastMousedownInsideEditor = true;
			});
			editable.attachListener(editable, 'focus', function (evt) {
				if (hasRuby) {
					var target = evt && evt.data && evt.data.getTarget ? evt.data.getTarget() : null;
					normalizeCaret(target);
				}
			});
			editable.attachListener(editable, 'keyup', function () {
				refreshCommandState(editor);
			});
			editable.attachListener(editable, 'keydown', function (evt) {
				if (!hasRuby) {
					return;
				}

				var domEvent = evt && evt.data && evt.data.$ ? evt.data.$ : null;
				var keyCode = domEvent ? domEvent.keyCode : null;
				var selection = editor.getSelection();
				var contentChanged = false;
				var caretOnly = false;

				if (guardEmptyRtUnwrap(selection, keyCode) || guardOrphanZwsBackspace(selection, keyCode) || guardRtLeadingDelete(selection, keyCode) || guardLastDeleteInRuby(selection, keyCode)) {
					contentChanged = true;
				} else if (guardLeftArrowFromRtLeadingZws(selection, keyCode) || guardBackspaceOrLeftArrowAfterRuby(selection, keyCode)) {
					caretOnly = true;
				}

				if (contentChanged || caretOnly) {
					if (evt && evt.data && evt.data.preventDefault) {
						evt.data.preventDefault();
					}
					if (contentChanged) {
						editor.fire('change');
					}
					refreshCommandState(editor);
				}
			});
			// Do not call ensureZwsAnchorsAfterRuby here — every caret move during delete
			// would re-enter DOM work. ZWS restore runs on change/dataReady instead.
			editor.on('selectionChange', function () {
				if (!hasRuby) {
					return;
				}

				var selection = editor.getSelection();
				var range = selection && selection.getRanges()[0];
				var start = range && range.startContainer;
				// Editing the base (bottom) word: skip normalize entirely.
				if (start && start.getAscendant && start.getAscendant('rb', true)) {
					return;
				}

				normalizeCaret();
			});
		});
		editor.on('dataReady', function () {
			ensureZwsAnchorsAfterRuby();
			refreshHasRubyFlag();
		});
		editor.on('change', function () {
			if (hasRuby) {
				ensureZwsAnchorsAfterRuby();
				refreshHasRubyFlag();
			}
		});
		editor.on('getData', function (evt) {
			evt.data.dataValue = sanitizeRubyData(evt.data.dataValue);
		});
		editor.on('blur', function () {
			if (refreshCommandStateTimer) {
				clearTimeout(refreshCommandStateTimer);
				refreshCommandStateTimer = null;
			}
			if (disableToolbarButtonsTimer) {
				clearTimeout(disableToolbarButtonsTimer);
				disableToolbarButtonsTimer = null;
			}

			var modified = cleanupEmptyRubyElements(editor, true);
			//update editor textarea
			if (modified) {
				editor.updateElement();

				editor.fire('change');

				refreshCommandState(editor, true);
			}
			refreshHasRubyFlag();
		});
		editor.ui.addButton('TaoFurigana', {
			label: (editor.lang.rubyFurigana || editor.lang.taofurigana).button,
			command: commandName,
			icon: this.path + 'images/taofurigana.png'
		});
	}
});
