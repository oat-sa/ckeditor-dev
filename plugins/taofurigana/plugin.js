CKEDITOR.plugins.add('taofurigana', {
	lang: 'en', // %REMOVE_LINE_CORE%
	init: function (editor) {
		'use strict';

		var commandName = 'rubyFurigana';
		var containsTag;
		var otherButtons = [];
		var combos = [];

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
				currentNode, i;

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
			return !isSelectionEmpty(selection) && selection.getRanges()[0] && !isInFugirana(selection.getRanges()[0].startContainer);
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
			var rbElement = rubyElement.find('rb');
			var rtElement = rubyElement.find('rt');
			var range;
			if (rbElement.$.length && !rtElement.$.length ||
				byClick && rbElement.$.length && rtElement.$.length && !rtElement.$[0].innerText.trim()) {
				// if rt is deleted
				// of if click on toolbar button check that it is empty
				// remove ruby, put base as text
				editor.fire('saveSnapshot');
				editor.fire('lockSnapshot');
				var rbHtml = new CKEDITOR.dom.element.createFromHtml(rbElement.$[0].innerHTML);
				rbHtml.replace(rubyElement);
				if (!byClick) {
					// select base text, to avoid know issue with delete key https://dev.ckeditor.com/ticket/9998
					// new text will be wrapped in <span style="font-size: 7px;">...</span>
					range = new CKEDITOR.dom.range(editor.document);
					range.selectNodeContents(rbHtml);
					selection.selectRanges([range]);
				}
				editor.fire('unlockSnapshot');
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
							} else if (!item.command && typeof item.setState !== "undefined") {
								combos.push(item);
							}
						});
					}
				});
			}

			function setButtonsState(state) {
				otherButtons.forEach(function (button) {
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

		// Create the command that can be used to apply the style.
		editor.addCommand(commandName, {
			exec: function (editor) {
				var selection = editor.getSelection(),
					curRange = selection.getRanges()[0],
					startNode = curRange.startContainer,
					rubyElement,
					rbElement,
					rtElement,
					range,
					zeroWidthSpace,
					emptyElement;
				if (isInFugirana(startNode)) {
					rubyElement = startNode.getAscendant('ruby');
					rbElement = rubyElement.find('rb');
					rtElement = rubyElement.find('rt');
					if (deleteRubyIfNoRt(startNode, true)) {
						refreshCommandState(editor);
					} else if (rbElement.$.length && rtElement.$.length && startNode.getParent().$ === rtElement.$[0] &&
						startNode.$.nextSibling === null && curRange.endOffset + 1 >= startNode.$.length) {
						// if in the end of rt text
						// move cursor outside ruby element
						range = new CKEDITOR.dom.range(editor.document);
						if (!rubyElement.$.nextSibling) {
							range.moveToClosestEditablePosition(rubyElement, true)
							selection.selectRanges([range]);
							refreshCommandState(editor);
						} else {
							emptyElement = new CKEDITOR.dom.text(CKEDITOR.dom.selection.FILLING_CHAR_SEQUENCE);
							emptyElement.insertAfter(rubyElement);
							range.moveToElementEditablePosition(emptyElement);
							selection.selectRanges([range]);
							refreshCommandState(editor);
						}
					}
				} else if (furiganaCanBeCreated(editor)) {
					editor.fire('saveSnapshot');
					editor.fire('lockSnapshot');

					rubyElement = new CKEDITOR.dom.element('ruby', editor.document);
					rbElement = new CKEDITOR.dom.element('rb', editor.document);
					rbElement.append(getSelectionContent(selection));
					rtElement = new CKEDITOR.dom.element('rt', editor.document);
					rtElement.appendHtml('&nbsp;');
					rubyElement.append(rbElement);
					rubyElement.append(rtElement);

					// create a temporary element for binding the cursor
					var anchor = new CKEDITOR.dom.element('span', editor.document);
					rtElement.append(anchor);
					rtElement.appendHtml('&nbsp;');

					editor.insertElement(rubyElement);
					// add a zero-width space for the better navigation in Chrome (version >= 128) to the next sibling
					zeroWidthSpace = new CKEDITOR.dom.text('\u200b', editor.document);
					rubyElement.append(zeroWidthSpace);

					// move cursor inside the anchor
					range = new CKEDITOR.dom.range(editor.document);
					range.setStart(anchor, 0);
					range.collapse(true);
					editor.getSelection().removeAllRanges();
					editor.getSelection().selectRanges([range]);
					refreshCommandState(editor);

					editor.fire('unlockSnapshot');
					// remove anchor
					anchor.remove();
				}
			}
		});
		editor.on('instanceReady', function () {
			var editable = editor.editable();
			var command = editor.getCommand(commandName);
			command.setState(CKEDITOR.TRISTATE_DISABLED);

			editable.attachListener(editable, 'mouseup', function () {
				refreshCommandState(editor);
			});
			editable.attachListener(editable, 'keyup', function () {
				refreshCommandState(editor);
			});

			editor.on('blur', function () {
				// Get all ruby elements in the editor
				var rubyElements = editor.document.find('ruby');
				for (var i = 0; i < rubyElements.count(); i++) {
					var ruby = rubyElements.getItem(i);
					var rtElement = ruby.find('rt');

					// Check if the rt element is empty
					if (rtElement.$.length && rtElement.$[0].innerText.trim() === '') {
						var rbElement = ruby.find('rb');
						if (rbElement.$.length) {
							var rbHtml = new CKEDITOR.dom.element.createFromHtml(rbElement.$[0].innerHTML);
							rbHtml.replace(ruby);
							editor.fire('unlockSnapshot');
							refreshCommandState(editor);
						}
					}
				}
			});
		});
		editor.ui.addButton('TaoFurigana', {
			label: editor.lang[commandName].button,
			command: commandName,
			icon: this.path + 'images/taofurigana.png'
		});
	}
});
