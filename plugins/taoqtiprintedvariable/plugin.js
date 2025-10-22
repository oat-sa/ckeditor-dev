CKEDITOR.plugins.add('taoqtiprintedvariable', {
	lang: 'de,en,fr,nl', // %REMOVE_LINE_CORE%
    init: function(editor) {
        var savedSelection;

        editor.addCommand('insertQtiPrintedVariable', {
            exec: function(editor) {
                var config = editor.config.taoQtiItem;
                if(typeof(config.insert) === 'function'){
                    savedSelection = editor.getSelection().getRanges();
                    editor.focus();
                    if (savedSelection && savedSelection.length > 0) {
                        editor.getSelection().selectRanges(savedSelection);
                    }
                    editor.insertHtml('<span data-new="true" data-qti-class="printedVariable" class="widget-box">&nbsp;</span>');
                    config.insert.call(editor);
                    savedSelection = null;
                }
            }
        });

        editor.ui.addButton('TaoQtiPrintedVariable', {
            label: editor.lang.insertQtiPrintedVariable.button,
            command: 'insertQtiPrintedVariable',
            icon: this.path + 'images/taoqtiprintedvariable.png'
        });
    }
});
