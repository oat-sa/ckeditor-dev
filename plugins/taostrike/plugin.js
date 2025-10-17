/*
Copyright (c) 2025 CKSource 
For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
*/
CKEDITOR.plugins.add("taostrike", {
  lang: "en",
  icons: "strike",
  hidpi: true,

  init: function (editor) {
    var commandName = "spanStrike",
      style = new CKEDITOR.style({
        element: "span",
        attributes: { "class": "txt-strike" }
      }),
      forms = [
        "strike",
        [
          "span",
          function (el) {
            return el.styles["text-decoration"] === 'line-through';
          }
        ]
      ];

    forms.unshift(style);

    editor.attachStyleStateChange(style, function (state) {
        !editor.readOnly && editor.getCommand(commandName).setState(state);
    });

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
      toolbar: "basicstyles,21"
    });
  }
});
