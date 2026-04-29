/*
Copyright (c) 2025 CKSource 
For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
*/
CKEDITOR.plugins.add('taounderline', {
	lang: 'de,en,fr,nl,ja', // %REMOVE_LINE_CORE%
	requires: 'menubutton',

	init: function (editor) {
		// Styles
		var underlineStyle = new CKEDITOR.style({
			element: 'span',
			attributes: { 'class': 'txt-underline' }
		});
		var dashedStyle = new CKEDITOR.style({
			element: 'span',
			attributes: { 'class': 'txt-dashed' }
		});
		var wavyStyle = new CKEDITOR.style({
			element: 'span',
			attributes: { 'class': 'txt-wavy' }
		});

		// Content forms
		var underlineForms = [
			'u',
			[
				'span',
				function (el) {
					return el.styles['text-decoration'] === 'underline';
				}
			]
		];
		underlineForms.unshift(underlineStyle);

		var dashedForms = [
			[
				'span',
				function (el) {
					return el.styles['text-decoration'] === 'underline dashed';
				}
			]
		];
		dashedForms.unshift(dashedStyle);

		var wavyForms = [
			[
				'span',
				function (el) {
					return el.styles['text-decoration'] === 'underline wavy';
				}
			]
		];
		wavyForms.unshift(wavyStyle);

		// Commands
		editor.addCommand(
			'spanUnderline',
			new CKEDITOR.styleCommand(underlineStyle, {
				contentForms: underlineForms
			})
		);
		editor.addCommand(
			'spanDashed',
			new CKEDITOR.styleCommand(dashedStyle, {
				contentForms: dashedForms
			})
		);
		editor.addCommand(
			'spanWavy',
			new CKEDITOR.styleCommand(wavyStyle, { contentForms: wavyForms })
		);

		function toggleStyle(styleToToggle) {
			// remove all styles first
			[underlineStyle, dashedStyle, wavyStyle].forEach(function (s) {
				if (s !== styleToToggle) editor.removeStyle(s);
			});

			if (styleToToggle.checkActive(editor.elementPath(), editor)) {
				editor.removeStyle(styleToToggle);
			} else {
				editor.applyStyle(styleToToggle);
			}
		}

		function updateButtonState() {
			if (editor.readOnly) return;
			var path = editor.elementPath();
			var anyActive =
				underlineStyle.checkActive(path, editor) ||
				dashedStyle.checkActive(path, editor) ||
				wavyStyle.checkActive(path, editor);
			var btn = editor.ui.get('TaoUnderline');
			if (btn)
				btn.setState(
					anyActive ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF
				);
		}

		editor.attachStyleStateChange(underlineStyle, updateButtonState);
		editor.attachStyleStateChange(dashedStyle, updateButtonState);
		editor.attachStyleStateChange(wavyStyle, updateButtonState);

		// Keep selection across menu click
		var savedBookmarks = null;

		function saveSelectionIfPossible() {
			var sel = editor.getSelection();
			if (!sel) return;

			var ranges = sel.getRanges();
			if (!ranges.length) return;

			var range = ranges[0];
			range.shrink(CKEDITOR.SHRINK_TEXT);
			range.trim();
			sel.selectRanges([range]);

			savedBookmarks = sel.createBookmarks();
		}

		function restoreSelectionIfSaved() {
			if (!savedBookmarks) return;

			try {
				editor.focus();
				var sel = editor.getSelection();
				sel && sel.selectBookmarks(savedBookmarks);
			} catch (e) {
				var curSel = editor.getSelection();
				if (curSel) {
					var rs = curSel.getRanges();
					if (rs.length) {
						var r = rs[0];
						r.shrink(CKEDITOR.SHRINK_TEXT);
						r.trim();
						curSel.selectRanges([r]);
					}
				}
			} finally {
				savedBookmarks = null;
			}
		}

		var items = {
			taounderline_underline: {
				label: editor.lang.spanUnderline.menu.solid,
				group: 'taounderline',
				order: 1,
				role: 'menuitemcheckbox',
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(underlineStyle);
				},
				style: underlineStyle
			},
			taounderline_dashed: {
				label: editor.lang.spanUnderline.menu.dashed,
				group: 'taounderline',
				order: 2,
				role: 'menuitemcheckbox',
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(dashedStyle);
				},
				style: dashedStyle
			},
			taounderline_wavy: {
				label: editor.lang.spanUnderline.menu.wavy,
				group: 'taounderline',
				order: 3,
				role: 'menuitemcheckbox',
				onClick: function () {
					restoreSelectionIfSaved();
					toggleStyle(wavyStyle);
				},
				style: wavyStyle
			}
		};


		editor.addMenuGroup('taounderline', 1);
		editor.addMenuItems(items);

		editor.ui.add('TaoUnderline', CKEDITOR.UI_MENUBUTTON, {
			label: editor.lang.spanUnderline.button,
			toolbar: 'basicstyles,20',
			icon: this.path + 'images/taounderline.png',
			command: 'spanUnderline',

			onMenu: function () {
				// visibility workaround
				if (document && document.body) {
					document.body.classList.add('cke_panel_visible');
				}
				// save selection
				saveSelectionIfPossible();

				// reflect active state per item
				var path = editor.elementPath();
				var underlineActive = underlineStyle.checkActive(path, editor);
				var dashedActive = dashedStyle.checkActive(path, editor);
				var wavyActive = wavyStyle.checkActive(path, editor);

				return {
					taounderline_underline: underlineActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF,
					taounderline_dashed: dashedActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF,
					taounderline_wavy: wavyActive
						? CKEDITOR.TRISTATE_ON
						: CKEDITOR.TRISTATE_OFF
				};
			}
		});
	}
});