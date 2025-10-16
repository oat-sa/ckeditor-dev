/*
Copyright (c) 2025 CKSource 
For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
*/
CKEDITOR.plugins.add("taounderline", {
	lang: "de,en,fr,nl",
	requires: "menubutton",

	init: function (editor) {
		// Styles
		const underlineStyle = new CKEDITOR.style({
			element: "span",
			attributes: { class: "txt-underline" },
		});
		const dashedStyle = new CKEDITOR.style({
			element: "span",
			attributes: { class: "txt-dashed" },
		});
		const wavyStyle = new CKEDITOR.style({
			element: "span",
			attributes: { class: "txt-wavy" },
		});

		// Content forms
		const underlineForms = [
			"u",
			[
				"span",
				function (el) {
					return el.styles["text-decoration"] === "underline";
				},
			],
		];
		underlineForms.unshift(underlineStyle);

		const dashedForms = [
			[
				"span",
				function (el) {
					return el.styles["text-decoration"] === "dashed";
				},
			],
		];
		dashedForms.unshift(dashedStyle);

		const wavyForms = [
			[
				"span",
				function (el) {
					return el.styles["text-decoration"] === "wavy";
				},
			],
		];
		wavyForms.unshift(wavyStyle);

		// Commands
		editor.addCommand(
			"spanUnderline",
			new CKEDITOR.styleCommand(underlineStyle, {
				contentForms: underlineForms,
			})
		);
		editor.addCommand(
			"spanDashed",
			new CKEDITOR.styleCommand(dashedStyle, {
				contentForms: dashedForms,
			})
		);
		editor.addCommand(
			"spanWavy",
			new CKEDITOR.styleCommand(wavyStyle, { contentForms: wavyForms })
		);

		function toggleStyle(styleToToggle) {
			// remove all styles first
			[underlineStyle, dashedStyle, wavyStyle].forEach(function (s) {
				if (s !== styleToToggle) editor.removeStyle(s);
			});

			// toggle style
			if (styleToToggle.checkActive(editor.elementPath(), editor)) {
				editor.removeStyle(styleToToggle);
			} else {
				editor.applyStyle(styleToToggle);
			}
		}

		function updateButtonState() {
			if (editor.readOnly) return;
			const path = editor.elementPath();
			const anyActive =
				underlineStyle.checkActive(path, editor) ||
				dashedStyle.checkActive(path, editor) ||
				wavyStyle.checkActive(path, editor);
			const btn = editor.ui.get("TaoUnderline");
			if (btn)
				btn.setState(
					anyActive ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF
				);
		}

		editor.attachStyleStateChange(underlineStyle, updateButtonState);
		editor.attachStyleStateChange(dashedStyle, updateButtonState);
		editor.attachStyleStateChange(wavyStyle, updateButtonState);

		// Keep selection across menu click
		let savedBookmarks = null;
		function restoreSelectionIfSaved() {
			if (savedBookmarks) {
				editor.focus();
				editor.getSelection().selectBookmarks(savedBookmarks);
				savedBookmarks = null;
			}
		}

		// Menu items
		const items = {
			taounderline_underline: {
				label: editor.lang.spanUnderline.menu.solid,
				group: "taounderline",
				order: 1,
				role: "menuitemcheckbox",
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(underlineStyle);
				},
				style: underlineStyle,
			},
			taounderline_dashed: {
				label: editor.lang.spanUnderline.menu.dashed,
				group: "taounderline",
				order: 2,
				role: "menuitemcheckbox",
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(dashedStyle);
				},
				style: dashedStyle,
			},
			taounderline_wavy: {
				label: editor.lang.spanUnderline.menu.wavy,
				group: "taounderline",
				order: 3,
				role: "menuitemcheckbox",
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(wavyStyle);
				},
				style: wavyStyle,
			},
		};


		editor.addMenuGroup("taounderline", 1);
		editor.addMenuItems(items);

		// Menubutton
		editor.ui.add("TaoUnderline", CKEDITOR.UI_MENUBUTTON, {
			label: editor.lang[commandName].button,
			toolbar: "basicstyles,20",
			icon: this.path + "images/taounderline.png",
			command: "spanUnderline",

			onMenu: function () {
				// visibility workaround
				if (document && document.body) {
					document.body.classList.add("cke_panel_visible");
				}
				// save selection
				const sel = editor.getSelection();
				if (sel) savedBookmarks = sel.createBookmarks(true);

				// reflect active state per item
				const path = editor.elementPath();
				const underlineActive = underlineStyle.checkActive(path, editor);
				const dashedActive = dashedStyle.checkActive(path, editor);
				const wavyActive = wavyStyle.checkActive(path, editor);

				return {
					taounderline_underline: underlineActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF,
					taounderline_dashed: dashedActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF,
					taounderline_wavy: wavyActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF,
				};
			},
		});
	},
});
