CKEDITOR.plugins.add('taoqtiinclude', {
	lang: 'de,en,fr,ja,nl', // %REMOVE_LINE_CORE%
    init: function(editor) {
        var savedSelection;

        editor.addCommand('insertQtiInclude', {
            exec: function(editor) {
                var config = editor.config.taoQtiItem;
                if(typeof(config.insert) === 'function'){
                    savedSelection = editor.getSelection().getRanges();
                    editor.focus();
                    if (savedSelection && savedSelection.length > 0) {
                        editor.getSelection().selectRanges(savedSelection);
                    }
                    editor.insertHtml('<span data-new="true" data-qti-class="include" class="widget-box">&nbsp;</span>');
                    config.insert.call(editor);
                    savedSelection = null;
                }
            }
        });

        editor.ui.addButton('TaoQtiInclude', {
            label: editor.lang.insertQtiInclude.button,
            command: 'insertQtiInclude',
            icon: this.path + 'images/taoqtiimage.png'
        });
    }
});
