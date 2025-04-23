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
			// Make sure the element is valid and has required methods
			if (!element || typeof element.getName !== 'function' || typeof element.getAttribute !== 'function') {
				return false;
			}
			
			try {
				// Any div without data-qti-class is considered a potential wrapper
				// But we specifically look for divs with certain class patterns
				if (element.getName() === 'div' && !element.getAttribute('data-qti-class')) {
					// Check for explicit custom-interaction-wrapper class
					if (typeof element.hasClass === 'function' && element.hasClass('custom-interaction-wrapper')) {
						return true;
					}
					
					// Any div that directly contains an interaction element and has no QTI attributes
					// should be considered a wrapper
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
			// Make sure the element is valid and has getAttribute method
			if (!element || typeof element.getAttribute !== 'function') {
				return false;
			}
			
			try {
				var qtiClass = element.getAttribute('data-qti-class');
				return qtiClass && qtiClass.indexOf('Interaction') > -1;
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
				// Reset existing references
				editor.interactionElement = null;
				editor.interactionWrapper = null;
				
				// First try to find from selection
				var selection = editor.getSelection();
				var selectedElement = selection && selection.getStartElement();
				
				if (selectedElement) {
					console.log('Looking for interaction starting from selected element:', selectedElement);
					var result = findInteractionFromElement(selectedElement);
					
					if (result) {
						console.log('Found interaction from selection:', editor.interactionElement);
						return true;
					}
				}
				
				// If not found, scan the entire editable area
				var editable = editor.editable();
				if (editable) {
					console.log('Scanning entire editable area for interactions');
					if (scanForInteractions(editable)) {
						console.log('Found interaction from scanning editable:', editor.interactionElement);
						return true;
					}
				}
				
				console.log('No interaction found in the editor');
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

				// First look up through the parent chain
				while (parent && !interactionFound) {
					// Check if it's an interaction element
					if (isInteractionElement(parent)) {
						interactionFound = true;
						
						// Store the interaction element
						editor.interactionElement = parent;
						
						// Check if the parent of this interaction is a custom wrapper div
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
					// If we find a wrapper div first, we'll still look for an interaction within it
					else if (isCustomWrapperDiv(parent)) {
						wrapperDiv = parent;
					}

					if (typeof parent.getParent === 'function') {
						parent = parent.getParent();
					} else {
						// Break the loop if we can't get parent
						break;
					}
				}
				
				// If we didn't find an interaction but we did find a wrapper,
				// check if it contains an interaction as a direct child
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
				// First check if this element itself is an interaction or a wrapper
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

		// Listen for selection changes to track interactions
		editor.on('selectionChange', function() {
			findInteractionAndWrapper();
		});
		
		// Register the interaction finder for external use
		editor.findInteractionAndWrapper = findInteractionAndWrapper;
	}
});
