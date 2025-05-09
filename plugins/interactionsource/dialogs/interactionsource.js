CKEDITOR.dialog.add('interactionsourcedialog', function (editor) {
	var config = {
		size: {
			width: Math.min(CKEDITOR.document.getWindow().getViewPaneSize().width - 70, 800),
			height: CKEDITOR.document.getWindow().getViewPaneSize().height / 1.5
		},
		placeholderTemplate: '{{wrapperDivs}}<interaction_{{serialId}}>\n{{closingDivs}}',
		simpleTemplate: '<interaction_{{serialId}}>',
		css: {
			wrapperInfo: 'margin-bottom: 10px; padding: 5px; border-left: 3px solid #ccc; background-color: #f9f9f9;',
			example: 'margin: 3px 0 0; color: #666; font-style: italic;',
			codeBlock: 'display: block; margin-top: 5px; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; font-family: monospace;',
			textarea: 'cursor:auto; width:100%; min-width:{{width}}px; max-width:unset; height:{{height}}px; tab-size:4; text-align:left; font-family:monospace;',
			errorMessage: 'padding: 8px; margin-top: 8px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;'
		},
		boundaryClasses: ['col-12', 'grid-row', 'qti-itemBody', 'item-editor-drop-area']
	};

	var state = {
		oldData: null,
		validationError: null
	};

	/**
	 * Simple HTML validation for common errors
	 * @param {String} html - The HTML to validate
	 * @returns {Object} - Object with isValid flag and error message if any
	 */
	function validateHtml(html) {
		var lang = editor.lang.interactionsource;
		var result = {
			isValid: true,
			error: null
		};

		try {
			if (html.indexOf('<interaction_') === -1) {
				result.isValid = false;
				result.error = lang.missingInteraction;
				return result;
			}

			var openDivs = (html.match(/<div/g) || []).length;
			var closeDivs = (html.match(/<\/div>/g) || []).length;

			if (openDivs !== closeDivs) {
				result.isValid = false;
				if (openDivs > closeDivs) {
					result.error = lang.missingClosingTag + ': ' +
						lang.missingDivClosingTags.replace('{0}', (openDivs - closeDivs));
				} else {
					result.error = lang.missingOpeningTag + ': ' +
						lang.missingDivOpeningTags.replace('{0}', (closeDivs - openDivs));
				}
				return result;
			}

			var invalidTagMatch = html.match(/<\/?([a-z][a-z0-9_]*)[^>]*>/gi);
			if (invalidTagMatch) {
				var validHtmlTags = ['div', 'span', 'p', 'br', 'hr', 'strong', 'em', 'i', 'b', 'u', 's', 'code', 'pre'];
				var invalidTags = [];

				for (var i = 0; i < invalidTagMatch.length; i++) {
					var tag = invalidTagMatch[i].match(/<\/?([a-z][a-z0-9_]*)[^>]*>/i);
					if (tag && tag[1]) {
						var tagName = tag[1].toLowerCase();

						if (tagName.indexOf('interaction_') === 0) {
							continue;
						}

						if (validHtmlTags.indexOf(tagName) === -1 && invalidTags.indexOf(tagName) === -1) {
							invalidTags.push(tagName);
						}
					}
				}

				if (invalidTags.length > 0) {
					result.isValid = false;
					result.error = lang.invalidTags + ': ' + invalidTags.join(', ');
					return result;
				}
			}

			var stack = [];
			var lines = html.split('\n');
			for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
				var line = lines[lineIndex];
				var tagMatches = line.match(/<\/?([a-z][a-z0-9_]*)[^>]*>/gi);

				if (tagMatches) {
					for (var j = 0; j < tagMatches.length; j++) {
						var tagMatch = tagMatches[j];

						if (tagMatch.indexOf('/>') !== -1) {
							continue;
						}

						if (tagMatch.indexOf('<interaction_') === 0 || tagMatch.indexOf('</interaction_') === 0) {
							continue;
						}

						if (tagMatch.indexOf('</') === 0) {
							var closingTag = tagMatch.match(/<\/([a-z][a-z0-9_]*)[^>]*>/i);
							if (closingTag && closingTag[1]) {
								var closingTagName = closingTag[1].toLowerCase();

								if (stack.length === 0 || stack.pop() !== tagName) {
									result.isValid = false;
									result.error = lang.unmatchedClosingTag + ': ' + closingTagName +
										' (' + lang.line + ' ' + (lineIndex + 1) + ')';
									return result;
								}
							}
						}
						else {
							var openingTag = tagMatch.match(/<([a-z][a-z0-9_]*)[^>]*>/i);
							if (openingTag && openingTag[1]) {
								var openingTagName = openingTag[1].toLowerCase();
								stack.push(openingTagName);
							}
						}
					}
				}
			}

			if (stack.length > 0) {
				result.isValid = false;
				result.error = lang.unclosedTags + ': ' + stack.join(', ');
				return result;
			}

			return result;
		} catch (e) {
			result.isValid = false;
			result.error = lang.generalValidationError + ': ' + e.message;
			return result;
		}
	}

	/**
	 * Update the error message in the dialog
	 * @param {CKEDITOR.dialog} dialog - The dialog instance
	 * @param {String|null} errorMessage - The error message or null to clear
	 */
	function updateErrorMessage(dialog, errorMessage) {
		var errorContainer = dialog.getContentElement('main', 'errorContainer');

		if (errorContainer && errorContainer.getElement()) {
			var element = errorContainer.getElement();

			if (errorMessage) {
				var safeErrorHtml = '<div style="' + config.css.errorMessage + '">' +
					'<strong>' + editor.lang.interactionsource.validationError + ':</strong> ' +
					errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
					'</div>';

				element.setHtml(safeErrorHtml);
				element.show();
			} else {
				element.setHtml('');
				element.hide();
			}
		}

		state.validationError = errorMessage;
	}

	/**
	 * Validate the current HTML in the dialog
	 * @param {CKEDITOR.dialog} dialog - The dialog instance
	 * @returns {Boolean} - True if HTML is valid
	 */
	function validateDialog(dialog) {
		var html = dialog.getValueOf('main', 'data');
		var validation = validateHtml(html);

		updateErrorMessage(dialog, validation.isValid ? null : validation.error);

		return validation.isValid;
	}

	/**
	 * Template rendering helper
	 * @param {String} template - The template string with {{placeholders}}
	 * @param {Object} data - The data to inject into the template
	 * @returns {String} - The rendered template
	 */
	function renderTemplate(template, data) {
		return template.replace(/\{\{(\w+)}}/g, function(match, key) {
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
	 * Check if element is a boundary element where we should stop collecting wrappers
	 * @param {CKEDITOR.dom.element} element - The element to check
	 * @returns {Boolean} - True if element is a boundary
	 */
	function isBoundaryElement(element) {
		if (!element || !canCall(element, 'getName') || element.getName() !== 'div') {
			return false;
		}

		var className = getAttr(element, 'class', '');
		var dataUnits = getAttr(element, 'data-units', '');

		if (className.indexOf('col-12') !== -1 && dataUnits === '12') {
			return true;
		}

		for (var i = 0; i < config.boundaryClasses.length; i++) {
			if (className.indexOf(config.boundaryClasses[i]) !== -1) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Collect all wrapper divs up to a boundary element
	 * @param {CKEDITOR.dom.element} interactionElement - The interaction element
	 * @returns {Object|null} An object with wrapper elements and placeholder, or null if no wrapper found
	 */
	function collectAllWrappers(interactionElement) {
		refreshInteractionReference();

		if (!interactionElement || !canCall(interactionElement, 'getName')) {
			return null;
		}

		var wrappers = [];
		var current = interactionElement;
		var maxDepth = 10; // Prevent infinite loops

		while (current && maxDepth > 0) {
			var parent = canCall(current, 'getParent') ? current.getParent() : null;

			if (!parent) {
				break;
			}

			if (canCall(parent, 'getName') && parent.getName() === 'div') {
				if (isBoundaryElement(parent)) {
					break;
				}

				if (!getAttr(parent, 'data-qti-class') && !getAttr(parent, 'data-html-editable')) {
					wrappers.push(parent);
				}
			}

			current = parent;
			maxDepth--;
		}

		if (wrappers.length > 0) {
			return createMultiWrapperInfo(wrappers, interactionElement);
		}

		return null;
	}

	/**
	 * Create wrapper info object with all nested wrappers
	 * @param {Array} wrappers - Array of wrapper elements (outermost last)
	 * @param {CKEDITOR.dom.element} interaction - The interaction element
	 * @returns {Object} - Object with wrappers and placeholder
	 */
	function createMultiWrapperInfo(wrappers, interaction) {
		var serialId = getAttr(interaction, 'data-serial');
		serialId = normalizeSerialId(serialId);

		var wrapperDivs = '';
		var closingDivs = '';

		for (var i = wrappers.length - 1; i >= 0; i--) {
			var wrapper = wrappers[i];
			var className = getAttr(wrapper, 'class', '');
			var id = getAttr(wrapper, 'id', '');
			var dataAttrs = collectDataAttributes(wrapper);

			wrapperDivs += '<div';
			if (className) {
				wrapperDivs += ' class="' + className + '"';
			}
			if (id) {
				wrapperDivs += ' id="' + id + '"';
			}
			if (dataAttrs) {
				wrapperDivs += dataAttrs;
			}
			wrapperDivs += '>\n';

			closingDivs += '</div>\n';
		}

		return {
			wrappers: wrappers,
			placeholder: renderTemplate(config.placeholderTemplate, {
				wrapperDivs: wrapperDivs,
				serialId: serialId,
				closingDivs: closingDivs
			})
		};
	}

	/**
	 * Collect all data- attributes from an element
	 * @param {CKEDITOR.dom.element} element - The element
	 * @returns {String} - String of data attributes
	 */
	function collectDataAttributes(element) {
		var result = '';
		if (!element || !canCall(element, 'getAttributes')) {
			return result;
		}

		try {
			var attributes = element.getAttributes();
			for (var attrName in attributes) {
				if (attrName.indexOf('data-') === 0 && attrName !== 'data-qti-class') {
					result += ' ' + attrName + '="' + attributes[attrName] + '"';
				}
			}
		} catch (e) {
			console.error('Error collecting data attributes:', e);
		}

		return result;
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
		if (!validateDialog(dialog)) {
			return false;
		}

		editor.focus();
		try {
			var newData = dialog.getValueOf('main', 'data');

			if (!newData) {
				throw new Error(editor.lang.interactionsource.noEditedData);
			}

			var interactionEl = editor.interactionElement;
			if (!interactionEl) {
				throw new Error(editor.lang.interactionsource.noInteractionFound);
			}

			var fragment = CKEDITOR.htmlParser.fragment.fromHtml(newData);
			var hasWrapperDiv = fragment.children.length === 1 &&
				fragment.children[0].name === 'div';

			if (hasWrapperDiv) {
				var wrapperDiv = fragment.children[0];
				editor.lastWrapperClass = wrapperDiv.attributes && wrapperDiv.attributes['class'] || '';
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
			updateErrorMessage(dialog, editor.lang.interactionsource.updateError + ': ' + e.message);
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
			'&lt;div class="outer-wrapper"&gt;<br>' +
			'&nbsp;&nbsp;&lt;div class="middle-wrapper"&gt;<br>' +
			'&nbsp;&nbsp;&nbsp;&nbsp;&lt;div class="inner-wrapper"&gt;<br>' +
			'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;interaction_serial_number&gt;<br>' +
			'&nbsp;&nbsp;&nbsp;&nbsp;&lt;/div&gt;<br>' +
			'&nbsp;&nbsp;&lt;/div&gt;<br>' +
			'&lt;/div&gt;</code></p>' +
			'<p style="' + config.css.example + '"><em>' + lang.styleEditorNote + '</em></p>' +
			'</div>';
	}

	/**
	 * Get the placeholder text based on wrapper status
	 * @param {CKEDITOR.dom.element} interactionElement - The interaction element
	 * @returns {String} - The placeholder text to display in the dialog
	 */
	function getPlaceholderText(interactionElement) {
		var serialId = getAttr(interactionElement, 'data-serial');
		serialId = normalizeSerialId(serialId);

		var wrapperInfo = collectAllWrappers(interactionElement);

		if (wrapperInfo) {
			return wrapperInfo.placeholder;
		} else {
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
				showErrorDialog(editor, editor.lang.interactionsource.noInteractionFound);
				setTimeout(function () {
					dialog.hide();
				}, 0);
				return;
			}

			try {
				var placeholder = getPlaceholderText(interactionElement);
				this.setValueOf('main', 'data', placeholder);
				state.oldData = placeholder;

				updateErrorMessage(dialog, null);
			} catch (e) {
				console.error('Error getting simplified interaction HTML:', e);
				showErrorDialog(editor, editor.lang.interactionsource.retrieveError + ': ' + e.message);
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

			if (!validateDialog(that)) {
				return false;
			}

			return applyChanges(that);
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
					'class': 'cke_source',
					onKeyUp: function() {
						validateDialog(this.getDialog());
					}
				},
				{
					type: 'html',
					id: 'errorContainer',
					html: '',
					style: 'display:none'
				}
			]
		}]
	};
});
