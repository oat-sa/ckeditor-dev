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

		editor.on('selectionChange', function() {
			var selection = editor.getSelection();
			var selectedElement = selection && selection.getStartElement();

			if (selectedElement) {
				var parent = selectedElement;
				var interactionFound = false;

				while (parent && !interactionFound) {
					if (parent.getAttribute('data-qti-class') &&
						parent.getAttribute('data-qti-class').indexOf('Interaction') > -1) {

						interactionFound = true;
						editor.interactionElement = parent;
					}

					parent = parent.getParent();
				}
			}
		});
	}
});
