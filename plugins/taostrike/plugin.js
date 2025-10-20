CKEDITOR.plugins.add("taostrike", {
	lang: "en", // %REMOVE_LINE_CORE%
	init: function (editor) {
		var commandName = "spanStrike",
			style = new CKEDITOR.style({
				element: "span",
				attributes: { "class": "txt-strike" }
			}),
			forms = [
				"u",
				[
					"span",
					function (el) {
						return el.styles["text-decoration"] == "line-though";
					}
				]
			];

		// Put the style as the most important form.
		forms.unshift(style);

		// Listen to contextual style activation.
		editor.attachStyleStateChange(style, function (state) {
			!editor.readOnly && editor.getCommand(commandName).setState(state);
		});

		// Create the command that can be used to apply the style.
		editor.addCommand(
			commandName,
			new CKEDITOR.styleCommand(style, {
				contentForms: forms
			})
		);

		editor.ui.addButton("TaoStrike", {
			label: editor.lang[commandName].button,
			command: commandName,
			icon: "strike",
			toolbar: 'basicstyles,21'
		});
	}
});
