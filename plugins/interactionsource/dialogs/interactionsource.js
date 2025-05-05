CKEDITOR.dialog.add('interactionsourcedialog', function (editor) {
	var config = {
		size: {
			width: Math.min(CKEDITOR.document.getWindow().getViewPaneSize().width - 70, 800),
			height: CKEDITOR.document.getWindow().getViewPaneSize().height / 1.5
		},
		placeholderTemplate: '<div class="{{className}}">\n<interaction_{{serialId}}>\n</div>',
		simpleTemplate: '<interaction_{{serialId}}>',
		css: {
			wrapperInfo: 'margin-bottom: 10px; padding: 5px; border-left: 3px solid #ccc; background-color: #f9f9f9;',
			example: 'margin: 3px 0 0; color: #666; font-style: italic;',
			codeBlock: 'display: block; margin-top: 5px; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; font-family: monospace;',
			textarea: 'cursor:auto; width:100%; min-width:{{width}}px; max-width:unset; height:{{height}}px; tab-size:4; text-align:left; font-family:monospace;'
		}
	};

	var state = {
		oldData: null
	};

	/**
	 * Template rendering helper
	 * @param {String} template - The template string with {{placeholders}}
	 * @param {Object} data - The data to inject into the template
	 * @returns {String} - The rendered template
	 */
	function renderTemplate(template, data) {
		return template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
			return data[key] !== undefined ? data[key] : match;
		});
	}

	/**
	 * Show an error dialog or fallback to alert
	 * @param {CKEDITOR.editor} editor - The editor instance
	 * @param {String} message - The error message
	 * @param {Function} [callback] - Optional callback when dialog is closed
	 */
	function showErrorDialog(editor, message, callback) {
		if (CKEDITOR.plugins.get('alertdialog')) {
			editor.openDialog('alertdialog', function (dialog) {
				dialog.setValueOf('info', 'msg', message);
				if (callback) {
					dialog.once('hide', callback);
				}
			});
		} else {
			alert(message);
			if (callback) {
				callback();
			}
		}
	}

	/**
	 * Safely access DOM element properties
	 * @param {Object} obj - The object to check
	 * @param {String} method - The method to check for
	 * @returns {Boolean} - True if method exists and is a function
	 */
	function canCall(obj, method) {
		return obj && typeof obj[method] === 'function';
	}

	/**
	 * Safely get an attribute from an element
	 * @param {CKEDITOR.dom.element} element - The element
	 * @param {String} attribute - The attribute to get
	 * @param {String} [defaultValue=''] - Default value if attribute doesn't exist
	 * @returns {String} - The attribute value or default
	 */
	function getAttr(element, attribute, defaultValue) {
		defaultValue = defaultValue || '';
		if (canCall(element, 'getAttribute')) {
			try {
				var value = element.getAttribute(attribute);
				return value !== null ? value : defaultValue;
			} catch (e) {
				return defaultValue;
			}
		}
		return defaultValue;
	}

	/**
	 * Normalize an interaction's serial ID to ensure it has the correct format
	 * @param {String} serialId - The original serial ID
	 * @returns {String} - The normalized serial ID
	 */
	function normalizeSerialId(serialId) {
		return serialId || '';
	}

	/**
	 * Checks if the interaction element is wrapped in a custom div
	 * @param {CKEDITOR.dom.element} interactionElement - The interaction element
	 * @returns {Object|null} An object with wrapper element and placeholder, or null if no wrapper found
	 */
	function checkForWrapper(interactionElement) {
		refreshInteractionReference();

		if (!interactionElement || !canCall(interactionElement, 'getName')) {
			return null;
		}

		if (editor.interactionWrapper) {
			return createWrapperInfo(
				editor.interactionWrapper,
				interactionElement
			);
		}

		var parent = canCall(interactionElement, 'getParent') ? interactionElement.getParent() : null;
		if (parent && isWrapperElement(parent)) {
			return createWrapperInfo(parent, interactionElement);
		}

		var possibleWrapper = findClosestWrapperDiv(interactionElement);
		if (possibleWrapper) {
			return createWrapperInfo(possibleWrapper, interactionElement);
		}

		return null;
	}

	/**
	 * Create wrapper info object with standardized format
	 * @param {CKEDITOR.dom.element} wrapper - The wrapper element
	 * @param {CKEDITOR.dom.element} interaction - The interaction element
	 * @returns {Object} - Object with wrapper and placeholder
	 */
	function createWrapperInfo(wrapper, interaction) {
		var className = getAttr(wrapper, 'class');
		var serialId = getAttr(interaction, 'data-serial');

		serialId = normalizeSerialId(serialId);

		return {
			wrapper: wrapper,
			placeholder: renderTemplate(config.placeholderTemplate, {
				className: className,
				serialId: serialId
			})
		};
	}

	/**
	 * Check if an element is a wrapper div (not a QTI element)
	 * @param {CKEDITOR.dom.element} element - The element to check
	 * @returns {Boolean} - True if element is a wrapper
	 */
	function isWrapperElement(element) {
		if (!element) return false;

		try {
			if (!canCall(element, 'getName') || element.getName() !== 'div') {
				return false;
			}

			if (getAttr(element, 'data-qti-class')) {
				return false;
			}

			var className = getAttr(element, 'class', '');
			var structuralClasses = ['col-', 'grid-row', 'qti-itemBody', 'item-editor-drop-area'];

			for (var i = 0; i < structuralClasses.length; i++) {
				if (className.indexOf(structuralClasses[i]) !== -1) {
					return false;
				}
			}

			if (getAttr(element, 'data-units')) {
				return false;
			}

			if (canCall(element, 'hasClass') && element.hasClass('custom-interaction-wrapper')) {
				return true;
			}

			if (canCall(element, 'getChildren')) {
				var children = element.getChildren();
				for (var i = 0; i < children.count(); i++) {
					var child = children.getItem(i);
					if (canCall(child, 'getAttribute') &&
					    (child.getAttribute('data-qti-class') ||
					     (child.getAttribute('data-serial') && child.getAttribute('data-serial').indexOf('interaction_') === 0))) {
						return true;
					}
				}
			}

			return false;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Find the closest wrapper div by checking parent elements
	 * @param {CKEDITOR.dom.element} element - The element to start from
	 * @returns {CKEDITOR.dom.element|null} The wrapper div or null if not found
	 */
	function findClosestWrapperDiv(element) {
		if (!canCall(element, 'getParent')) {
			return null;
		}

		try {
			var current = element;
			var maxDepth = 5;

			while (current && maxDepth > 0) {
				var parent = current.getParent();

				if (isWrapperElement(parent)) {
					if ((canCall(parent, 'hasClass') && parent.hasClass('custom-interaction-wrapper')) ||
						(getAttr(parent, 'class') &&
						!getAttr(parent, 'data-serial') &&
						!getAttr(parent, 'data-html-editable'))) {
						return parent;
					}
				}

				current = parent;
				maxDepth--;
			}

			return null;
		} catch (e) {
			console.error('Error in findClosestWrapperDiv:', e);
			return null;
		}
	}

	/**
	 * Ensure we have the latest interaction references
	 */
	function refreshInteractionReference() {
		if (canCall(editor, 'findInteractionAndWrapper')) {
			editor.findInteractionAndWrapper();
		}
	}

	/**
	 * Apply changes from the dialog to the editor
	 * @param {CKEDITOR.dialog} dialog - The dialog instance
	 * @returns {Boolean} - True if changes were applied successfully
	 */
	function applyChanges(dialog) {
		editor.focus();
		try {
			var newData = dialog.getValueOf('main', 'data');

			if (!newData) {
				throw new Error('No edited data available');
			}

			var interactionEl = editor.interactionElement;
			if (!interactionEl) {
				throw new Error('Interaction element not found.');
			}

			var fragment = CKEDITOR.htmlParser.fragment.fromHtml(newData);
			var hasWrapperDiv = fragment.children.length === 1 &&
				fragment.children[0].name === 'div';

			if (hasWrapperDiv) {
				var wrapperDiv = fragment.children[0];
				editor.lastWrapperClass = wrapperDiv.attributes && wrapperDiv.attributes.class || '';
			}

			editor.lastInteractionHasWrapper = hasWrapperDiv;

			dialog.hide();

			editor.fire('pluginContentModified', {
				html: newData,
				pluginName: 'interactionsourcedialog'
			});

			return true;
		} catch (e) {
			console.error('Error applying changes:', e);
			var errorMessage = 'Error updating interaction: ' + e.message;
			showErrorDialog(editor, errorMessage);
			return false;
		}
	}

	/**
	 * Get HTML content for the wrapper example
	 * @returns {String} - HTML for the wrapper example
	 */
	function getWrapperExampleHTML() {
		var lang = editor.lang.interactionsource;

		return '<div id="interaction-wrapper-info" style="' + config.css.wrapperInfo + '">' +
			'<p style="' + config.css.example + '">' + lang.wrapperExample + '<br>' +
			'<code style="' + config.css.codeBlock + '">' +
			'&lt;div class="foobar"&gt;<br>' +
			'&nbsp;&nbsp;&lt;interaction_serial_number&gt;<br>' +
			'&lt;/div&gt;</code></p>' +
			'<p style="' + config.css.example + '"><em>' + lang.styleEditorNote + '</em></p>' +
			'</div>';
	}

	/**
	 * Get the placeholder text based on wrapper status
	 * @param {CKEDITOR.dom.element} interactionElement - The interaction element
	 * @param {Object} wrapperInfo - Wrapper information if exists
	 * @returns {String} - The placeholder text to display in the dialog
	 */
	function getPlaceholderText(interactionElement, wrapperInfo) {
		var serialId = getAttr(interactionElement, 'data-serial');

		serialId = normalizeSerialId(serialId);

		if (editor.lastInteractionHasWrapper && editor.lastWrapperClass && !wrapperInfo) {
			return renderTemplate(config.placeholderTemplate, {
				className: editor.lastWrapperClass,
				serialId: serialId
			});
		}
		else if (wrapperInfo) {
			return wrapperInfo.placeholder;
		}
		else {
			return renderTemplate(config.simpleTemplate, {
				serialId: serialId
			});
		}
	}

	return {
		title: editor.lang.interactionsource.title,
		minWidth: 600,
		minHeight: 400,
		resizable: CKEDITOR.DIALOG_RESIZE_BOTH,

		onShow: function () {
			var dialog = this;

			refreshInteractionReference();

			var interactionElement = editor.interactionElement;

			if (!interactionElement) {
				showErrorDialog(editor, 'No interaction found or not currently editing an interaction.');
				setTimeout(function () {
					dialog.hide();
				}, 0);
				return;
			}

			try {
				var wrapperInfo = checkForWrapper(interactionElement);
				var placeholder = getPlaceholderText(interactionElement, wrapperInfo);

				this.setValueOf('main', 'data', placeholder);
				state.oldData = placeholder;

			} catch (e) {
				console.error('Error getting simplified interaction HTML:', e);
				showErrorDialog(editor, 'Error retrieving simplified interaction HTML: ' + e.message);
				setTimeout(function () {
					dialog.hide();
				}, 0);
			}
		},

		onOk: function () {
			var newData = this.getValueOf('main', 'data').replace(/\r/g, '');
			var that = this;

			if (newData === state.oldData) {
				return true;
			}

			applyChanges(that);

			return false;
		},

		contents: [{
			id: 'main',
			label: editor.lang.interactionsource.title,
			elements: [
				{
					type: 'html',
					id: 'wrapperInfo',
					html: getWrapperExampleHTML()
				},
				{
					type: 'textarea',
					id: 'data',
					dir: 'ltr',
					inputStyle: renderTemplate(config.css.textarea, config.size),
					'class': 'cke_source'
				}
			]
		}]
	};
});
