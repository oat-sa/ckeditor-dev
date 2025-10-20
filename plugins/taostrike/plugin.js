CKEDITOR.plugins.add('taostrike', {
	lang: 'de,en,fr,nl',
	icons: 'strike',

	init: function (editor) {
		var commandName = 'spanStrike',
			style = new CKEDITOR.style({
				element: 'span',
				attributes: { 'class': 'txt-strike' }
			}),
			forms = [
				'u',
				[
					'span',
					function (el) {
						return el.styles['text-decoration'] == 'line-through';
					}
				]
			];

    forms.unshift(style);

		// Create the command that can be used to apply the style.
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
