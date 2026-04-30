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
				try {
					var rbNode = rbElement.count() ? rbElement.getItem(0) : null;
					var baseText = rbNode ? rbNode.getText() : '';
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
							} else if (!item.command && typeof item.setState !== "undefined") {
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
		 * Remove zero-width placeholders from rt and unwrap empty ruby nodes.
		 * @param {CkEditor} editor - ckEditor instance
		 * @param {Boolean} useSnapshots - Wrap ruby unwrapping with snapshot lock.
		 * @returns {boolean}
		 */
		function cleanupRubyElements(editor, useSnapshots) {
			var rubyElements = editor.document.find('ruby');
			var modified = false;

			for (var i = 0; i < rubyElements.count(); i++) {
				var ruby = rubyElements.getItem(i);
				var rtElement = ruby.find('rt');

				if (rtElement.$.length && rtElement.$[0].innerText.trim() === '') {
					var rbElement = ruby.find('rb');
					if (rbElement.$.length) {
						if (useSnapshots) {
							editor.fire('saveSnapshot');
							editor.fire('lockSnapshot');
						}

						try {
							var rbHtml = new CKEDITOR.dom.element.createFromHtml(rbElement.$[0].innerHTML);
							rbHtml.replace(ruby);
							modified = true;
						} finally {
							if (useSnapshots) {
								editor.fire('unlockSnapshot');
							}
						}
					}
				}
			}

			return modified;
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

					// create a temporary text node for cursor placement without spaces
					var rtPlaceholder = new CKEDITOR.dom.text('\u200b', editor.document);
					rtElement.append(rtPlaceholder);

					editor.insertElement(rubyElement);

					// move cursor inside rt placeholder text node
					range = new CKEDITOR.dom.range(editor.document);
					range.setStart(rtPlaceholder, 1);
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

			editable.attachListener(editable, 'mouseup', function () {
				refreshCommandState(editor);
			});
			editable.attachListener(editable, 'keyup', function () {
				refreshCommandState(editor);
			});
		});
		editor.on('getData', function(event) {
			if (event.data && typeof event.data.dataValue === 'string') {
				event.data.dataValue = event.data.dataValue.replace(/\u200B/g, '');
			}
		});
		editor.ui.addButton('TaoFurigana', {
			label: editor.lang[commandName].button,
			command: commandName,
			icon: this.path + 'images/taofurigana.png'
		});
	}
});
