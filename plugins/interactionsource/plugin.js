CKEDITOR.plugins.add('interactionsource', {
	lang: 'en',
	requires: 'dialog',
	icons: 'sourcedialog,sourcedialog-rtl',
	hidpi: true,

	init: function(editor) {
		editor.addCommand('interactionsource', new CKEDITOR.dialogCommand('interactionsourcedialog'));
		CKEDITOR.dialog.add('interactionsourcedialog', this.path + 'dialogs/interactionsource.js');

		editor.ui.addButton('InteractionSource', {
			label: editor.lang.interactionsource.toolbar,
			command: 'interactionsource',
			icon: 'sourcedialog',
			toolbar: 'mode,11'
		});

		/**
		 * Check if element is a custom wrapper div (not a QTI element)
		 * @param {CKEDITOR.dom.element} element - The element to check
		 * @returns {Boolean} true if it's a custom wrapper div
		 */
		function isCustomWrapperDiv(element) {
			if (!element || typeof element.getName !== 'function' || typeof element.getAttribute !== 'function') {
				return false;
			}

			try {
				if (element.getName() === 'div' && !element.getAttribute('data-qti-class')) {
					if (typeof element.hasClass === 'function' && element.hasClass('custom-interaction-wrapper')) {
						return true;
					}

					if (typeof element.getChildren === 'function') {
						var children = element.getChildren();
						for (var i = 0; i < children.count(); i++) {
							var child = children.getItem(i);
							if (isInteractionElement(child)) {
								return true;
							}
						}
					}
				}
				return false;
			} catch (e) {
				console.error('Error in isCustomWrapperDiv:', e);
				return false;
			}
		}

		/**
		 * Checks if the element is an interaction
		 * @param {CKEDITOR.dom.element} element - The element to check
		 * @returns {Boolean} true if it's an interaction element
		 */
		function isInteractionElement(element) {
			if (!element || typeof element.getAttribute !== 'function') {
				return false;
			}

			try {
				return element.getAttribute('data-serial') && element.getAttribute('data-qti-class');
			} catch (e) {
				console.error('Error in isInteractionElement:', e);
				return false;
			}
		}

		/**
		 * Find and store the interaction and its wrapper in the editor
		 * This can be called directly when needed
		 */
		function findInteractionAndWrapper() {
			try {
				editor.interactionElement = null;
				editor.interactionWrapper = null;

				var selection = editor.getSelection();
				var selectedElement = selection && selection.getStartElement();

				if (selectedElement) {
					var result = findInteractionFromElement(selectedElement);

					if (result) {
						return true;
					}
				}

				var editable = editor.editable();
				if (editable) {
					if (scanForInteractions(editable)) {
						return true;
					}
				}

				return false;
			} catch (e) {
				console.error('Error in findInteractionAndWrapper:', e);
				return false;
			}
		}

		/**
		 * Find an interaction starting from the given element
		 * @param {CKEDITOR.dom.element} startElement - Element to start from
		 * @returns {Boolean} - Whether an interaction was found
		 */
		function findInteractionFromElement(startElement) {
			if (!startElement) return false;

			try {
				var parent = startElement;
				var interactionFound = false;
				var wrapperDiv = null;

				while (parent && !interactionFound) {
					if (isInteractionElement(parent)) {
						interactionFound = true;

						editor.interactionElement = parent;

						if (typeof parent.getParent === 'function') {
							var potentialWrapper = parent.getParent();
							if (isCustomWrapperDiv(potentialWrapper)) {
								editor.interactionWrapper = potentialWrapper;
							} else {
								editor.interactionWrapper = null;
							}
						} else {
							editor.interactionWrapper = null;
						}
					}
					else if (isCustomWrapperDiv(parent)) {
						wrapperDiv = parent;
					}

					if (typeof parent.getParent === 'function') {
						parent = parent.getParent();
					} else {
						break;
					}
				}

				if (!interactionFound && wrapperDiv && typeof wrapperDiv.getChildren === 'function') {
					var children = wrapperDiv.getChildren();
					for (var i = 0; i < children.count(); i++) {
						var child = children.getItem(i);
						if (isInteractionElement(child)) {
							editor.interactionElement = child;
							editor.interactionWrapper = wrapperDiv;
							interactionFound = true;
							break;
						}
					}
				}

				return interactionFound;
			} catch (e) {
				console.error('Error in findInteractionFromElement:', e);
				return false;
			}
		}

		/**
		 * Scan an element and its children for interactions
		 * @param {CKEDITOR.dom.element} element - Element to scan
		 * @returns {Boolean} - Whether an interaction was found
		 */
		function scanForInteractions(element) {
			if (!element) {
				return false;
			}

			try {
				if (isInteractionElement(element)) {
					editor.interactionElement = element;

					if (typeof element.getParent === 'function') {
						var parent = element.getParent();
						if (isCustomWrapperDiv(parent)) {
							editor.interactionWrapper = parent;
						} else {
							editor.interactionWrapper = null;
						}
					} else {
						editor.interactionWrapper = null;
					}
					return true;
				}

				if (isCustomWrapperDiv(element)) {
					if (typeof element.getChildren === 'function') {
						var children = element.getChildren();
						for (var i = 0; i < children.count(); i++) {
							var child = children.getItem(i);
							if (isInteractionElement(child)) {
								editor.interactionElement = child;
								editor.interactionWrapper = element;
								return true;
							}
						}
					}
				}

				// Then recursively check children
				if (typeof element.getChildren === 'function') {
					var children = element.getChildren();
					for (var i = 0; i < children.count(); i++) {
						if (scanForInteractions(children.getItem(i))) {
							return true;
						}
					}
				}

				return false;
			} catch (e) {
				console.error('Error in scanForInteractions:', e);
				return false;
			}
		}

		editor.on('selectionChange', function() {
			findInteractionAndWrapper();
		});

		editor.findInteractionAndWrapper = findInteractionAndWrapper;
	}
});
