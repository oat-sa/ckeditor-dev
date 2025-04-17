CKEDITOR.dialog.add('interactionsourcedialog', function (editor) {
	var size = CKEDITOR.document.getWindow().getViewPaneSize();
	var width = Math.min(size.width - 70, 800);
	var height = size.height / 1.5;
	var oldData;

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

	function applyChanges(dialog, newData) {
		editor.focus();
		try {
			newData = dialog.getValueOf('main', 'data');

			if (!newData) {
				throw new Error('No edited data available');
			}

			console.log('New data from dialog:', newData);

			var interactionEl = editor.interactionElement;
			if (!interactionEl) {
				throw new Error('Interaction element not found.');
			}

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

	return {
		title: editor.lang.interactionsource.title,
		minWidth: 600,
		minHeight: 400,
		resizable: CKEDITOR.DIALOG_RESIZE_BOTH,

		onShow: function () {
			var interactionElement = editor.interactionElement;
			var dialog = this;

			if (!interactionElement) {
				showErrorDialog(editor, 'No interaction found or not currently editing an interaction.');
				setTimeout(function () {
					dialog.hide();
				}, 0);
				return;
			}

			try {
				var placeholder = '<interaction_' + interactionElement.getAttribute('data-serial') + '>';
				this.setValueOf('main', 'data', placeholder);
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

			if (newData === oldData) {
				return true;
			}

			setTimeout(function () {
				applyChanges(that);
			});

			return false;
		},

		contents: [{
			id: 'main',
			label: editor.lang.interactionsource.title,
			elements: [
				{
					type: 'textarea',
					id: 'data',
					dir: 'ltr',
					inputStyle: 'cursor:auto;' +
						'width:100%;' +
						'min-width:' + width + 'px;' +
						'max-width:unset;' +
						'height:' + height + 'px;' +
						'tab-size:4;' +
						'text-align:left;' +
						'font-family:monospace;',
					'class': 'cke_source'
				}
			]
		}]
	};
});
