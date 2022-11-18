CKEDITOR.plugins.add('taofurigana', {
	lang: 'en', // %REMOVE_LINE_CORE%
  init : function(editor){
		'use strict';

		var commandName = 'rubyFurigana';
		var containsTag;
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
		 * @returns {CKEDITOR.dom.node|null}
		 */
		function isInFigurana(node) {
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

				return range.toString().trim() !== ''
					&& isValidRange(range)
					&& !containsTag;
			}
			return false;
		}
		/**
		 * @param {CkEditor} editor - ckEditor instance
		 */
		function furiganaCanBeCreated(editor) {
			var selection = editor.getSelection();
			var nativeSelection = selection.getNative();

			return nativeSelection !== null && canInsert(selection)&& isWrappable(nativeSelection);
		}

		/**
		 * @param {Selection} selection
		 * @returns {boolean}
		 */
		function canInsert(selection) {
			return !isSelectionEmpty(selection) && selection.getRanges()[0] && !isInFigurana(selection.getRanges()[0].startContainer) ;
		}
		/**
		 * Change command state according to the current selection content
		 * @param {CkEditor} editor - ckEditor instance
		 */
		function refreshCommandState(editor) {
			var command = editor.getCommand(commandName);
      var selection = editor.getSelection();

			if (command) {
				if (furiganaCanBeCreated(editor)) {
					command.setState(CKEDITOR.TRISTATE_OFF);
				} else if (selection.getRanges()[0] && isInFigurana(selection.getRanges()[0].startContainer)) {
						command.setState(CKEDITOR.TRISTATE_ON);
				} else {
					command.setState(CKEDITOR.TRISTATE_DISABLED);
				}
			}
		}
		// Create the command that can be used to apply the style.
		editor.addCommand(commandName, {
			exec: function (editor) {
				var config = editor.config.taoQtiItem,
					selection = editor.getSelection(),
					curRange = selection.getRanges()[0],
					startNode = curRange.startContainer,
					rubyElement,
					rbElement,
					rtElement,
					range,
					emptyElement,
					rbHtml;
				if (isInFigurana(startNode)) {
					rubyElement = startNode.getAscendant('ruby');
					console.log('rubyElement ', rubyElement);
					if (rubyElement.$.children.length === 2 && startNode.$.nextSibling === null && curRange.endOffset + 1 >= startNode.$.length) {
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
					} else if (rubyElement.$.children.length === 1 && rubyElement.$.children[0].nodeName === 'RB') {
						// rt was removed, we need to remove ryby wrapper on rb
						editor.fire( 'saveSnapshot' );
						editor.fire( 'lockSnapshot' );
						rbHtml = new CKEDITOR.dom.text(rubyElement.$.children[0].innerHTML);
						rbHtml.replace(rubyElement);
						refreshCommandState(editor);
						editor.fire( 'unlockSnapshot' );
					}
				}
				else if (furiganaCanBeCreated(editor) && typeof (config.insert) === 'function') {
					editor.fire( 'saveSnapshot' );
					editor.fire( 'lockSnapshot' );

					rubyElement = new CKEDITOR.dom.element('ruby', editor.document);
					rbElement = new CKEDITOR.dom.element('rb', editor.document);
					rbElement.append(getSelectionContent(selection));
					rtElement = new CKEDITOR.dom.element('rt', editor.document);
					rtElement.appendHtml('&nbsp;');
					rubyElement.append(rbElement);
					rubyElement.append(rtElement);

					editor.insertElement(rubyElement);

					// move cursor inside <rt>^</rt> Element
					range = new CKEDITOR.dom.range(editor.document);
					range.moveToElementEditablePosition(rtElement);
					editor.getSelection().selectRanges([range]);
					refreshCommandState(editor);

					editor.fire( 'unlockSnapshot' );
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
		editor.ui.addButton('TaoFurigana', {
			label : editor.lang[commandName].button,
			command : commandName,
			icon : this.path + 'images/taofurigana.png'
		});
	}
});
