import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/react/style.css';
import '@blocknote/mantine/style.css';

const BlockNoteEditor = forwardRef(({ onContentChange, onWordCountChange }, ref) => {
  // BlockNote includes formatting options by default:
  // - Bold (Ctrl/Cmd + B or toolbar)
  // - Italic (Ctrl/Cmd + I or toolbar)
  // - Text color (via formatting toolbar)
  // - Underline, Strikethrough, Code, Link, etc.
  // BlockNote includes all formatting options by default:
  // - Bold (Ctrl/Cmd + B or select text and use toolbar)
  // - Italic (Ctrl/Cmd + I or select text and use toolbar)
  // - Text color (select text and use color picker in toolbar)
  // - Underline, Strikethrough, Code, Link, etc.
  const editor = useCreateBlockNote({
    uploadFile: async (file) => {
      try {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
      }
    }
  });

  // Set up onChange callback
  useEffect(() => {
    if (!editor) return;

    const handleChange = () => {
      try {
        const blocks = editor.document;
        let text = '';
        const extractText = (blocks) => {
          if (!blocks || !Array.isArray(blocks)) return;
          blocks.forEach(block => {
            if (block.content) {
              if (typeof block.content === 'string') {
                text += block.content + ' ';
              } else if (Array.isArray(block.content)) {
                block.content.forEach(item => {
                  if (typeof item === 'string') {
                    text += item + ' ';
                  } else if (item && typeof item === 'object' && item.text) {
                    text += item.text + ' ';
                  }
                });
              }
            }
            if (block.children && Array.isArray(block.children)) {
              extractText(block.children);
            }
          });
        };
        extractText(blocks);
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        if (onWordCountChange) {
          onWordCountChange(words.length);
        }
        if (onContentChange) {
          onContentChange(blocks);
        }
      } catch (error) {
        console.error('Error calculating word count:', error);
      }
    };

    editor.onChange(handleChange);

    return () => {
      // Cleanup if needed
    };
  }, [editor, onWordCountChange, onContentChange]);

  // Expose editor instance to parent via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getContent: async () => {
      if (editor && editor.document) {
        return await editor.blocksToHTMLLossy(editor.document);
      }
      return '';
    }
  }));

  // Ensure editor is initialized before rendering
  if (!editor) {
    return (
      <div style={{ minHeight: '500px' }} className="flex items-center justify-center">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '500px' }}>
      <BlockNoteView 
        editor={editor}
        theme="light"
        formattingToolbar={true}
      />
      {/* Formatting Instructions */}
      <div className="mt-2 text-xs text-gray-500 px-2">
        <p className="mb-1">
          <strong>Formatting Tips:</strong> Select text to see formatting options (Bold, Italic, Text Color, etc.)
        </p>
        <p>
          <strong>Keyboard Shortcuts:</strong> <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl/Cmd + B</kbd> for Bold, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl/Cmd + I</kbd> for Italic
        </p>
      </div>
    </div>
  );
});

BlockNoteEditor.displayName = 'BlockNoteEditor';

export default BlockNoteEditor;

