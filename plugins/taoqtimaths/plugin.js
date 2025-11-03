CKEDITOR.plugins.add('taoqtimaths', {
	lang: 'de,en,fr,ja,nl', // %REMOVE_LINE_CORE%
    init: function(editor) {
        var savedSelection;

        editor.addCommand('insertQtiMaths', {
            exec: function(editor) {
                var config = editor.config.taoQtiItem;
                if(typeof(config.insert) === 'function'){
                    savedSelection = editor.getSelection().getRanges();
                    editor.focus();
                    if (savedSelection && savedSelection.length > 0) {
                        editor.getSelection().selectRanges(savedSelection);
                    }
                    editor.insertHtml('<span data-new="true" data-qti-class="math" class="widget-box">&nbsp;</span>');
                    config.insert.call(editor);
                    savedSelection = null;
                }
            }
        });

        editor.ui.addButton('TaoQtiMaths', {
            label: editor.lang.insertQtiMaths.button,
            command: 'insertQtiMaths',
            icon: this.path + 'images/taoqtimaths.png'
        });
    }
});
