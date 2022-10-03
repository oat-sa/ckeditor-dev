CKEDITOR.plugins.add('taofurigana', {
	lang: 'en', // %REMOVE_LINE_CORE%
    init : function(editor){
		'use strict';

        var commandName = 'rubyFurigana';
	    /**
	     * @param {CKEDITOR.dom.selection} selection
	     * @returns {CKEDITOR.dom.element}
	     */
         function getSelectionContent(selection) {
			var range = selection.getRanges()[0],
				content = range.extractContents().$;
			return new CKEDITOR.dom.element(content);
		}
        	    /**
	     * @param {CkEditor} editor - ckEditor instance
	     */
		function tooltipCanBeCreated(editor) {
			var selection = editor.getSelection();
			var nativeSelection = selection.getNative();

			return nativeSelection !== null && (canInsert(nativeSelection) || isWrappable(nativeSelection));
		}

	    /**
	     * @param {Selection} selection
	     * @returns {boolean}
	     */
		function canInsert(selection) {
			var range = selection.getRangeAt(0)
			return isSelectionEmpty(selection) && !isInTooltip(selection.getRangeAt(range.startContainer));
		}

	    /**
	     * @param {Selection} selection
	     * @returns {boolean}
	     */
		function isSelectionEmpty(selection) {
			return selection && selection.isCollapsed;
		}
        // Create the command that can be used to apply the style.
        editor.addCommand(commandName, {
            exec: function (editor) {
                var config = editor.config.taoQtiItem,
                    selection = editor.getSelection(),
                    rubyElement,
                    rbElement,
                    rtElement;

                if (typeof (config.insert) === 'function') {
                    rubyElement = new CKEDITOR.dom.element('ruby', editor.document);
                    rbElement = new CKEDITOR.dom.element('rb', editor.document);
                    rbElement.append(getSelectionContent(selection));
                    rtElement = new CKEDITOR.dom.element('rt', editor.document);
                    rtElement.appendHtml('&nbsp;');
                    rubyElement.append(rbElement);
                    rubyElement.append(rtElement);

                    editor.insertElement(rubyElement);

                    config.insert.call(editor, rubyElement.$);
                }
            }
        });

        editor.ui.addButton('TaoFurigana', {
            label : editor.lang[commandName].button,
            command : commandName,
            icon : this.path + 'images/taofurigana.png'
        });
    }
});
