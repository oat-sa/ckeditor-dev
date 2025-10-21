CKEDITOR.plugins.add('taostrike', {
	lang: 'de,en,fr,nl', // %REMOVE_LINE_CORE%
	init: function (editor) {
		var commandName = 'taoStrike',
			style = new CKEDITOR.style({
				element: 'span',
				attributes: { 'class': 'txt-strike' }
			}),
			forms = [
				's',
				[
					'span',
					function (el) {
						return el.styles['text-decoration'] === 'line-through';
					}
				]
			];

		// Put the style as the most important form.
		forms.unshift(style);

		editor.attachStyleStateChange(style, function (state) {
			!editor.readOnly && editor.getCommand(commandName).setState(state);
		});

		// Apply the style.
		editor.addCommand(
			commandName,
			new CKEDITOR.styleCommand(style, {
				contentForms: forms
			})
		);

		editor.ui.addButton('TaoStrike', {
			label: editor.lang[commandName].button,
			command: commandName,
			icon: 'strike',
			toolbar: 'basicstyles,21'
		});
	}
});
