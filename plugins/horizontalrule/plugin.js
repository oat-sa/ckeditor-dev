/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @fileOverview Horizontal Rule plugin.
 */

( function() {
	var horizontalruleCmd = {
		canUndo: false, // The undo snapshot will be handled by 'insertElement'.
		exec: function( editor ) {
			var hr = editor.document.createElement( 'hr' );
			editor.insertElement( hr );
		},
		allowedContent: 'hr',
		requiredContent: 'hr'
	};

	var pluginName = 'horizontalrule';

	// Register a plugin named "horizontalrule".
	CKEDITOR.plugins.add( pluginName, {
		// jscs:disable maximumLineLength
		lang: 'af,ar,az,bg,bn,bs,ca,cs,cy,da,de,de-ch,el,en,en-au,en-ca,en-gb,eo,es,es-mx,et,eu,fa,fi,fo,fr,fr-ca,gl,gu,he,hi,hr,hu,id,is,it,ja,ka,km,ko,ku,lt,lv,mk,mn,ms,nb,nl,no,oc,pl,pt,pt-br,ro,ru,si,sk,sl,sq,sr,sr-latn,sv,th,tr,tt,ug,uk,vi,zh,zh-cn', // %REMOVE_LINE_CORE%
		// jscs:enable maximumLineLength
		icons: 'horizontalrule', // %REMOVE_LINE_CORE%
		hidpi: true, // %REMOVE_LINE_CORE%
		init: function( editor ) {
			if ( editor.blockless )
				return;

			editor.addCommand( pluginName, horizontalruleCmd );
			editor.ui.addButton && editor.ui.addButton( 'HorizontalRule', {
				label: editor.lang.horizontalrule.toolbar,
				command: pluginName,
				toolbar: 'insert,40'
			} );

            //changes made by OAT-SA 2022
            //add a class to <hr> tags when they're part of a text selection
            var selectionClass = 'text-selected';
            function getEditableHrs(){
            	var editable = editor.editable();
            	if (editable) {
					return editable.$.querySelectorAll('hr');
            	}
            	return [];
            }
            function removeSelectionClass(hrs) {
            	if(hrs && hrs.length) {
					hrs.forEach(function(hr){
						hr.classList.remove(selectionClass);
					});
                }
            }
            function handleSelection() {
            	var selection;
            	var range;
                var hrs = getEditableHrs();
                if (hrs.length) {
                    removeSelectionClass(hrs);

                    selection = document.getSelection();
                    range = selection.getRangeAt(0);
                    if (range && !range.collapsed) {
                    	hrs.forEach(function(hr) {
                            if (range.intersectsNode(hr)) {
                                hr.classList.add(selectionClass);
                            }
                        });
                    }
                }
            }
            editor.on('contentDom', function(){
                document.addEventListener('selectionchange', handleSelection);
            });
            editor.on('contentDomUnload', function(){
                removeSelectionClass(getEditableHrs());
                document.removeEventListener('selectionchange', handleSelection);
            });
            //end changes
		}
	} );
} )();
