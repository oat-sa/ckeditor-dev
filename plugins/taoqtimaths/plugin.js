CKEDITOR.plugins.add('taoqtimaths', {
	lang: 'de,en,fr,nl', // %REMOVE_LINE_CORE%
    init: function(editor) {

        editor.addCommand('insertQtiMaths', {
            exec: function(editor) {
                var config = editor.config.taoQtiItem;
                if(typeof(config.insert) === 'function'){
                    editor.insertHtml('<span data-new="true" data-qti-class="math" class="widget-box">&nbsp;</span>');
                    config.insert.call(editor);
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
